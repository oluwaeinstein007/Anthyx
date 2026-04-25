# social-mcp Email Integration Guide

This document explains how Anthyx uses `social-mcp` for email sending and how to work
with per-org / per-user email credentials without touching environment variables.

---

## How social-mcp works

`social-mcp` is an **MCP server process** — it exposes tools over the Model Context
Protocol (stdio). It is NOT a library to import directly. The correct integration
pattern for Anthyx is to dynamically import its `EmailService` class from the installed
package and instantiate it with credentials at call time.

```
npx social-mcp          ← runs as an MCP server subprocess (for AI assistants)

new EmailService(creds) ← used by Anthyx API directly for programmatic sends
```

---

## Email credential storage (per org / per user)

All email accounts are stored in the `social_accounts` table with `platform = 'email'`.
The secret (SMTP password or API key) is stored **AES-256-GCM encrypted** in
`access_token`. Non-secret config (host, port, mailer type, from address, recipients)
is stored in `platform_config` as JSONB.

### SMTP account shape

```json
{
  "mailer": "smtp",
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "org@gmail.com",
  "encryption": "tls",
  "fromAddress": "org@gmail.com",
  "fromName": "Acme Corp",
  "recipients": ["user1@example.com", "user2@example.com"]
}
```
`access_token` → encrypted SMTP password

### SendGrid account shape

```json
{
  "mailer": "sendgrid",
  "fromAddress": "org@acme.com",
  "fromName": "Acme Corp",
  "recipients": ["..."]
}
```
`access_token` → encrypted SendGrid API key

### Mailgun account shape

```json
{
  "mailer": "mailgun",
  "domain": "mg.acme.com",
  "fromAddress": "org@acme.com",
  "fromName": "Acme Corp",
  "recipients": ["..."]
}
```
`access_token` → encrypted Mailgun API key

---

## How to send email from Anthyx code

**Never patch `social-mcp`'s config object.** That approach required a mutex to
prevent credential bleed between concurrent BullMQ workers and was fragile across
package updates.

Instead, dynamically import `EmailService` and pass credentials directly to the
constructor. Each instance is fully isolated — no shared state.

```typescript
import { createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";
import { decryptToken } from "../services/oauth-proxy/crypto";

// Resolve social-mcp's dist directory from the installed package
const req = createRequire(__filename);
const smcpDistRoot = path.dirname(req.resolve("social-mcp"));
const svcUrl = pathToFileURL(path.join(smcpDistRoot, "services/email-service.js")).href;

const { EmailService } = await import(svcUrl) as {
  EmailService: new (creds: object) => {
    send(to: string, subject: string, text: string, html?: string): Promise<void>;
  };
};

// Load account from DB, decrypt secret
const account = await db.query.socialAccounts.findFirst({ where: ... });
const cfg = account.platformConfig as Record<string, unknown>;
const secret = decryptToken(account.accessToken!);

const service = new EmailService({
  mailer: cfg["mailer"],                        // "smtp" | "sendgrid" | "mailgun"
  fromAddress: cfg["fromAddress"],
  fromName: cfg["fromName"] || undefined,
  // SMTP only
  smtpHost: cfg["host"],
  smtpPort: cfg["port"],
  smtpUsername: cfg["username"],
  smtpPassword: cfg["mailer"] === "smtp" ? secret : undefined,
  smtpEncryption: cfg["encryption"],            // "tls" | "ssl" | "none"
  // SendGrid only
  sendgridApiKey: cfg["mailer"] === "sendgrid" ? secret : undefined,
  // Mailgun only
  mailgunApiKey: cfg["mailer"] === "mailgun" ? secret : undefined,
  mailgunDomain: cfg["domain"],
});

await service.send(to, subject, plainText, htmlBody);
```

---

## Sending email campaigns (`/email-campaigns/:id/send`)

The send endpoint:
1. Loads the campaign and the org's active email account in parallel
2. Decrypts the stored secret
3. Instantiates `EmailService` with those credentials
4. Sends to each recipient individually (prevents address leakage in `To:` header)
5. Marks the campaign as `sent`

Optional request body: `{ "socialAccountId": "<uuid>" }` to choose a specific email
account when the org has more than one configured.

---

## Sending via the scheduled post worker (`publishToEmail`)

For posts scheduled through the agent → plan → post worker flow, `publishToEmail`
in `services/posting/social-mcp.ts` handles the send. It receives:

| Field | Source |
|---|---|
| `p.accessToken` | Decrypted by `oauthProxy.getValidToken()` |
| `p.emailMailer` | `platformConfig.mailer` |
| `p.emailFrom` | Built from `platformConfig.fromAddress` + `fromName` |
| `p.emailTo` | `platformConfig.recipients` |
| `p.emailSmtpHost/Port/Username/Encryption` | `platformConfig.*` |
| `p.emailMailgunDomain` | `platformConfig.domain` |
| `p.emailSubject` | Set explicitly for campaign sends (bypasses content-line parsing) |
| `p.emailHtmlBody` | Set explicitly for campaign sends |

For regular scheduled posts, `p.content` is parsed: **first line = subject**, rest = body.
For campaign sends, set `emailSubject` and `emailHtmlBody` explicitly to bypass parsing.

---

## Adding or editing an email account (API)

| Method | Path | Action |
|---|---|---|
| `POST` | `/accounts/email` | Connect a new email account |
| `PUT` | `/accounts/email/:id` | Edit credentials (leave password blank to keep existing) |

Both endpoints validate credentials before saving:
- **SMTP**: TCP connectivity check on `host:port`
- **SendGrid**: `GET /v3/scopes` with the API key
- **Mailgun**: `GET /v3/domains/:domain` with the API key

---

## Switching drivers

To change an org from SMTP to SendGrid, call `PUT /accounts/email/:id` with:

```json
{
  "mailer": "sendgrid",
  "fromAddress": "org@acme.com",
  "fromName": "Acme Corp",
  "recipients": "user@example.com",
  "apiKey": "SG.xxxx"
}
```

No code changes required — the driver is read from `platform_config.mailer` at send time.

---

## SMTP verification at social-mcp startup

When `social-mcp` starts with SMTP configured via env vars, it calls
`transporter.verify()` at startup. A bad password or wrong host shows `[!!]` in the
startup log instead of failing silently at send time. SendGrid and Mailgun do not have
a free verify endpoint so they are not verified at startup (credential errors surface on
the first send).

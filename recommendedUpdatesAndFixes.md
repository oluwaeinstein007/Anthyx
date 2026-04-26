# Recommended Updates & Fixes

## User Features

### 1. Email Campaign Management
- Build a full email campaign creation flow (subject, body, audience, schedule)
- Add a **Mailing Lists** management page with support for:
  - Creating new lists with name and description
  - Adding/removing subscribers individually or via CSV import
  - Merging or archiving lists
  - Tagging lists for segmentation

### 2. Post Page Improvements
- Make content text selectable and links clickable within post previews
- Add image lightbox support (click image → full-screen overlay with zoom/pan)
- Implement a full-screen post view mode (accessible from the post card or detail page)

### 3. AI Learning from Vetoed Content
- When content is vetoed, capture the veto reason and feed it back into the generation context
- Store vetoed examples per brand/user as negative training signals
- Surface a "Quality Improvement" indicator showing how the model has adapted over time

### 4. Content Status Toggling
- Allow users to change status: `Vetoed → Approved` and `Approved → Vetoed`
- Show a confirmation dialog with an optional reason field when changing status
- Log all status changes with timestamp and actor for audit trail

### 5. Self-Created Content
- Let users manually create posts alongside AI-generated ones
- Per-platform content guidelines enforced in the editor (character limits, hashtag rules, image specs)
- Scheduling picker with timezone support
- Media options: upload existing media or generate via text prompt (AI image generation)

### 6. Competitive Research for Brands
Dedicated **Competitive Intelligence** workspace per brand, organized into the following sections:

#### Industry Overview
- AI-generated industry summary: market size, growth rate, key trends, and major players
- Refreshable on demand with a "last updated" timestamp
- Tag the brand's primary industry and sub-niche for more precise insights

#### Competitor Tracking
- Add competitors by name, website URL, or social handle
- Auto-detect their active social platforms and pull public profile data
- Competitor status badges: Active, Inactive, New (entered market recently)
- Group competitors into tiers (Direct, Indirect, Aspirational)

#### Content & Posting Analysis
- Side-by-side comparison of posting cadence (posts per week per platform)
- Content theme breakdown: what topics they post about and in what proportion
- Format mix: video vs. image vs. text vs. carousel
- Best-performing post types per competitor based on engagement signals
- Tone analysis: professional, casual, humorous, educational, promotional

#### Engagement & Performance Benchmarks
- Average likes, comments, shares, and saves per post per competitor
- Engagement rate benchmarks by platform (so the brand knows where they stand)
- Follower growth trend chart over the past 30/90/180 days
- Virality score: frequency of posts that break above their average engagement

#### Gap & Opportunity Analysis
- Topics competitors are not covering that the brand could own
- Posting time gaps — windows where competitors are quiet and the brand can dominate
- Keyword and hashtag opportunities competitors are ranking for but under-utilizing
- Platform gaps: platforms competitors have a weak presence on

#### Share of Voice
- Visual breakdown of how much of the conversation in the industry each competitor owns
- Trend over time: is the brand gaining or losing share of voice?
- Filterable by platform and date range

#### Sentiment Analysis
- Overall sentiment score per competitor (positive / neutral / negative)
- Drill down into what topics drive negative vs. positive sentiment
- Comment sentiment on their top posts
- Brand perception word cloud generated from audience comments

#### Campaign & Launch Tracker
- Detect when a competitor runs a new campaign (spike in posting + paid indicators)
- Timeline view of competitor campaigns over the past year
- Notes field to annotate what worked or what the brand should counter with

#### Alerts & Monitoring
- Real-time alerts when a competitor publishes above their normal cadence
- Notify when a competitor's follower count crosses a threshold
- Weekly digest email summarizing competitor activity for the week
- Alert when a competitor starts posting in a new content category

#### Benchmarking Dashboard
- Single-view scorecard comparing the brand against all tracked competitors across: follower count, engagement rate, posting frequency, content variety, and sentiment
- Color-coded indicators (ahead / at par / behind) for each metric
- Exportable as a branded PDF or shareable link for stakeholders

---

## Auth & Security

### 1. Separate User and Admin Token Scopes
- Issue tokens with distinct audiences (`aud: user` vs `aud: admin`) so a user token is rejected by admin routes and vice versa
- Use separate signing secrets or separate JWT claims per role
- Recommended: a single `auth` service that stamps role into the token at issuance and validates it at middleware level

### 2. Seed Admin Accounts
Seed the following accounts with password `12345678` (marked `must_change_password: true`):
- `superadmin@anthyx.com` — Super Admin role
- `lanre@anthyx.com` — Admin role
- `support@anthyx.com` — Support role

---

## Admin Panel

### 1. Admin Account Creation with RBAC
- Implement an **invite flow**: super admin sends invite link → invitee sets password on first login
- Define roles: `Super Admin`, `Admin`, `Support`, `Billing`
- Each role has explicit permission scopes (e.g., Support cannot edit plans or billing)
- Show role assignments in a user management table with inline role editing

### 2. Editable Email Templates
- Admin UI for editing transactional email templates (welcome, password reset, invoice, etc.)
- Support variable tokens (e.g., `{{user.name}}`, `{{plan.name}}`) with a live preview panel
- Save versions so templates can be rolled back

### 3. Plan Price Editing
- Plan prices are currently not editable — fix this so admins can update pricing per plan
- Changes should apply to new subscribers only; existing subscribers remain on their current price until they change plans
- Add a confirmation prompt and change log

### 4. Feature Flags
- Feature flags are per-user or per-plan toggles that enable/disable specific functionality without a code deploy
- Admin UI should list all flags with their current state (on/off), the scope they apply to (global, plan, user), and a toggle control
- Example uses: roll out a beta feature to select users, disable a broken feature instantly, A/B test new UI

---

## Brand & Brand Ingestion

### Brand List Page
- Show a richer brand card: brand logo/avatar, platform icons for connected accounts, last-activity timestamp ("last post 2 days ago")
- Add search and filter controls (by industry, tone, creation date) for users managing many brands
- Quick-stat strip on each card: total posts generated, pending review count, engagement score
- Allow drag-to-reorder so users can prioritise their primary brand
- "Duplicate brand" action — spin up a new brand pre-filled from an existing one, useful for sub-brands or regional variants
- Archive / unarchive instead of hard delete, with a confirmation modal

### Brand Profile Page (Detail View)
- **Logo / avatar upload** — replace the generic icon with an upload or AI-generate option
- **Brand health score** — a computed badge (e.g. 78 / 100) based on profile completeness (voice, pillars, audience, knowledge, identity) with a checklist of what's missing
- **Platform connections panel** — show which social accounts are linked, their connection status, and a "Connect" CTA for unlinked platforms
- **Edit mode** — a single "Edit brand" flow that opens all sections in one form with save / cancel, rather than scattered inline edits
- **Version history** — track changes to voice, tone, and positioning over time with the ability to roll back to a previous version
- **Brand activity feed** — timeline of recent events: posts generated, documents ingested, tone updates, campaigns started
- **Export brand profile** — download a PDF or JSON snapshot for sharing with a team or agency
- **Duplicate / clone** — accessible from the profile header, same as the list-page action

### New Brand Attributes to Add

#### Brand Identity
- **Logo** — upload primary logo, alternate logo, and favicon; store light and dark variants
- **Color palette** — primary, secondary, and accent colors with hex codes; auto-extract from uploaded logo or ingested docs (the ingest description already says this is extracted — surface it visibly in the profile)
- **Typography** — primary and secondary font names; heading vs. body font distinction
- **Tagline / slogan** — short phrase used across all content
- **Brand emojis** — a curated set the brand uses consistently across platforms

#### Brand Story & Values
- **Mission statement** — what the brand does and for whom
- **Vision statement** — the long-term ambition
- **Core values** — tag-based list (e.g. Transparency, Innovation, Community) with a one-line description per value
- **Brand origin story** — a short paragraph about how and why the brand was started; used to humanise AI-generated content
- **Brand stage** — Idea / Startup / Growth / Established / Enterprise; helps AI calibrate tone and confidence level

#### Content Strategy
- **Content do's and don'ts** — explicit rules the AI must follow (e.g. "never use corporate jargon", "always include a CTA")
- **Banned words / phrases** — a blocklist the AI is prohibited from using
- **Call-to-action preferences** — preferred CTAs per platform (e.g. "Follow for more" on Instagram, "Subscribe" on LinkedIn)
- **Hashtag strategy** — brand hashtags, campaign hashtags, and community hashtags; mark each as always-use, rotate, or avoid
- **Posting language(s)** — primary language and any secondary languages for multilingual brands
- **Content ratio** — preferred mix of educational / promotional / entertaining / conversational content (e.g. 40 / 20 / 30 / 10)

#### Audience & Market
- **Primary audience personas** — structured cards with name, age range, job title, pain points, goals, and platform preference
- **Geographic focus** — countries or regions the brand targets; used to tailor references, currency, and cultural context
- **Languages** — distinct from posting language; what language(s) the audience speaks
- **Competitor shortlist** — a lightweight list of 3–5 key competitors linked directly to the Competitive Intelligence workspace

#### Social & Contact
- **Social handles** — per-platform handles stored in one place (Twitter/X, Instagram, LinkedIn, TikTok, YouTube, Threads)
- **Website URL** — primary site; used as the default link-in-bio reference
- **Brand email** — public-facing contact email used in email campaigns as the sender address

### Voice & Tone Section
- Allow users to add custom personality traits beyond predefined tags — free-text input with a suggestion dropdown
- **Tone preview** — given current traits and descriptors, show an AI-generated sample paragraph so users can validate tone before generating real content
- **Tone test** — paste any piece of existing content and get a score for how closely it matches the configured tone
- **Competitor tone contrast** — compare this brand's configured tone against a tracked competitor's detected tone
- **Voice examples** — let users paste 2–3 sample posts they love; the AI learns directly from these rather than just from abstract trait tags

### Products & Services Section
- Group products into categories (e.g. Core Offering, Add-ons, Coming Soon)
- Attach a short description, target audience, and key benefit to each product tag
- Link products to content pillars so the AI knows which pillar maps to which product
- Mark products as active, discontinued, or beta so the AI doesn't promote the wrong ones

### Brand Knowledge Section
- Structured knowledge blocks beyond free-text audience notes: FAQs, objection handling, pricing rationale, case studies, brand story
- **Knowledge gaps indicator** — AI flags topics that surface in generated content but have no supporting knowledge entry
- Mark individual knowledge entries as "high priority" so the AI weights them more heavily
- Set an expiry date on time-sensitive knowledge entries (e.g. a seasonal promotion) so they are automatically deprioritised after the date passes

### Brand Ingestion (already has PDF / URL / TEXT — improvements needed)
- **Ingestion progress indicator** — live status steps ("Parsing…", "Extracting voice signals…", "Updating brand memory…") instead of a silent background process
- **Ingestion summary** — after each ingest, show a diff: what new facts were added, which existing facts were updated, what was ignored
- **Multi-file upload** — batch upload multiple PDFs at once (style guides, past campaigns, product docs, competitor teardowns)
- **Social post ingestion** — pull in the brand's existing posts from connected platforms as additional voice training data
- **Ingestion history log** — table of all previously ingested sources (file name or URL, date, type) with the option to remove a source from memory
- **Re-ingest / refresh** — re-upload an updated document and merge the delta rather than starting fresh
- **Ingestion quality score** — confidence score per extracted attribute (voice, tone, audience, colors) so users know how much each document contributed
- **Manual override** — after ingestion, let users review AI-extracted values and accept, edit, or reject individual facts before committing them to the brand profile

---

## Affiliate Portal

### 1. Account Creation Flow
- Build a self-serve affiliate registration page: name, email, payout details, agreement acceptance
- Send a verification email on sign-up
- Pending affiliates go into an approval queue visible to admins
- On approval, affiliate receives a welcome email with their referral link and portal access
- Track referral clicks, conversions, and commissions from day one

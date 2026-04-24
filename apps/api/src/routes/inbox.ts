import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { socialAccounts } from "../db/schema";
import { auth } from "../middleware/auth";

const router = Router();

// GET /inbox — paginated cross-platform messages/comments
// Query params: platform, brandProfileId, replied, limit, offset
//
// NOTE: Fetch logic depends on social-mcp read tools (SEARCH_TWEETS,
// GET_INSTAGRAM_POSTS, etc.). Wire those calls here once social-mcp tools
// are registered on the FastMCP server (see §4.1 and §8 in improvement.md).
router.get("/", auth, async (req, res) => {
  const { platform, limit: limitStr, offset: offsetStr } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(limitStr ?? "50"), 200);
  const offset = parseInt(offsetStr ?? "0");

  const accounts = await db.query.socialAccounts.findMany({
    where: and(
      eq(socialAccounts.organizationId, req.user.orgId),
      eq(socialAccounts.isActive, true),
      ...(platform ? [eq(socialAccounts.platform, platform as never)] : []),
    ),
  });

  // TODO: for each connected account, call the social-mcp read tools
  // (e.g. SEARCH_TWEETS for mentions, GET_INSTAGRAM_POSTS for comments)
  // via the FastMCP SSE transport and aggregate the results.
  // Return stub for now so the route exists and is mountable.
  return res.json({
    messages: [],
    connectedAccounts: accounts.map((a) => ({ id: a.id, platform: a.platform, handle: a.accountHandle })),
    total: 0,
    limit,
    offset,
    note: "Inbox fetch not yet implemented — wire social-mcp read tools (see improvement.md §4.1)",
  });
});

// POST /inbox/:messageId/reply — post a reply via social-mcp and mark as replied
router.post("/:messageId/reply", auth, async (req, res) => {
  const { content, platform, socialAccountId } = req.body as {
    content: string;
    platform: string;
    socialAccountId: string;
  };

  if (!content || !platform || !socialAccountId) {
    return res.status(400).json({ error: "content, platform, and socialAccountId are required" });
  }

  const account = await db.query.socialAccounts.findFirst({
    where: and(
      eq(socialAccounts.id, socialAccountId),
      eq(socialAccounts.organizationId, req.user.orgId),
    ),
  });
  if (!account) return res.status(404).json({ error: "Social account not found" });

  // TODO: call the appropriate social-mcp reply tool for the platform
  // (e.g. post_tweet_reply for X, reply_instagram_comment for Instagram)
  return res.json({ replied: true, messageId: req.params.messageId, note: "Reply not yet wired — implement via social-mcp tools" });
});

export { router as inboxRouter };

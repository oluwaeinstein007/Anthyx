import { Router } from "express";
import { eq, and, desc, ilike } from "drizzle-orm";
import { db } from "../db/client";
import { mailingLists, mailingListSubscribers } from "../db/schema";
import { auth } from "../middleware/auth";

const router = Router();

// ── Mailing Lists ─────────────────────────────────────────────────────────────

// GET /mailing-lists
router.get("/", auth, async (req, res) => {
  const lists = await db.query.mailingLists.findMany({
    where: eq(mailingLists.organizationId, req.user.orgId),
    orderBy: [desc(mailingLists.createdAt)],
  });

  // Attach subscriber counts
  const withCounts = await Promise.all(
    lists.map(async (list) => {
      const subscribers = await db.query.mailingListSubscribers.findMany({
        where: and(
          eq(mailingListSubscribers.mailingListId, list.id),
          eq(mailingListSubscribers.status, "active"),
        ),
        columns: { id: true },
      });
      return { ...list, subscriberCount: subscribers.length };
    }),
  );

  return res.json(withCounts);
});

// POST /mailing-lists
router.post("/", auth, async (req, res) => {
  const { name, description, tags } = req.body as {
    name: string;
    description?: string;
    tags?: string[];
  };

  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const [list] = await db
    .insert(mailingLists)
    .values({
      organizationId: req.user.orgId,
      name: name.trim(),
      description: description ?? null,
      tags: tags ?? [],
    })
    .returning();

  return res.status(201).json(list);
});

// PATCH /mailing-lists/:id
router.patch("/:id", auth, async (req, res) => {
  const list = await db.query.mailingLists.findFirst({
    where: and(
      eq(mailingLists.id, req.params.id!),
      eq(mailingLists.organizationId, req.user.orgId),
    ),
  });
  if (!list) return res.status(404).json({ error: "List not found" });

  const { name, description, tags, archived } = req.body as {
    name?: string;
    description?: string;
    tags?: string[];
    archived?: boolean;
  };

  const [updated] = await db
    .update(mailingLists)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(tags !== undefined && { tags }),
      ...(archived !== undefined && {
        archivedAt: archived ? new Date() : null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(mailingLists.id, list.id))
    .returning();

  return res.json(updated);
});

// DELETE /mailing-lists/:id
router.delete("/:id", auth, async (req, res) => {
  const list = await db.query.mailingLists.findFirst({
    where: and(
      eq(mailingLists.id, req.params.id!),
      eq(mailingLists.organizationId, req.user.orgId),
    ),
  });
  if (!list) return res.status(404).json({ error: "List not found" });

  await db.delete(mailingLists).where(eq(mailingLists.id, list.id));
  return res.json({ deleted: true });
});

// ── Subscribers ───────────────────────────────────────────────────────────────

// GET /mailing-lists/:id/subscribers
router.get("/:id/subscribers", auth, async (req, res) => {
  const list = await db.query.mailingLists.findFirst({
    where: and(
      eq(mailingLists.id, req.params.id!),
      eq(mailingLists.organizationId, req.user.orgId),
    ),
  });
  if (!list) return res.status(404).json({ error: "List not found" });

  const { search } = req.query as { search?: string };

  const subscribers = await db.query.mailingListSubscribers.findMany({
    where: and(
      eq(mailingListSubscribers.mailingListId, list.id),
      ...(search ? [ilike(mailingListSubscribers.email, `%${search}%`)] : []),
    ),
    orderBy: [desc(mailingListSubscribers.addedAt)],
  });

  return res.json(subscribers);
});

// POST /mailing-lists/:id/subscribers — add single or bulk
router.post("/:id/subscribers", auth, async (req, res) => {
  const list = await db.query.mailingLists.findFirst({
    where: and(
      eq(mailingLists.id, req.params.id!),
      eq(mailingLists.organizationId, req.user.orgId),
    ),
  });
  if (!list) return res.status(404).json({ error: "List not found" });

  type SubscriberInput = { email: string; firstName?: string; lastName?: string; tags?: string[] };
  const body = req.body as SubscriberInput | { subscribers: SubscriberInput[] };

  const inputs: SubscriberInput[] = "subscribers" in body ? body.subscribers : [body as SubscriberInput];

  if (inputs.length === 0) return res.status(400).json({ error: "No subscribers provided" });

  const values = inputs
    .filter((s) => s.email?.includes("@"))
    .map((s) => ({
      mailingListId: list.id,
      organizationId: req.user.orgId,
      email: s.email.toLowerCase().trim(),
      firstName: s.firstName ?? null,
      lastName: s.lastName ?? null,
      tags: s.tags ?? [],
    }));

  if (values.length === 0) return res.status(400).json({ error: "No valid emails" });

  // Upsert — ignore duplicates, update status to active if previously unsubscribed
  const inserted = await db
    .insert(mailingListSubscribers)
    .values(values)
    .onConflictDoUpdate({
      target: [mailingListSubscribers.mailingListId, mailingListSubscribers.email],
      set: { status: "active" },
    })
    .returning();

  return res.status(201).json({ added: inserted.length, subscribers: inserted });
});

// PATCH /mailing-lists/:id/subscribers/:subscriberId
router.patch("/:id/subscribers/:subscriberId", auth, async (req, res) => {
  const list = await db.query.mailingLists.findFirst({
    where: and(
      eq(mailingLists.id, req.params.id!),
      eq(mailingLists.organizationId, req.user.orgId),
    ),
  });
  if (!list) return res.status(404).json({ error: "List not found" });

  const { firstName, lastName, tags, status } = req.body as {
    firstName?: string;
    lastName?: string;
    tags?: string[];
    status?: "active" | "unsubscribed";
  };

  const [updated] = await db
    .update(mailingListSubscribers)
    .set({
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(tags !== undefined && { tags }),
      ...(status !== undefined && { status }),
    })
    .where(
      and(
        eq(mailingListSubscribers.id, req.params.subscriberId!),
        eq(mailingListSubscribers.mailingListId, list.id),
      ),
    )
    .returning();

  if (!updated) return res.status(404).json({ error: "Subscriber not found" });
  return res.json(updated);
});

// DELETE /mailing-lists/:id/subscribers/:subscriberId
router.delete("/:id/subscribers/:subscriberId", auth, async (req, res) => {
  const list = await db.query.mailingLists.findFirst({
    where: and(
      eq(mailingLists.id, req.params.id!),
      eq(mailingLists.organizationId, req.user.orgId),
    ),
  });
  if (!list) return res.status(404).json({ error: "List not found" });

  await db
    .delete(mailingListSubscribers)
    .where(
      and(
        eq(mailingListSubscribers.id, req.params.subscriberId!),
        eq(mailingListSubscribers.mailingListId, list.id),
      ),
    );

  return res.json({ deleted: true });
});

export { router as mailingListsRouter };

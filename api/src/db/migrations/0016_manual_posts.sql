-- Allow manual post creation without a plan or agent

ALTER TABLE scheduled_posts
  ALTER COLUMN plan_id DROP NOT NULL,
  ALTER COLUMN agent_id DROP NOT NULL;

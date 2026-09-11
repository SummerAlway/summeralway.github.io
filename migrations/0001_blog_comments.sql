-- 迁移：为留言板增加博客评论 / 回复 / 撤回 / 站主标记字段
-- 仅需对已有数据库执行一次（新库直接用 schema.sql）
ALTER TABLE messages ADD COLUMN post TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN reply_to INTEGER;
ALTER TABLE messages ADD COLUMN secret TEXT;
ALTER TABLE messages ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_messages_post ON messages (post, id DESC);

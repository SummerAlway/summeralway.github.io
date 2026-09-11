-- 留言板 / 博客评论数据库结构（Cloudflare D1 / SQLite）
-- 使用方法见部署文档 DEPLOY.md

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post       TEXT    NOT NULL DEFAULT '',   -- '' = 留言墙；其余为博客文件名（如 hello-world.md）
  name       TEXT    NOT NULL DEFAULT '匿名',
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL,
  reply_to   INTEGER,                       -- 父留言 id（NULL = 顶层留言）
  secret     TEXT,                          -- 作者「撤回」凭据
  is_admin   INTEGER NOT NULL DEFAULT 0     -- 1 = 站主回复
);

CREATE INDEX IF NOT EXISTS idx_messages_post ON messages (post, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_id_desc ON messages (id DESC);

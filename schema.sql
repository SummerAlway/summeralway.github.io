-- 留言板数据库结构（Cloudflare D1 / SQLite）
-- 使用方法见部署文档 DEPLOY.md

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL DEFAULT '匿名',
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_id_desc ON messages (id DESC);

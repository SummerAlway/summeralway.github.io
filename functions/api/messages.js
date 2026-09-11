/**
 * 留言板 API —— Cloudflare Pages Function
 * 路由：/api/messages  （GET 拉取，POST 发布）
 *
 * 依赖：Cloudflare D1 绑定，变量名必须为 DB
 *   - 若未绑定 DB 或数据库未就绪，返回 503，前端会优雅降级（不影响其他功能）
 */

const MAX_NAME = 30;      // 昵称最大长度
const MAX_CONTENT = 500;  // 内容最大长度
const PAGE_SIZE = 100;    // 一次返回的最大条数

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

/* 预检请求 */
export async function onRequestOptions() {
  return json({ ok: true });
}

/* 获取留言列表（按时间倒序） */
export async function onRequestGet({ env }) {
  if (!env || !env.DB) return json({ ok: false, error: "数据库未绑定" }, 503);
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, content, created_at FROM messages ORDER BY id DESC LIMIT ?"
    )
      .bind(PAGE_SIZE)
      .all();
    return json({ ok: true, messages: results || [] });
  } catch (e) {
    return json({ ok: false, error: "数据库未就绪" }, 503);
  }
}

/* 发布留言 */
export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ ok: false, error: "数据库未绑定" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "请求格式错误" }, 400);
  }

  const name = String(body.name || "").trim().slice(0, MAX_NAME) || "匿名";
  const content = String(body.content || "").trim().slice(0, MAX_CONTENT);

  if (!content) return json({ ok: false, error: "留言内容不能为空" }, 400);

  try {
    const info = await env.DB.prepare(
      "INSERT INTO messages (name, content, created_at) VALUES (?, ?, ?)"
    )
      .bind(name, content, new Date().toISOString())
      .run();
    return json({ ok: true, id: info.meta ? info.meta.last_row_id : null });
  } catch (e) {
    return json({ ok: false, error: "数据库未就绪" }, 503);
  }
}

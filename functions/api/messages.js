/**
 * 留言板 API —— Cloudflare Pages Function
 * 路由：/api/messages  （GET 拉取，POST 发布）
 *
 * 依赖：
 *   - Cloudflare D1 绑定，变量名必须为 DB
 *   - 环境变量 TURNSTILE_SECRET_KEY（Cloudflare Turnstile 人机验证，可选；
 *     未配置时自动跳过校验，便于本地开发）
 *   - 若未绑定 DB 或数据库未就绪，返回 503，前端会优雅降级（不影响其他功能）
 */

const MAX_NAME = 30;      // 昵称最大长度
const MAX_CONTENT = 500;  // 内容最大长度
const PAGE_SIZE = 100;    // 一次返回的最大条数
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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

/* 校验 Turnstile 人机验证令牌（未配置密钥时跳过，便于本地开发） */
async function verifyTurnstile(env, token, ip) {
  if (!env || !env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET_KEY);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const res = await fetch(TURNSTILE_VERIFY, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    return !!(data && data.success);
  } catch {
    return false;
  }
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

  /* 人机验证 */
  const turnstileToken = String(body.turnstileToken || "");
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!(await verifyTurnstile(env, turnstileToken, ip))) {
    return json({ ok: false, error: "人机验证未通过，请刷新后重试" }, 403);
  }

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

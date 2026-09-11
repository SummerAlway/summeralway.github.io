/**
 * 留言板 / 博客评论 API —— Cloudflare Pages Function
 * 路由：/api/messages
 *   GET    ?post=<slug>                 拉取某留言墙/某篇文章的留言
 *   POST   { post, name, content, reply_to, turnstileToken }  发布 / 回复
 *   DELETE { id, secret }               作者撤回（凭 secret）；带 x-admin-token 时站主可删任意
 *
 * 依赖：
 *   - D1 绑定，变量名 DB
 *   - 环境变量 TURNSTILE_SECRET_KEY（可选）、ADMIN_PASSWORD、OWNER_NAME（可选）
 */

const MAX_NAME = 30;
const MAX_CONTENT = 500;
const PAGE_SIZE = 300;
const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ADMIN_TTL = 12 * 3600 * 1000; // 后台登录有效期 12 小时

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, x-admin-token",
    },
  });
}

/* ---------- 人机验证 ---------- */
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

/* ---------- 后台令牌（HMAC 签名） ---------- */
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function isAdmin(env, token) {
  if (!env || !env.ADMIN_PASSWORD || !token) return false;
  const i = token.indexOf(".");
  if (i < 0) return false;
  const expStr = token.slice(0, i);
  const sig = token.slice(i + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expect = await hmacHex(String(env.ADMIN_PASSWORD), expStr);
  return safeEqual(expect, sig);
}

/* ---------- 预检 ---------- */
export async function onRequestOptions() {
  return json({ ok: true });
}

/* ---------- 拉取留言 ---------- */
export async function onRequestGet({ request, env }) {
  if (!env || !env.DB) return json({ ok: false, error: "数据库未绑定" }, 503);
  const url = new URL(request.url);
  const post = (url.searchParams.get("post") || "").slice(0, 200);
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, post, name, content, created_at, reply_to, is_admin " +
      "FROM messages WHERE post = ? ORDER BY id ASC LIMIT ?"
    ).bind(post, PAGE_SIZE).all();
    return json({ ok: true, messages: results || [] });
  } catch (e) {
    return json({ ok: false, error: "数据库未就绪" }, 503);
  }
}

/* ---------- 发布 / 回复 ---------- */
export async function onRequestPost({ request, env }) {
  if (!env || !env.DB) return json({ ok: false, error: "数据库未绑定" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "请求格式错误" }, 400);
  }

  const admin = await isAdmin(env, request.headers.get("x-admin-token") || "");
  const post = String(body.post || "").slice(0, 200);
  let name = String(body.name || "").trim().slice(0, MAX_NAME) || "匿名";
  const content = String(body.content || "").trim().slice(0, MAX_CONTENT);

  let replyTo = Number(body.reply_to);
  if (!Number.isInteger(replyTo) || replyTo <= 0) replyTo = null;

  if (!content) return json({ ok: false, error: "内容不能为空" }, 400);

  if (admin) {
    name = String(env.OWNER_NAME || "站主").slice(0, MAX_NAME);
  } else {
    const ip = request.headers.get("CF-Connecting-IP") || "";
    if (!(await verifyTurnstile(env, String(body.turnstileToken || ""), ip))) {
      return json({ ok: false, error: "人机验证未通过，请刷新后重试" }, 403);
    }
  }

  const secret = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    const info = await env.DB.prepare(
      "INSERT INTO messages (post, name, content, created_at, reply_to, secret, is_admin) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(post, name, content, createdAt, replyTo, secret, admin ? 1 : 0).run();
    return json({
      ok: true,
      id: info.meta ? info.meta.last_row_id : null,
      secret: admin ? null : secret,
      is_admin: admin ? 1 : 0,
      name,
      created_at: createdAt,
    });
  } catch (e) {
    return json({ ok: false, error: "数据库未就绪" }, 503);
  }
}

/* ---------- 撤回 / 删除 ---------- */
export async function onRequestDelete({ request, env }) {
  if (!env || !env.DB) return json({ ok: false, error: "数据库未绑定" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "请求格式错误" }, 400);
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: "参数错误" }, 400);

  try {
    if (await isAdmin(env, request.headers.get("x-admin-token") || "")) {
      await env.DB.prepare("DELETE FROM messages WHERE id = ? OR reply_to = ?").bind(id, id).run();
      return json({ ok: true, admin: true });
    }

    const secret = String(body.secret || "");
    if (!secret) return json({ ok: false, error: "缺少撤回凭据" }, 403);
    const row = await env.DB.prepare("SELECT secret FROM messages WHERE id = ?").bind(id).first();
    if (!row || !row.secret || row.secret !== secret) {
      return json({ ok: false, error: "撤回凭据无效" }, 403);
    }
    await env.DB.prepare("DELETE FROM messages WHERE id = ? OR reply_to = ?").bind(id, id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: "数据库未就绪" }, 503);
  }
}

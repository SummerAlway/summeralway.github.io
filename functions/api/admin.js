/**
 * 站主后台 API —— Cloudflare Pages Function
 * 路由：/api/admin
 *   POST { password }        校验后台密码，返回登录令牌
 *   GET  (x-admin-token)     拉取全部留言（用于后台管理）
 *
 * 依赖环境变量：ADMIN_PASSWORD（必须）、OWNER_NAME（可选）
 */

const ADMIN_TTL = 12 * 3600 * 1000; // 12 小时

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-admin-token",
    },
  });
}

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

export async function onRequestOptions() {
  return json({ ok: true });
}

/* 登录 */
export async function onRequestPost({ request, env }) {
  if (!env || !env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "后台密码未配置" }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "请求格式错误" }, 400);
  }
  if (!safeEqual(String(body.password || ""), String(env.ADMIN_PASSWORD))) {
    return json({ ok: false, error: "密码错误" }, 401);
  }
  const exp = Date.now() + ADMIN_TTL;
  const sig = await hmacHex(String(env.ADMIN_PASSWORD), String(exp));
  return json({ ok: true, token: exp + "." + sig, owner: env.OWNER_NAME || "站主" });
}

/* 后台拉取全部留言 */
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(env, request.headers.get("x-admin-token") || ""))) {
    return json({ ok: false, error: "未登录或登录已过期" }, 401);
  }
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, post, name, content, created_at, reply_to, is_admin " +
      "FROM messages ORDER BY post ASC, id ASC LIMIT 1000"
    ).all();
    return json({ ok: true, messages: results || [] });
  } catch (e) {
    return json({ ok: false, error: "数据库未就绪" }, 503);
  }
}

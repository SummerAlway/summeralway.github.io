/* ============================================================
 * 站主后台 js/admin.js
 * 密码登录 → 查看全部留言 → 以站主身份回复 / 删除
 * 后端：/api/admin（登录、列表）、/api/messages（回复、删除）
 * ========================================================== */

(function () {
  const ADMIN_API = "/api/admin";
  const API = "/api/messages";
  const ADMIN_KEY = "mygb.admin";
  const OWNER_KEY = "mygb.owner";

  const esc = (s) => (window.Posts && Posts.escapeHtml) ? Posts.escapeHtml(s) : String(s == null ? "" : s);
  const attr = (s) => (window.Posts && Posts.escapeAttr) ? Posts.escapeAttr(s)
    : String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  const $ = (s) => document.querySelector(s);
  const loginBox = $("#adminLogin");
  const panel = $("#adminPanel");
  const statusEl = $("#adminStatus");
  const pwdEl = $("#adminPwd");
  const ownerEl = $("#adminOwner");
  const listEl = $("#adminList");

  let token = "";
  let owner = "站主";
  let messages = [];

  function getToken() { try { return localStorage.getItem(ADMIN_KEY) || ""; } catch { return ""; } }
  function setToken(t) { try { t ? localStorage.setItem(ADMIN_KEY, t) : localStorage.removeItem(ADMIN_KEY); } catch { /* 忽略 */ } }
  function getOwner() { try { return localStorage.getItem(OWNER_KEY) || "站主"; } catch { return "站主"; } }
  function setOwner(v) { try { localStorage.setItem(OWNER_KEY, v); } catch { /* 忽略 */ } }

  function showStatus(html, kind) {
    statusEl.hidden = false;
    statusEl.className = "cm-status" + (kind ? " " + kind : "");
    statusEl.innerHTML = html;
  }
  function hideStatus() { statusEl.hidden = true; }

  function headers() {
    const h = { "content-type": "application/json" };
    if (token) h["x-admin-token"] = token;
    return h;
  }

  function fmt(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function showLogin() { loginBox.hidden = false; panel.hidden = true; }
  function showPanel() { loginBox.hidden = true; panel.hidden = false; ownerEl.textContent = owner; }

  async function login(pwd) {
    const res = await fetch(ADMIN_API, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pwd }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error((data && data.error) || "登录失败");
    token = data.token;
    owner = data.owner || "站主";
    setToken(token); setOwner(owner);
  }

  async function loadAll() {
    if (!token) { showLogin(); return; }
    listEl.innerHTML = `<div class="cm-empty">正在加载…</div>`;
    try {
      const res = await fetch(ADMIN_API, { headers: headers() });
      if (res.status === 401) { token = ""; setToken(""); showLogin(); showStatus("登录已过期，请重新登录。", "warn"); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error((data && data.error) || "加载失败");
      messages = data.messages || [];
      render();
    } catch (e) {
      listEl.innerHTML = `<div class="cm-empty">加载失败：${esc(e.message)}</div>`;
    }
  }

  function groupLabel(post) { return post ? "📄 " + post : "💬 留言墙"; }

  function render() {
    if (!messages.length) { listEl.innerHTML = `<div class="cm-empty">暂无留言。</div>`; return; }
    const groups = [];
    const idx = {};
    messages.forEach((m) => {
      const k = m.post || "";
      if (idx[k] === undefined) { idx[k] = groups.length; groups.push({ post: k, items: [] }); }
      groups[idx[k]].items.push(m);
    });
    listEl.innerHTML = groups.map((g) => `
      <section class="admin-group">
        <h3 class="admin-group-title">${esc(groupLabel(g.post))} <span class="admin-count">${g.items.length}</span></h3>
        ${g.items.map(adminItem).join("")}
      </section>`).join("");
  }

  function adminItem(m) {
    const isReply = !!m.reply_to;
    return `<article class="cm-item${isReply ? " is-reply" : ""}${m.is_admin ? " is-owner" : ""}" data-id="${m.id}">
      <div class="cm-item-head">
        <span class="cm-name">${esc(m.name)}${m.is_admin ? '<span class="cm-badge">站主</span>' : ""}</span>
        <time class="cm-time">${esc(fmt(m.created_at))} · #${m.id}${isReply ? " · ↩ #" + m.reply_to : ""}</time>
      </div>
      <p class="cm-text">${esc(m.content)}</p>
      <div class="cm-actions">
        <button type="button" class="cm-act ad-reply">回复</button>
        <button type="button" class="cm-act ad-del">删除</button>
      </div>
      <div class="ad-replybox" hidden>
        <textarea class="cm-textarea ad-replytext" rows="2" maxlength="500" placeholder="以站主身份回复…"></textarea>
        <div class="cm-foot"><span></span><span class="ad-reply-btns">
          <button type="button" class="btn btn-outline ad-cancel">取消</button>
          <button type="button" class="btn btn-primary ad-send" data-id="${m.id}" data-post="${attr(m.post)}">发送</button>
        </span></div>
      </div>
    </article>`;
  }

  async function sendReply(id, post, text) {
    const res = await fetch(API, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ post, content: text, reply_to: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error((data && data.error) || "发送失败");
  }

  async function del(id) {
    if (!confirm("确定删除这条留言吗？（其下回复一并删除）")) return;
    const res = await fetch(API, { method: "DELETE", headers: headers(), body: JSON.stringify({ id }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error((data && data.error) || "删除失败");
  }

  /* ---------- 事件 ---------- */
  $("#adminLoginBtn").addEventListener("click", async () => {
    const pwd = pwdEl.value;
    if (!pwd) { showStatus("请输入后台密码。", "warn"); return; }
    try { await login(pwd); hideStatus(); showPanel(); await loadAll(); }
    catch (e) { showStatus(esc(e.message), "warn"); }
  });
  pwdEl.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#adminLoginBtn").click(); });

  $("#adminLogout").addEventListener("click", () => {
    token = ""; setToken(""); pwdEl.value = ""; showLogin(); showStatus("已退出登录。", "ok");
  });
  $("#adminRefresh").addEventListener("click", () => loadAll());

  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const item = btn.closest(".cm-item");
    if (!item) return;

    if (btn.classList.contains("ad-reply")) {
      const box = item.querySelector(".ad-replybox");
      const opening = box.hidden;
      listEl.querySelectorAll(".ad-replybox").forEach((b) => { b.hidden = true; });
      box.hidden = !opening;
      if (opening) box.querySelector(".ad-replytext").focus();
    } else if (btn.classList.contains("ad-cancel")) {
      item.querySelector(".ad-replybox").hidden = true;
    } else if (btn.classList.contains("ad-send")) {
      const text = item.querySelector(".ad-replytext").value.trim();
      if (!text) return;
      btn.disabled = true;
      try { await sendReply(Number(btn.dataset.id), btn.dataset.post, text); showStatus("回复成功 🎉", "ok"); await loadAll(); }
      catch (err) { showStatus("回复失败：" + esc(err.message), "warn"); btn.disabled = false; }
    } else if (btn.classList.contains("ad-del")) {
      try { await del(Number(item.dataset.id)); showStatus("已删除。", "ok"); await loadAll(); }
      catch (err) { showStatus("删除失败：" + esc(err.message), "warn"); }
    }
  });

  /* ---------- 初始化 ---------- */
  $("#year").textContent = new Date().getFullYear();
  const navToggle = $("#navToggle");
  if (navToggle) navToggle.addEventListener("click", () => $("#navLinks").classList.toggle("open"));

  (async function init() {
    token = getToken();
    owner = getOwner();
    if (!token) { showLogin(); return; }
    showPanel();
    await loadAll();
    if (!token) showLogin();
  })();
})();

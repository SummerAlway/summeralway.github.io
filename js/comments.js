/* ============================================================
 * 共享评论 / 留言组件 js/comments.js
 * 供留言墙（guestbook.html）与博客文章（blog.html）复用
 *
 * 用法：
 *   Comments.mount(el, { post: "" | "文件名.md", title: "留言板" })
 *
 * 后端：Cloudflare Pages Function /api/messages（含回复 / 撤回 / 站主回复）
 * 无后端时（如 GitHub Pages）自动优雅降级，不影响页面其他功能
 * ========================================================== */

window.Comments = (function () {
  const API = "/api/messages";
  const SITEKEY = "0x4AAAAAAEwKQLe0GDZSShQd";
  const SECRETS_KEY = "mygb.secrets";   // { messageId: secret }
  const ADMIN_KEY = "mygb.admin";       // 后台登录令牌
  const NAME_KEY = "mygb.name";         // 记住昵称

  const esc = (s) => (window.Posts && Posts.escapeHtml) ? Posts.escapeHtml(s) : String(s == null ? "" : s);
  const attr = (s) => (window.Posts && Posts.escapeAttr) ? Posts.escapeAttr(s)
    : String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

  /* ---------- 本地存储 ---------- */
  function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; } }
  function writeJSON(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch { /* 忽略 */ } }
  function getSecrets() { return readJSON(SECRETS_KEY); }
  function saveSecret(id, secret) { const m = getSecrets(); m[id] = secret; writeJSON(SECRETS_KEY, m); }
  function dropSecret(id) { const m = getSecrets(); delete m[id]; writeJSON(SECRETS_KEY, m); }
  function getToken() { try { return localStorage.getItem(ADMIN_KEY) || ""; } catch { return ""; } }
  function setToken(t) { try { t ? localStorage.setItem(ADMIN_KEY, t) : localStorage.removeItem(ADMIN_KEY); } catch { /* 忽略 */ } }

  function formatTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function fetchTimeout(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms || 10000);
    return fetch(url, Object.assign({ signal: controller.signal }, options || {}))
      .finally(() => clearTimeout(timer));
  }

  /* ---------- Turnstile ---------- */
  function waitTurnstile(cb, tries) {
    tries = tries || 0;
    if (window.turnstile && window.turnstile.render) return cb();
    if (tries > 50) return; // ~5s 后放弃
    setTimeout(() => waitTurnstile(cb, tries + 1), 100);
  }

  /* ---------- 挂载 ---------- */
  function mount(container, opts) {
    opts = opts || {};
    const post = opts.post || "";
    const title = opts.title || "留言";

    container.innerHTML = `
      <div class="cm" data-post="${esc(post)}">
        <div class="cm-adminbar" hidden>
          <span>🔑 站主模式已开启</span>
          <button type="button" class="cm-admin-exit">退出</button>
        </div>
        <div class="cm-status" hidden></div>
        <form class="cm-form">
          <div class="cm-reply-hint" hidden>正在回复 <b class="cm-reply-name"></b> <button type="button" class="cm-cancel">取消</button></div>
          <input type="text" class="cm-input" data-role="name" maxlength="30" placeholder="昵称（可留空）" autocomplete="off">
          <textarea class="cm-textarea" data-role="content" maxlength="500" rows="4" placeholder="写点什么吧…" required></textarea>
          <div class="cm-turnstile" data-role="turnstile"></div>
          <div class="cm-foot">
            <span class="cm-count">0 / 500</span>
            <button type="submit" class="btn btn-primary cm-submit">发布</button>
          </div>
        </form>
        <div class="cm-list">正在加载…</div>
      </div>`;

    const root = container.querySelector(".cm");
    const statusEl = root.querySelector(".cm-status");
    const adminBar = root.querySelector(".cm-adminbar");
    const form = root.querySelector(".cm-form");
    const hintEl = root.querySelector(".cm-reply-hint");
    const replyNameEl = root.querySelector(".cm-reply-name");
    const nameEl = root.querySelector('[data-role="name"]');
    const contentEl = root.querySelector('[data-role="content"]');
    const turnstileEl = root.querySelector('[data-role="turnstile"]');
    const countEl = root.querySelector(".cm-count");
    const submitEl = root.querySelector(".cm-submit");
    const listEl = root.querySelector(".cm-list");
    const exitBtn = root.querySelector(".cm-admin-exit");

    let available = true;
    let replyTo = null;
    let widgetId = null;

    const adminToken = () => getToken();
    const isAdminMode = () => !!getToken();

    try { const n = localStorage.getItem(NAME_KEY); if (n) nameEl.value = n; } catch { /* 忽略 */ }

    function showStatus(html, kind) {
      statusEl.hidden = false;
      statusEl.className = "cm-status" + (kind ? " " + kind : "");
      statusEl.innerHTML = html;
    }
    function hideStatus() { statusEl.hidden = true; }

    function refreshAdminBar() { adminBar.hidden = !isAdminMode(); }

    function initTurnstile() {
      if (!available || widgetId !== null) return;
      waitTurnstile(() => {
        if (widgetId !== null || !window.turnstile) return;
        try {
          widgetId = window.turnstile.render(turnstileEl, { sitekey: SITEKEY, theme: "auto" });
        } catch { /* 已渲染或失败 */ }
      });
    }
    function getToken2() {
      if (!window.turnstile || widgetId === null) return "";
      try { return window.turnstile.getResponse(widgetId) || ""; } catch { return ""; }
    }
    function resetTurnstile() {
      if (window.turnstile && widgetId !== null) { try { window.turnstile.reset(widgetId); } catch { /* 忽略 */ } }
    }

    function disableForm() {
      available = false;
      nameEl.disabled = true;
      contentEl.disabled = true;
      submitEl.disabled = true;
      submitEl.textContent = "服务未连接";
      turnstileEl.hidden = true;
    }

    /* ---------- 渲染列表 ---------- */
    function itemHtml(m, isReply) {
      const canWithdraw = !!(getSecrets()[m.id] || isAdminMode());
      return `<article class="cm-item${isReply ? " is-reply" : ""}${m.is_admin ? " is-owner" : ""}" data-id="${m.id}" data-name="${attr(m.name)}">
        <div class="cm-item-head">
          <span class="cm-name">${esc(m.name)}${m.is_admin ? '<span class="cm-badge">站主</span>' : ""}</span>
          <time class="cm-time">${esc(formatTime(m.created_at))}</time>
        </div>
        <p class="cm-text">${esc(m.content)}</p>
        <div class="cm-actions">
          <button type="button" class="cm-act cm-act-reply">回复</button>
          ${canWithdraw ? '<button type="button" class="cm-act cm-act-withdraw">撤回</button>' : ""}
        </div>
      </article>`;
    }

    function render(messages) {
      const tops = messages.filter((m) => !m.reply_to);
      const byParent = {};
      messages.filter((m) => m.reply_to).forEach((m) => {
        (byParent[m.reply_to] = byParent[m.reply_to] || []).push(m);
      });

      if (!tops.length) {
        listEl.innerHTML = `<div class="cm-empty">💬 还没有留言，来做第一个吧～</div>`;
        return;
      }
      listEl.innerHTML = tops.map((t) => {
        const replies = byParent[t.id] || [];
        return itemHtml(t, false) +
          (replies.length ? `<div class="cm-replies">${replies.map((r) => itemHtml(r, true)).join("")}</div>` : "");
      }).join("");
    }

    async function load() {
      listEl.innerHTML = `<div class="cm-empty">正在加载…</div>`;
      try {
        const url = API + (post ? "?post=" + encodeURIComponent(post) : "");
        const res = await fetchTimeout(url, { headers: { accept: "application/json" } }, 8000);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if (!data || !data.ok) throw new Error((data && data.error) || "服务不可用");
        available = true;
        hideStatus();
        render(data.messages || []);
      } catch (err) {
        available = false;
        disableForm();
        listEl.innerHTML = `<div class="cm-empty">🔌 ${esc(title)}服务未连接</div>`;
        showStatus("留言服务暂未连接。部署到 <b>Cloudflare Pages</b> 并绑定 D1 数据库后即可使用。本页其他功能不受影响。", "warn");
      }
    }

    /* ---------- 提交 ---------- */
    async function submit(e) {
      e.preventDefault();
      if (!available) return;
      const content = contentEl.value.trim();
      if (!content) { showStatus("内容不能为空。", "warn"); return; }

      const admin = isAdminMode();
      let token = "";
      if (!admin) {
        token = getToken2();
        if (window.turnstile && turnstileEl && !token) { showStatus("请先完成上方的人机验证。", "warn"); return; }
      }

      submitEl.disabled = true;
      submitEl.textContent = "发布中…";
      try {
        const headers = { "content-type": "application/json" };
        if (admin) headers["x-admin-token"] = adminToken();
        const name = nameEl.value.trim();
        const res = await fetchTimeout(API, {
          method: "POST",
          headers,
          body: JSON.stringify({ post, name, content, reply_to: replyTo, turnstileToken: token }),
        }, 12000);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error((data && data.error) || "发布失败");

        if (data.secret && data.id) saveSecret(data.id, data.secret);
        try { localStorage.setItem(NAME_KEY, name); } catch { /* 忽略 */ }

        contentEl.value = "";
        updateCount();
        cancelReply();
        resetTurnstile();
        showStatus(isAdminMode() ? "已以站主身份回复 🎉" : "发布成功 🎉", "ok");
        setTimeout(hideStatus, 2000);
        await load();
      } catch (err) {
        showStatus("发布失败：" + esc(err.message || "网络错误") + "。请稍后再试。", "warn");
      } finally {
        submitEl.disabled = false;
        submitEl.textContent = "发布";
      }
    }

    /* ---------- 回复 / 撤回 ---------- */
    function startReply(item) {
      replyTo = Number(item.dataset.id) || null;
      replyNameEl.textContent = item.dataset.name || "";
      hintEl.hidden = false;
      contentEl.placeholder = "回复 " + (item.dataset.name || "") + " …";
      contentEl.focus();
      contentEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    function cancelReply() {
      replyTo = null;
      hintEl.hidden = true;
      contentEl.placeholder = "写点什么吧…";
    }

    async function withdraw(id) {
      const secret = getSecrets()[id];
      const admin = isAdminMode();
      if (!secret && !admin) return;
      if (!window.confirm("确定撤回这条留言吗？（其下的回复也会一并删除）")) return;
      try {
        const headers = { "content-type": "application/json" };
        if (admin && !secret) headers["x-admin-token"] = adminToken();
        const res = await fetchTimeout(API, {
          method: "DELETE",
          headers,
          body: JSON.stringify({ id, secret: secret || "" }),
        }, 10000);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error((data && data.error) || "撤回失败");
        dropSecret(id);
        await load();
      } catch (err) {
        showStatus("撤回失败：" + esc(err.message || "网络错误"), "warn");
      }
    }

    function updateCount() { countEl.textContent = contentEl.value.length + " / 500"; }

    /* ---------- 事件 ---------- */
    form.addEventListener("submit", submit);
    contentEl.addEventListener("input", updateCount);
    root.querySelector(".cm-cancel").addEventListener("click", cancelReply);
    exitBtn.addEventListener("click", () => { setToken(""); refreshAdminBar(); showStatus("已退出站主模式。", "ok"); setTimeout(hideStatus, 1800); load(); });

    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const item = btn.closest(".cm-item");
      if (!item) return;
      if (btn.classList.contains("cm-act-reply")) startReply(item);
      else if (btn.classList.contains("cm-act-withdraw")) withdraw(Number(item.dataset.id));
    });

    /* ---------- 初始化 ---------- */
    refreshAdminBar();
    updateCount();
    initTurnstile();
    load();

    return { reload: load, reset: cancelReply };
  }

  return { mount };
})();

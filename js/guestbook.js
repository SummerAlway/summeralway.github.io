/* ============================================================
 * 留言板 js/guestbook.js
 * 后端：Cloudflare Pages Function (/api/messages) + D1 免费数据库
 * 无 Cloudflare 服务时（如 GitHub Pages）自动降级，不影响其他功能
 * ========================================================== */

(function () {
  const API = "/api/messages";

  const $ = (sel) => document.querySelector(sel);
  const esc = (Posts && Posts.escapeHtml) ? Posts.escapeHtml : (s) => String(s == null ? "" : s);

  const statusEl = $("#gbStatus");
  const form = $("#gbForm");
  const nameEl = $("#gbName");
  const contentEl = $("#gbContent");
  const countEl = $("#gbCount");
  const submitEl = $("#gbSubmit");
  const listEl = $("#gbList");
  const turnstileEl = document.getElementById("gbTurnstile");
  const turnstileWrap = $("#gbTurnstileWrap");

  let available = true; // 后端是否可用

  function fetchTimeout(url, options, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms || 8000);
    return fetch(url, Object.assign({ signal: controller.signal }, options || {}))
      .finally(() => clearTimeout(timer));
  }

  function showStatus(html, kind) {
    statusEl.hidden = false;
    statusEl.className = "gb-status" + (kind ? " " + kind : "");
    statusEl.innerHTML = html;
  }

  function disableForm() {
    available = false;
    nameEl.disabled = true;
    contentEl.disabled = true;
    submitEl.disabled = true;
    submitEl.textContent = "服务未连接";
    if (turnstileWrap) turnstileWrap.hidden = true;
  }

  function formatTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || "";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function renderMessages(messages) {
    if (!messages || !messages.length) {
      listEl.innerHTML = `<div class="empty"><span class="icon">💬</span>还没有留言，来做第一个吧～</div>`;
      return;
    }
    listEl.innerHTML = messages.map((m) => `
      <article class="gb-item">
        <div class="gb-item-head">
          <span class="gb-name">${esc(m.name || "匿名")}</span>
          <time class="gb-time">${esc(formatTime(m.created_at))}</time>
        </div>
        <p class="gb-text">${esc(m.content || "")}</p>
      </article>`).join("");
  }

  async function loadMessages() {
    listEl.innerHTML = `<div class="empty"><span class="icon">💬</span>正在加载留言…</div>`;
    try {
      const res = await fetchTimeout(API, { headers: { accept: "application/json" } }, 8000);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data || !data.ok) throw new Error((data && data.error) || "服务不可用");

      available = true;
      statusEl.hidden = true;
      renderMessages(data.messages);
    } catch (err) {
      // 优雅降级：后端不可用，不影响页面其他功能
      available = false;
      disableForm();
      renderMessages([]);
      listEl.innerHTML = `<div class="empty"><span class="icon">🔌</span>留言板服务未连接</div>`;
      showStatus(
        "留言服务暂未连接。部署到 <b>Cloudflare Pages</b> 并绑定 D1 数据库后即可使用（详见部署文档）。本页其他功能不受影响。",
        "warn"
      );
    }
  }

  async function submitMessage(e) {
    if (e) e.preventDefault();
    if (!available) return;

    const content = contentEl.value.trim();
    if (!content) {
      showStatus("留言内容不能为空。", "warn");
      return;
    }

    const token = (window.turnstile && turnstile.getResponse)
      ? (turnstile.getResponse(turnstileEl) || "")
      : "";
    if (window.turnstile && turnstileEl && !token) {
      showStatus("请先完成上方的人机验证。", "warn");
      return;
    }

    submitEl.disabled = true;
    submitEl.textContent = "发布中…";
    try {
      const res = await fetchTimeout(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nameEl.value.trim(), content, turnstileToken: token }),
      }, 10000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error((data && data.error) || "发布失败");

      contentEl.value = "";
      updateCount();
      if (window.turnstile && turnstile.reset) turnstile.reset(turnstileEl);
      showStatus("留言发布成功 🎉", "ok");
      setTimeout(() => { statusEl.hidden = true; }, 2500);
      await loadMessages();
    } catch (err) {
      showStatus("发布失败：" + esc(err.message || "网络错误") + "。请稍后再试。", "warn");
    } finally {
      submitEl.disabled = false;
      submitEl.textContent = "发布留言";
    }
  }

  function updateCount() {
    countEl.textContent = contentEl.value.length + " / 500";
  }

  /* ---------- 站点信息（页脚/Logo） ---------- */
  async function loadSiteInfo() {
    try {
      const res = await fetchTimeout("data.json", null, 5000);
      if (!res.ok) return;
      const d = await res.json();
      if (d.site) {
        document.title = "留言板 · " + (d.hero && d.hero.name ? d.hero.name : "主页");
        $("#logoText").innerHTML = esc(d.site.logoText) + "<span id=\"logoAccent\">" + esc(d.site.logoAccent) + "</span>";
      }
      if (d.hero && d.hero.name) $("#footerName").textContent = d.hero.name;
    } catch { /* 忽略 */ }
  }

  /* ---------- 事件 ---------- */
  if (contentEl) contentEl.addEventListener("input", updateCount);
  if (form) form.addEventListener("submit", submitMessage);

  $("#navToggle").addEventListener("click", () => {
    $("#navLinks").classList.toggle("open");
  });

  /* ---------- 初始化 ---------- */
  $("#year").textContent = new Date().getFullYear();
  loadSiteInfo();
  loadMessages();
})();

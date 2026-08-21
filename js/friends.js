/* ============================================================
 * 友链页 friends.html
 * 友链数据来自 data.json 的 friends 字段
 * ========================================================== */

const $ = (sel) => document.querySelector(sel);

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms || 8000);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function loadFriends() {
  const grid = $("#friendsGrid");
  try {
    const res = await fetchWithTimeout("data.json", 5000);
    if (!res.ok) throw new Error("data.json 加载失败");
    const d = await res.json();

    // 站点信息
    if (d.site) {
      document.title = (d.friends && d.friends.title ? d.friends.title + " · " : "") + (d.site.title || document.title);
      $("#logoText").innerHTML = Posts.escapeHtml(d.site.logoText) + "<span id=\"logoAccent\">" + Posts.escapeHtml(d.site.logoAccent) + "</span>";
    }
    if (d.hero && d.hero.name) $("#footerName").textContent = d.hero.name;
    if (d.friends) {
      $("#friendsTitle").textContent = d.friends.title || "友链";
      $("#friendsDesc").textContent = d.friends.description || "";
    }

    const items = (d.friends && d.friends.items) || [];
    if (!items.length) {
      grid.innerHTML = `<div class="empty"><span class="icon">🤝</span>还没有友链，去编辑 data.json 添加吧。</div>`;
      return;
    }

    const palettes = ["#2563eb,#8b5cf6", "#0ea5e9,#2563eb", "#8b5cf6,#ec4899", "#10b981,#0ea5e9", "#f59e0b,#ef4444", "#6366f1,#8b5cf6"];
    grid.innerHTML = items.map((f, i) => {
      const [c1, c2] = (palettes[i % palettes.length]).split(",");
      const initial = (f.name || "?")[0].toUpperCase();
      return `
        <a class="friend-card reveal" style="transition-delay:${i * 70}ms" href="${Posts.escapeAttr(f.url)}" target="_blank" rel="noopener">
          <div class="friend-avatar" style="background:linear-gradient(135deg,${c1},${c2})">${Posts.escapeHtml(initial)}</div>
          <div class="friend-info">
            <h3>${Posts.escapeHtml(f.name)}</h3>
            <p>${Posts.escapeHtml(f.description || "")}</p>
          </div>
        </a>`;
    }).join("");

    if (window.refreshReveal) window.refreshReveal();
  } catch (err) {
    grid.innerHTML = `<div class="empty"><span class="icon">⚠️</span>加载失败：${Posts.escapeHtml(err.message)}</div>`;
  }
}

/* ---------- 移动端导航 ---------- */
$("#navToggle").addEventListener("click", () => {
  $("#navLinks").classList.toggle("open");
});

/* ---------- 初始化 ---------- */
$("#year").textContent = new Date().getFullYear();
loadFriends();

/* ============================================================
 * 归档页 archive.html
 * 按年份以时间线展示全部文章（文章加载逻辑见 js/posts.js）
 * ========================================================== */

const $ = (sel) => document.querySelector(sel);

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms || 8000);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function loadSiteInfo() {
  try {
    const res = await fetchWithTimeout("data.json", 5000);
    if (!res.ok) return;
    const d = await res.json();
    if (d.site) {
      document.title = (d.blog && d.blog.title ? d.blog.title + " · 归档 · " : "归档 · ") + (d.site.title || document.title);
      $("#logoText").innerHTML = Posts.escapeHtml(d.site.logoText) + "<span id=\"logoAccent\">" + Posts.escapeHtml(d.site.logoAccent) + "</span>";
    }
    if (d.hero && d.hero.name) $("#footerName").textContent = d.hero.name;
    if (d.blog) {
      $("#archiveTitle").textContent = "归档";
      $("#archiveDesc").textContent = "共 " + (Posts.getCache() ? Posts.getCache().posts.length : 0) + " 篇文章 · 以时间线呈现";
    }
  } catch { /* 忽略 */ }
}

/* 按年份分组（时间线） */
function renderTimeline(posts) {
  const wrap = $("#timeline");

  if (!posts.length) {
    wrap.innerHTML = `
      <div class="empty">
        <span class="icon">📝</span>
        还没有文章，把 Markdown 推到 GitHub 的 <code>posts/</code> 文件夹即可发布。
      </div>`;
    return;
  }

  // 按年份倒序分组
  const groups = [];
  posts.forEach((p) => {
    const year = (p.date && new Date(p.date).getFullYear()) || "未知";
    let g = groups.find((x) => x.year === year);
    if (!g) {
      g = { year, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  });
  groups.sort((a, b) => String(b.year).localeCompare(String(a.year), "zh-CN", { numeric: true }));

  wrap.innerHTML = groups.map((g) => `
    <div class="tl-group reveal">
      <h3 class="tl-year">${Posts.escapeHtml(String(g.year))}</h3>
      <div class="tl-list">
        ${g.items.map((p, i) => `
          <div class="tl-item reveal" style="transition-delay:${i * 80}ms">
            <span class="tl-dot" aria-hidden="true"></span>
            <time class="tl-date" datetime="${Posts.escapeAttr(p.date)}">${Posts.escapeHtml(Posts.formatDate(p.date))}</time>
            <a class="tl-title" href="blog.html?post=${encodeURIComponent(p.file)}">${Posts.escapeHtml(p.title)}</a>
            ${(p.tags || []).length ? `<span class="tl-tags">${(p.tags || []).map((t) => `<span class="tag">${Posts.escapeHtml(t)}</span>`).join("")}</span>` : ""}
          </div>`).join("")}
      </div>
    </div>`).join("");

  // 更新文章总数
  $("#archiveDesc").textContent = "共 " + posts.length + " 篇文章 · 以时间线呈现";
  if (window.refreshReveal) window.refreshReveal();
}

async function init() {
  try {
    const posts = await Posts.loadPosts(false);
    renderTimeline(posts);
  } catch (err) {
    $("#timeline").innerHTML = `
      <div class="empty">
        <span class="icon">⚠️</span>
        加载失败：${Posts.escapeHtml(err.message)}<br>
        可以直接前往
        <a href="https://github.com/SummerAlway/summeralway.github.io/tree/main/posts" target="_blank" rel="noopener">GitHub posts 文件夹</a>
        查看原文。
      </div>`;
  }
}

/* ---------- 移动端导航 ---------- */
$("#navToggle").addEventListener("click", () => {
  $("#navLinks").classList.toggle("open");
});

/* ---------- 初始化 ---------- */
$("#year").textContent = new Date().getFullYear();
loadSiteInfo();
init();

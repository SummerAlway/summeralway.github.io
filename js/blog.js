/* ============================================================
 * 博客页 blog.html
 * 文章来源于 GitHub 仓库 posts/ 文件夹（加载逻辑见 js/posts.js）
 * ========================================================== */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const blogList = $("#blogList");
const postView = $("#postView");

/* 搜索 / 标签筛选状态 */
let allPosts = [];
let keyword = "";
const selectedTags = new Set();

/* 阅读模式：通过 ?post=文件名 在新标签页直接打开某篇文章 */
const directPost = (function () {
  try {
    return new URLSearchParams(window.location.search).get("post");
  } catch {
    return null;
  }
})();

// 阅读页：立即隐藏搜索/列表，只留按钮（同步执行，避免加载期间闪现）
if (directPost) document.body.classList.add("reading-mode");

/* ============================================================
 * 一、站点信息（标题/页脚）来自 data.json
 * ========================================================== */

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
    document.title = (d.blog && d.blog.title ? d.blog.title + " · " : "") + (d.site.title || document.title);
    if (d.blog) {
      $("#blogTitle").textContent = d.blog.title || "博客";
      $("#blogDesc").textContent = d.blog.description || "";
    }
    if (d.site) {
      $("#logoText").innerHTML = Posts.escapeHtml(d.site.logoText) + "<span id=\"logoAccent\">" + Posts.escapeHtml(d.site.logoAccent) + "</span>";
    }
    if (d.hero && d.hero.name) {
      $("#footerName").textContent = d.hero.name;
    }
  } catch { /* 忽略 */ }
}

/* ============================================================
 * 二、渲染
 * ========================================================== */

function renderList(posts) {
  postView.hidden = true;
  blogList.hidden = false;

  if (!posts.length) {
    const filtering = keyword.trim() || selectedTags.size;
    blogList.innerHTML = filtering
      ? `<div class="empty"><span class="icon">🔍</span>没有找到匹配的文章，换个关键词或标签试试。</div>`
      : `<div class="empty"><span class="icon">📝</span>还没有文章，先去发布第一篇吧。</div>`;
    return;
  }

  blogList.innerHTML = posts.map((p) => `
    <article class="post-card reveal" data-file="${Posts.escapeAttr(p.file)}">
      <h3>${Posts.escapeHtml(p.title)}</h3>
      <p>${Posts.escapeHtml(Posts.plainPreview(p.content, 100))}</p>
      <div class="post-meta">
        <time datetime="${Posts.escapeAttr(p.date)}">${Posts.escapeHtml(Posts.formatDate(p.date))}</time>
        <span class="tags">${(p.tags || []).map((t) => `<span class="tag">${Posts.escapeHtml(t)}</span>`).join("")}</span>
      </div>
    </article>`).join("");

  if (window.refreshReveal) window.refreshReveal();

  $$(".post-card").forEach((card) => {
    // 新标签页打开阅读页，占满全屏提升阅读体验
    card.addEventListener("click", () => {
      const url = "blog.html?post=" + encodeURIComponent(card.dataset.file);
      window.open(url, "_blank");
    });
  });

  // 卡片上的标签可点击 → 按该标签筛选
  $$(".post-card .tags .tag").forEach((t) => {
    t.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedTags.clear();
      selectedTags.add(t.textContent);
      applyFilter();
      blogList.scrollIntoView({ behavior: "smooth" });
    });
  });
}

/* ---------- 搜索 / 标签筛选 ---------- */

function getAllTags() {
  const set = new Set();
  allPosts.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
  return [...set].sort();
}

function renderTagChips() {
  const el = $("#tagFilter");
  const tags = getAllTags();
  if (!tags.length) { el.innerHTML = ""; return; }
  el.innerHTML = tags.map((t) =>
    `<button class="tag-chip${selectedTags.has(t) ? " active" : ""}" data-tag="${Posts.escapeAttr(t)}">${Posts.escapeHtml(t)}</button>`
  ).join("");
  el.querySelectorAll(".tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.tag;
      if (selectedTags.has(t)) selectedTags.delete(t);
      else selectedTags.add(t);
      applyFilter();
    });
  });
}

function applyFilter() {
  const kw = keyword.trim().toLowerCase();
  let list = allPosts;

  if (selectedTags.size) {
    list = list.filter((p) => (p.tags || []).some((t) => selectedTags.has(t)));
  }
  if (kw) {
    list = list.filter((p) => {
      const hay = ((p.title || "") + " " + (p.content || "") + " " + (p.tags || []).join(" ")).toLowerCase();
      return hay.includes(kw);
    });
  }

  renderList(list);
  renderTagChips();

  const count = $("#searchCount");
  if (kw || selectedTags.size) {
    count.hidden = false;
    count.textContent = "共 " + list.length + " 篇匹配" + (selectedTags.size ? " · 标签：" + [...selectedTags].join("、") : "");
  } else {
    count.hidden = true;
  }
}

function openPost(posts, file) {
  const post = posts.find((p) => p.file === file);
  if (!post) return;

  document.title = post.title + " · SummerAlway";
  $("#postTitle").textContent = post.title;
  $("#postDate").textContent = Posts.formatDate(post.date);
  $("#postDate").setAttribute("datetime", post.date);
  $("#postTags").innerHTML = (post.tags || [])
    .map((t) => `<span class="tag">${Posts.escapeHtml(t)}</span>`).join("");
  $("#postContent").innerHTML = marked.parse(post.content || "");

  blogList.hidden = true;
  postView.hidden = false;
}

/* 上一篇 / 下一篇（posts 已按日期倒序，index+1 为更早一篇） */
function renderPostNav(posts, currentFile) {
  const idx = posts.findIndex((p) => p.file === currentFile);
  const prev = posts[idx + 1];
  const next = posts[idx - 1];

  const prevEl = $("#prevPost");
  const nextEl = $("#nextPost");
  if (prev) {
    prevEl.hidden = false;
    prevEl.href = "blog.html?post=" + encodeURIComponent(prev.file);
    prevEl.textContent = "← 上一篇：" + prev.title;
  } else {
    prevEl.hidden = true;
  }
  if (next) {
    nextEl.hidden = false;
    nextEl.href = "blog.html?post=" + encodeURIComponent(next.file);
    nextEl.textContent = "下一篇：" + next.title + " →";
  } else {
    nextEl.hidden = true;
  }
}

async function init(force) {
  blogList.hidden = false;
  postView.hidden = true;
  blogList.innerHTML = `<div class="empty"><span class="icon">⏳</span>正在加载文章…</div>`;

  try {
    const posts = await Posts.loadPosts(force);
    if (directPost) {
      // 阅读模式：直接展示该文章，隐藏列表与工具栏
      document.body.classList.add("reading-mode");
      allPosts = posts;
      const post = posts.find((p) => p.file === directPost);
      if (post) {
        openPost(posts, directPost);
        renderPostNav(posts, directPost);
      } else {
        blogList.innerHTML = `
          <div class="empty">
            <span class="icon">⚠️</span>
            未找到文章：${Posts.escapeHtml(directPost)}<br>
            <a href="blog.html">返回文章列表</a>
          </div>`;
      }
    } else {
      allPosts = posts;
      keyword = "";
      selectedTags.clear();
      renderTagChips();
      applyFilter();
    }
  } catch (err) {
    blogList.innerHTML = `
      <div class="empty">
        <span class="icon">⚠️</span>
        加载失败：${Posts.escapeHtml(err.message)}
      </div>`;
  }
}

/* ---------- 事件 ---------- */
$("#btnRefresh").addEventListener("click", () => init(true));

/* 博客页：展开 / 收起全部文章（搜索 + 列表） */
$("#togglePosts").addEventListener("click", () => {
  const wrap = $("#blogContent");
  if (wrap.hidden) {
    wrap.hidden = false;
    renderTagChips();
    applyFilter();
    $("#togglePosts").textContent = "✕ 收起";
  } else {
    wrap.hidden = true;
    $("#togglePosts").textContent = "☰ 展开全部文章";
  }
});

/* 搜索框 */
$("#searchInput").addEventListener("input", (e) => {
  keyword = e.target.value;
  $("#searchClear").hidden = !keyword;
  applyFilter();
});
$("#searchClear").addEventListener("click", () => {
  keyword = "";
  $("#searchInput").value = "";
  $("#searchClear").hidden = true;
  applyFilter();
});

/* ---------- 移动端导航 ---------- */
$("#navToggle").addEventListener("click", () => {
  $("#navLinks").classList.toggle("open");
});

/* ---------- 初始化 ---------- */
$("#year").textContent = new Date().getFullYear();
loadSiteInfo();
init(false);

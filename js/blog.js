/* ============================================================
 * 博客页 blog.html
 * 文章来源于 GitHub 仓库 posts/ 文件夹（加载逻辑见 js/posts.js）
 * ========================================================== */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const blogList = $("#blogList");
const postView = $("#postView");

/* 阅读模式：通过 ?post=文件名 在新标签页直接打开某篇文章 */
const directPost = (function () {
  try {
    return new URLSearchParams(window.location.search).get("post");
  } catch {
    return null;
  }
})();

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
    blogList.innerHTML = `
      <div class="empty">
        <span class="icon">📝</span>
        还没有文章，先去发布第一篇吧。
      </div>`;
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

async function init(force) {
  blogList.hidden = false;
  postView.hidden = true;
  blogList.innerHTML = `<div class="empty"><span class="icon">⏳</span>正在加载文章…</div>`;

  try {
    const posts = await Posts.loadPosts(force);
    if (directPost) {
      // 阅读模式：直接展示该文章，隐藏列表与工具栏
      document.body.classList.add("reading-mode");
      const post = posts.find((p) => p.file === directPost);
      if (post) {
        openPost(posts, directPost);
      } else {
        blogList.innerHTML = `
          <div class="empty">
            <span class="icon">⚠️</span>
            未找到文章：${Posts.escapeHtml(directPost)}<br>
            <a href="blog.html">返回文章列表</a>
          </div>`;
      }
    } else {
      renderList(posts);
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
$("#backBtn").addEventListener("click", () => {
  if (directPost) {
    window.location.href = "blog.html"; // 阅读页返回列表
  } else {
    renderList(Posts.getCache() ? Posts.getCache().posts : []);
  }
});

/* ---------- 移动端导航 ---------- */
$("#navToggle").addEventListener("click", () => {
  $("#navLinks").classList.toggle("open");
});

/* ---------- 初始化 ---------- */
$("#year").textContent = new Date().getFullYear();
loadSiteInfo();
init(false);

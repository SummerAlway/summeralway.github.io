/* ============================================================
 * 博客页 blog.html
 * 文章来源于 GitHub 仓库 posts/ 文件夹，推送即自动发布
 * ========================================================== */

const REPO = "SummerAlway/summeralway.github.io";
const BRANCH = "main";
const POSTS_DIR = "posts";
const CACHE_KEY = "myblog.github.cache";
const CACHE_TTL = 10 * 60 * 1000; // 缓存 10 分钟，避免频繁请求 GitHub API

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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* 带超时的 fetch：防止网络卡住导致"加载中"一直不消失 */
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
      $("#logoText").innerHTML = escapeHtml(d.site.logoText) + "<span id=\"logoAccent\">" + escapeHtml(d.site.logoAccent) + "</span>";
    }
    if (d.hero && d.hero.name) {
      $("#footerName").textContent = d.hero.name;
    }
  } catch { /* 忽略 */ }
}

/* ============================================================
 * 二、从 GitHub posts 文件夹加载文章
 * ========================================================== */

function parseFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  let meta = {};
  let body = text;

  if (match) {
    const block = match[1];
    block.split(/\r?\n/).forEach((line) => {
      const i = line.indexOf(":");
      if (i > 0) {
        const key = line.slice(0, i).trim();
        let val = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
        if (key === "tags") {
          val = val.split(",").map((t) => t.trim()).filter(Boolean);
        }
        meta[key] = val;
      }
    });
    body = text.slice(match[0].length);
  }

  return { meta, body };
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || !Array.isArray(c.posts)) return null;
    return c;
  } catch {
    return null;
  }
}

function saveCache(posts) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), posts }));
  } catch { /* 忽略 */ }
}

async function loadPosts(force) {
  const cache = getCache();
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL) {
    return cache.posts;
  }

  // 1) 列出 posts 文件夹内的 .md 文件（GitHub API）
  let files = [];
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${REPO}/contents/${POSTS_DIR}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = await res.json();
    files = items.filter((i) =>
      i.type === "file" &&
      /\.(md|markdown)$/i.test(i.name) &&
      !/^readme\.md$/i.test(i.name) &&   // 排除说明文件
      !i.name.startsWith("_")            // 排除 _ 开头的草稿
    );
  } catch (err) {
    if (cache) return cache.posts; // 请求失败时退回缓存
    throw new Error("无法读取 GitHub posts 文件夹：" + err.message);
  }

  // 2) 逐个获取原始 Markdown 内容
  const posts = [];
  for (const f of files) {
    try {
      const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${POSTS_DIR}/${encodeURIComponent(f.name)}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;
      const raw = await res.text();
      const { meta, body } = parseFrontMatter(raw);
      posts.push({
        file: f.name,
        title: meta.title || f.name.replace(/\.(md|markdown)$/i, ""),
        date: meta.date || "",
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        content: body,
      });
    } catch { /* 跳过失败的单篇 */ }
  }

  posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  saveCache(posts);
  return posts;
}

/* ============================================================
 * 三、渲染
 * ========================================================== */

function formatDate(str) {
  if (!str) return "未知日期";
  const d = new Date(str);
  if (isNaN(d)) return str;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function plainPreview(md, len) {
  const text = md.replace(/[#*`>\-\!\[]/g, "").replace(/\s+/g, " ").trim();
  return text.length > len ? text.slice(0, len) + "…" : text;
}

function renderList(posts) {
  postView.hidden = true;
  blogList.hidden = false;

  if (!posts.length) {
    blogList.innerHTML = `
      <div class="empty">
        <span class="icon">📝</span>
        posts 文件夹还没有文章。<br>
        把 Markdown 文件推到仓库的 <code>posts/</code> 文件夹即可发布。
      </div>`;
    return;
  }

  blogList.innerHTML = posts.map((p) => `
    <article class="post-card reveal" data-file="${escapeAttr(p.file)}">
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(plainPreview(p.content, 100))}</p>
      <div class="post-meta">
        <time datetime="${escapeAttr(p.date)}">${escapeHtml(formatDate(p.date))}</time>
        <span class="tags">${(p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</span>
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
  $("#postDate").textContent = formatDate(post.date);
  $("#postDate").setAttribute("datetime", post.date);
  $("#postTags").innerHTML = (post.tags || [])
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  $("#postContent").innerHTML = marked.parse(post.content || "");

  blogList.hidden = true;
  postView.hidden = false;
}

async function init(force) {
  blogList.hidden = false;
  postView.hidden = true;
  blogList.innerHTML = `<div class="empty"><span class="icon">⏳</span>正在从 GitHub 加载文章…</div>`;

  try {
    const posts = await loadPosts(force);
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
            未找到文章：${escapeHtml(directPost)}<br>
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
        加载失败：${escapeHtml(err.message)}<br>
        可以直接前往
        <a href="https://github.com/${REPO}/tree/main/${POSTS_DIR}" target="_blank" rel="noopener">GitHub posts 文件夹</a>
        查看原文。
      </div>`;
  }
}

/* ---------- 事件 ---------- */
$("#btnRefresh").addEventListener("click", () => init(true));
$("#backBtn").addEventListener("click", () => {
  if (directPost) {
    window.location.href = "blog.html"; // 阅读页返回列表
  } else {
    renderList(loadPostsFromCache());
  }
});

function loadPostsFromCache() {
  const c = getCache();
  return c ? c.posts : [];
}

/* ---------- 移动端导航 ---------- */
$("#navToggle").addEventListener("click", () => {
  $("#navLinks").classList.toggle("open");
});

/* ---------- 初始化 ---------- */
$("#year").textContent = new Date().getFullYear();
loadSiteInfo();
init(false);

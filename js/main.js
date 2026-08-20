/* ============================================================
 * 个人主页 · 静态博客
 * 功能：
 *   1) 从 data.json（或浏览器本地预览缓存）渲染主页内容
 *   2) 上传 Markdown 文件 → 解析 front-matter → 本地渲染博客
 * ========================================================== */

const STORAGE_KEY = "myblog.posts";   // 博客文章
const CONTENT_KEY = "mypage.content"; // 主页内容预览缓存

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const blogList = $("#blogList");
const postView = $("#postView");
const mdInput = $("#mdInput");
const clearBtn = $("#clearPosts");

/* ============================================================
 * 一、主页内容渲染
 * ========================================================== */

const DEFAULT_DATA = {
  site: { title: "Your Name · Personal Homepage", logoText: "Your", logoAccent: "Name" },
  hero: {
    greeting: "你好，我是",
    name: "Your Name",
    subtitle: "前端工程师 · 独立开发者 · 终身学习者",
    description: "在这里记录我的思考、项目与生活。相信简单是一种美，坚持用代码创造价值。"
  },
  about: { title: "关于我", description: "", cards: [] },
  projects: { title: "项目", description: "", items: [] },
  blog: { title: "博客", description: "上传 Markdown 文件，即可发布一篇新的博客文章。" },
  contact: {
    title: "联系我",
    description: "欢迎交流与合作，期待你的来信。",
    email: "your@email.com",
    links: []
  }
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* 深度合并，保证缺省字段有默认值 */
function mergeData(base, data) {
  const out = { ...base };
  Object.keys(base).forEach((k) => {
    if (typeof base[k] === "object" && base[k] !== null && !Array.isArray(base[k])) {
      out[k] = mergeData(base[k], (data && data[k]) || {});
    } else if (data && data[k] !== undefined) {
      out[k] = data[k];
    }
  });
  return out;
}

/* 读取内容：优先本地预览缓存，否则从 data.json 获取 */
async function loadContent() {
  let data = null;
  const local = localStorage.getItem(CONTENT_KEY);
  if (local) {
    try { data = JSON.parse(local); } catch { data = null; }
  }
  if (!data) {
    try {
      const res = await fetch("data.json", { cache: "no-cache" });
      if (res.ok) data = await res.json();
    } catch { /* 忽略，走默认 */ }
  }
  renderContent(mergeData(DEFAULT_DATA, data || {}));
}

function renderContent(d) {
  document.title = d.site.title;

  $("#logoText").innerHTML = escapeHtml(d.site.logoText) + "<span id=\"logoAccent\">" + escapeHtml(d.site.logoAccent) + "</span>";

  $("#heroGreeting").textContent = d.hero.greeting;
  typeName(d.hero.name);
  $("#heroSubtitle").textContent = d.hero.subtitle;
  $("#heroDesc").textContent = d.hero.description;

  $("#aboutTitle").textContent = d.about.title;
  $("#aboutDesc").textContent = d.about.description;
  $("#aboutGrid").innerHTML = (d.about.cards || []).map((c) => `
    <div class="about-card">
      <h3>${escapeHtml(c.title)}</h3>
      <ul>${(c.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    </div>`).join("");

  $("#projectsTitle").textContent = d.projects.title;
  $("#projectsDesc").textContent = d.projects.description;
  $("#projectsGrid").innerHTML = (d.projects.items || []).map((p) => `
    <a class="project-card" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.description)}</p>
      <span class="tag">${escapeHtml(p.tag)}</span>
    </a>`).join("");

  $("#blogTitle").textContent = d.blog.title;
  $("#blogDesc").textContent = d.blog.description;

  $("#contactTitle").textContent = d.contact.title;
  $("#contactDesc").textContent = d.contact.description;
  const email = d.contact.email;
  const links = (d.contact.links || [])
    .map((l) => `<a href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>`)
    .join("");
  $("#contactLinks").innerHTML = `<a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a>${links}`;

  $("#footerName").textContent = d.hero.name;
}

/* ---------- 姓名打字机效果 ---------- */
let typeTimer = null;

function typeName(name) {
  const el = $("#heroName");
  if (!el) return;
  clearInterval(typeTimer);
  const text = String(name || "");
  el.textContent = "";
  let i = 0;
  typeTimer = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) clearInterval(typeTimer);
  }, 90);
}

/* ============================================================
 * 二、博客：读取 / 保存本地文章
 * ========================================================== */

function loadPosts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

/* ---------- 解析 Markdown 文件 ---------- */
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

/* ---------- 构建文章对象 ---------- */
function buildPost(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const { meta, body } = parseFrontMatter(e.target.result);
      const date = meta.date || new Date(file.lastModified || Date.now()).toISOString();
      const post = {
        id: Date.now() + Math.random().toString(16).slice(2, 8),
        title: meta.title || file.name.replace(/\.(md|markdown)$/i, ""),
        date,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        content: body,
      };
      resolve(post);
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

/* ---------- 渲染：文章列表 ---------- */
function renderList() {
  const posts = loadPosts();
  postView.hidden = true;
  blogList.hidden = false;

  if (!posts.length) {
    blogList.innerHTML = `
      <div class="empty">
        <span class="icon">📝</span>
        还没有文章，点击上方按钮上传你的第一篇 Markdown 吧
      </div>`;
    return;
  }

  const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

  blogList.innerHTML = sorted.map((p) => `
    <article class="post-card" data-id="${p.id}">
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(plainPreview(p.content, 100))}</p>
      <div class="post-meta">
        <time datetime="${escapeAttr(p.date)}">${escapeHtml(formatDate(p.date))}</time>
        <span class="tags">${(p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</span>
      </div>
    </article>`).join("");

  $$(".post-card").forEach((card) => {
    card.addEventListener("click", () => openPost(card.dataset.id));
  });
}

/* ---------- 渲染：单篇文章 ---------- */
function openPost(id) {
  const posts = loadPosts();
  const post = posts.find((p) => p.id === id);
  if (!post) return;

  $("#postTitle").textContent = post.title;
  $("#postDate").textContent = formatDate(post.date);
  $("#postDate").setAttribute("datetime", post.date);
  $("#postTags").innerHTML = (post.tags || [])
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
  $("#postContent").innerHTML = marked.parse(post.content || "");

  blogList.hidden = true;
  postView.hidden = false;
  postView.scrollIntoView({ behavior: "smooth" });
}

/* ---------- 工具函数 ---------- */
function formatDate(str) {
  const d = new Date(str);
  if (isNaN(d)) return str;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function plainPreview(md, len) {
  const text = md.replace(/[#*`>\-\!\[]/g, "").replace(/\s+/g, " ").trim();
  return text.length > len ? text.slice(0, len) + "…" : text;
}

/* ---------- 事件绑定 ---------- */
mdInput.addEventListener("change", async () => {
  const files = [...mdInput.files].filter((f) => /\.(md|markdown)$/i.test(f.name));
  if (!files.length) return alert("请选择 .md 或 .markdown 文件");

  const posts = loadPosts();
  for (const file of files) {
    try {
      posts.push(await buildPost(file));
    } catch (err) {
      alert(`读取 "${file.name}" 失败：${err.message}`);
    }
  }
  savePosts(posts);
  renderList();
  mdInput.value = "";
  alert(`成功发布 ${files.length} 篇文章 🎉`);
});

clearBtn.addEventListener("click", () => {
  if (!loadPosts().length) return;
  if (!confirm("确定要清空本地保存的所有文章吗？")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderList();
});

$("#backBtn").addEventListener("click", () => renderList());

/* ---------- 移动端导航 ---------- */
$("#navToggle").addEventListener("click", () => {
  $("#navLinks").classList.toggle("open");
});

/* ---------- 初始化 ---------- */
$("#year").textContent = new Date().getFullYear();
loadContent();
renderList();

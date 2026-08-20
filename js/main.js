/* ============================================================
 * 个人主页 · 静态博客
 * 功能：上传 Markdown 文件 → 解析 front-matter → 本地渲染
 * ========================================================== */

const STORAGE_KEY = "myblog.posts";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const blogList = $("#blogList");
const postView = $("#postView");
const mdInput = $("#mdInput");
const clearBtn = $("#clearPosts");

/* ---------- 读取 / 保存本地文章 ---------- */
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
        <time datetime="${p.date}">${formatDate(p.date)}</time>
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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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
renderList();

/* ============================================================
 * 共享文章加载器 js/posts.js（blog.html / archive.html 共用）
 * 文章来源于 GitHub 仓库 posts/ 文件夹，推送即自动发布
 * 暴露：window.Posts
 * ========================================================== */

window.Posts = (function () {
  const REPO = "SummerAlway/summeralway.github.io";
  const BRANCH = "main";
  const POSTS_DIR = "posts";
  const CACHE_KEY = "myblog.github.cache";
  const CACHE_TTL = 10 * 60 * 1000; // 缓存 10 分钟，避免频繁请求 GitHub API

  /* ---------- 工具 ---------- */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

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
            val = val.split(/[,，、]/).map((t) => t.trim()).filter(Boolean);
          }
          meta[key] = val;
        }
      });
      body = text.slice(match[0].length);
    }

    return { meta, body };
  }

  /* ---------- 带超时的 fetch ---------- */
  function fetchWithTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms || 8000);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  /* ---------- 缓存 ---------- */
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

  /* ---------- 加载文章 ---------- */
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

  return {
    loadPosts,
    getCache,
    formatDate,
    escapeHtml,
    escapeAttr,
    plainPreview,
    parseFrontMatter,
  };
})();

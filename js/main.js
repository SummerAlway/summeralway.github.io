/* ============================================================
 * 个人主页 index.html
 * 功能：
 *   1) 从 data.json 渲染主页内容
 *   2) 主页姓名打字机效果
 * 博客已独立为 blog.html，文章来自 GitHub posts 文件夹
 * ========================================================== */

const $ = (sel) => document.querySelector(sel);

/* ---------- 主页内容渲染 ---------- */

const DEFAULT_DATA = {
  site: { title: "SummerAlway · Personal Homepage", logoText: "Summer", logoAccent: "Alway" },
  hero: {
    greeting: "你好，我是",
    name: "SummerAlway",
    subtitle: "高中学生 · 开发者 · 终身学习者",
    description: ""
  },
  about: { title: "关于我", description: "", cards: [] },
  projects: { title: "项目", description: "", items: [] },
  contact: {
    title: "联系我",
    description: "欢迎交流与合作，期待你的来信。",
    email: "",
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

/* 读取内容：从 data.json 获取 */
async function loadContent() {
  let data = null;
  try {
    const res = await fetch("data.json", { cache: "no-cache" });
    if (res.ok) data = await res.json();
  } catch { /* 忽略，走默认 */ }
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
  $("#aboutGrid").innerHTML = (d.about.cards || []).map((c, i) => `
    <div class="about-card reveal" style="transition-delay:${i * 90}ms">
      <h3>${escapeHtml(c.title)}</h3>
      <ul>${(c.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    </div>`).join("");

  $("#projectsTitle").textContent = d.projects.title;
  $("#projectsDesc").textContent = d.projects.description;
  $("#projectsGrid").innerHTML = (d.projects.items || []).map((p, i) => `
    <a class="project-card reveal" style="transition-delay:${i * 90}ms" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.description)}</p>
      <span class="tag">${escapeHtml(p.tag)}</span>
    </a>`).join("");

  $("#contactTitle").textContent = d.contact.title;
  $("#contactDesc").textContent = d.contact.description;
  const email = d.contact.email;
  const links = (d.contact.links || [])
    .map((l) => `<a href="${escapeAttr(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>`)
    .join("");
  $("#contactLinks").innerHTML = `<a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a>${links}`;

  $("#footerName").textContent = d.hero.name;

  if (window.refreshReveal) window.refreshReveal();
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

/* ---------- 移动端导航 ---------- */
$("#navToggle").addEventListener("click", () => {
  $("#navLinks").classList.toggle("open");
});

/* ---------- 初始化 ---------- */
$("#year").textContent = new Date().getFullYear();
localStorage.removeItem("mypage.content"); // 清理旧版管理后台留下的预览缓存
loadContent();

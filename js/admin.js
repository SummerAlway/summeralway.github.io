/* ============================================================
 * 站点内容管理后台 admin.html
 * 读取/编辑 data.json 内容，支持本地预览与下载发布
 * ========================================================== */

const CONTENT_KEY = "mypage.content";
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let current = {}; // 当前编辑的数据

/* ---------- 工具 ---------- */
function escapeAttr(str) {
  return String(str == null ? "" : str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, path, val) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
  target[last] = val;
}

function toast(msg) {
  let el = $(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ---------- 加载数据 ---------- */
async function loadData() {
  const local = localStorage.getItem(CONTENT_KEY);
  if (local) {
    try { return JSON.parse(local); } catch { /* ignore */ }
  }
  const res = await fetch("data.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("data.json 加载失败");
  return await res.json();
}

/* ---------- 填充表单 ---------- */
function fillForm(data) {
  current = data;

  $$("[data-path]").forEach((el) => {
    const v = getPath(data, el.dataset.path);
    el.value = v == null ? "" : v;
  });

  renderCards(data.about.cards || []);
  renderProjects(data.projects.items || []);
  renderLinks(data.contact.links || []);
}

/* ---------- 动态列表渲染 ---------- */
function renderCards(cards) {
  $("#aboutCards").innerHTML = cards.map((c, i) => `
    <div class="card-block" data-block="card" data-index="${i}">
      <div class="block-head">
        <span class="block-title">卡片 ${i + 1}</span>
        <button type="button" class="del-btn" data-del>删除</button>
      </div>
      <label>卡片标题
        <input type="text" class="c-title" value="${escapeAttr(c.title)}">
      </label>
      <label>内容（每行一条）
        <textarea class="c-items" rows="4">${escapeAttr((c.items || []).join("\n"))}</textarea>
      </label>
    </div>`).join("");
}

function renderProjects(items) {
  $("#projectList").innerHTML = items.map((p, i) => `
    <div class="card-block" data-block="project" data-index="${i}">
      <div class="block-head">
        <span class="block-title">项目 ${i + 1}</span>
        <button type="button" class="del-btn" data-del>删除</button>
      </div>
      <div class="row-2">
        <label>名称
          <input type="text" class="p-title" value="${escapeAttr(p.title)}">
        </label>
        <label>标签
          <input type="text" class="p-tag" value="${escapeAttr(p.tag)}">
        </label>
      </div>
      <label>描述
        <textarea class="p-desc" rows="2">${escapeAttr(p.description)}</textarea>
      </label>
      <label>链接 URL
        <input type="text" class="p-url" value="${escapeAttr(p.url)}">
      </label>
    </div>`).join("");
}

function renderLinks(links) {
  $("#contactLinks").innerHTML = links.map((l, i) => `
    <div class="card-block" data-block="link" data-index="${i}">
      <div class="block-head">
        <span class="block-title">链接 ${i + 1}</span>
        <button type="button" class="del-btn" data-del>删除</button>
      </div>
      <div class="row-2">
        <label>显示名称
          <input type="text" class="l-label" value="${escapeAttr(l.label)}">
        </label>
        <label>URL
          <input type="text" class="l-url" value="${escapeAttr(l.url)}">
        </label>
      </div>
    </div>`).join("");
}

/* ---------- 收集表单数据 ---------- */
function collect() {
  $$("[data-path]").forEach((el) => {
    setPath(current, el.dataset.path, el.value);
  });

  current.about.cards = $$("#aboutCards .card-block").map((b) => ({
    title: b.querySelector(".c-title").value,
    items: b.querySelector(".c-items").value.split("\n").map((s) => s.trim()).filter(Boolean),
  }));

  current.projects.items = $$("#projectList .card-block").map((b) => ({
    title: b.querySelector(".p-title").value,
    description: b.querySelector(".p-desc").value,
    tag: b.querySelector(".p-tag").value,
    url: b.querySelector(".p-url").value,
  }));

  current.contact.links = $$("#contactLinks .card-block").map((b) => ({
    label: b.querySelector(".l-label").value,
    url: b.querySelector(".l-url").value,
  }));

  return current;
}

function download() {
  const data = collect();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- 事件绑定 ---------- */
$("#btnPreview").addEventListener("click", () => {
  const data = collect();
  localStorage.setItem(CONTENT_KEY, JSON.stringify(data));
  toast("已保存到本浏览器，即将打开主页预览");
  setTimeout(() => window.open("index.html", "_blank"), 600);
});

$("#btnDownload").addEventListener("click", () => {
  download();
  toast("已下载 data.json，替换站点根目录同名文件后推送即可发布");
});

$("#btnDownload2").addEventListener("click", () => {
  download();
  toast("已下载 data.json，替换站点根目录同名文件后推送即可发布");
});

$("#btnReset").addEventListener("click", async () => {
  if (!confirm("恢复默认将清空本浏览器的内容预览缓存，确定吗？")) return;
  localStorage.removeItem(CONTENT_KEY);
  try {
    fillForm(await loadData());
    toast("已恢复线上默认内容");
  } catch (e) {
    alert("加载失败：" + e.message);
  }
});

$("#btnReload").addEventListener("click", async () => {
  try {
    fillForm(await loadData());
    toast("已重新载入线上 data.json");
  } catch (e) {
    alert("加载失败：" + e.message);
  }
});

/* 添加 / 删除动态块 */
$("#addCard").addEventListener("click", () => {
  current.about.cards.push({ title: "新卡片", items: ["第一项"] });
  renderCards(current.about.cards);
});

$("#addProject").addEventListener("click", () => {
  current.projects.items.push({ title: "新项目", description: "项目描述", tag: "标签", url: "#" });
  renderProjects(current.projects.items);
});

$("#addLink").addEventListener("click", () => {
  current.contact.links.push({ label: "新链接", url: "https://" });
  renderLinks(current.contact.links);
});

document.addEventListener("click", (e) => {
  const del = e.target.closest("[data-del]");
  if (!del) return;
  const block = del.closest("[data-block]");
  const type = block.dataset.block;
  const idx = Number(block.dataset.index);
  if (type === "card") {
    current.about.cards.splice(idx, 1);
    renderCards(current.about.cards);
  } else if (type === "project") {
    current.projects.items.splice(idx, 1);
    renderProjects(current.projects.items);
  } else if (type === "link") {
    current.contact.links.splice(idx, 1);
    renderLinks(current.contact.links);
  }
});

/* 侧边菜单高亮 */
function spy() {
  const panels = $$(".panel");
  const pos = window.scrollY + 120;
  let active = panels[0];
  panels.forEach((p) => { if (p.offsetTop <= pos) active = p; });
  $$(".admin-menu a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === "#" + active.id);
  });
}
window.addEventListener("scroll", spy, { passive: true });

/* ---------- 初始化 ---------- */
(async () => {
  try {
    fillForm(await loadData());
  } catch (e) {
    alert("加载 data.json 失败：" + e.message);
  }
})();

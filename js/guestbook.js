/* ============================================================
 * 留言墙 js/guestbook.js
 * 评论 UI 复用 js/comments.js（/api/messages + D1）
 * 无 Cloudflare 服务时自动降级，不影响其他功能
 * ========================================================== */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => (window.Posts && Posts.escapeHtml) ? Posts.escapeHtml(s) : String(s == null ? "" : s);

  /* 站点信息（页脚 / Logo / 标题） */
  async function loadSiteInfo() {
    try {
      const res = await fetch("data.json");
      if (!res.ok) return;
      const d = await res.json();
      if (d.site) {
        document.title = "留言板 · " + (d.hero && d.hero.name ? d.hero.name : "主页");
        $("#logoText").innerHTML = esc(d.site.logoText) + "<span id=\"logoAccent\">" + esc(d.site.logoAccent) + "</span>";
      }
      if (d.hero && d.hero.name) $("#footerName").textContent = d.hero.name;
    } catch { /* 忽略 */ }
  }

  /* 移动端导航 */
  const navToggle = $("#navToggle");
  if (navToggle) navToggle.addEventListener("click", () => $("#navLinks").classList.toggle("open"));

  /* 初始化 */
  $("#year").textContent = new Date().getFullYear();
  loadSiteInfo();
  Comments.mount($("#gbComments"), { post: "", title: "留言板" });
})();

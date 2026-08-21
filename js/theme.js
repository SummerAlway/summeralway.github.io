/* ============================================================
 * 日夜主题切换 js/theme.js
 * 读取：localStorage('mypage.theme') → 系统偏好 prefers-color-scheme
 * ========================================================== */

(function () {
  const KEY = "mypage.theme";
  const root = document.documentElement;

  function apply(theme) {
    root.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  }

  function saved() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }

  function preferred() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(KEY, next); } catch { /* 忽略 */ }
    });
  }

  apply(saved() || preferred());
})();

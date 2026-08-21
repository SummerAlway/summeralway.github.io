/* ============================================================
 * 日夜主题切换 js/theme.js
 * 读取：localStorage('mypage.theme') → 系统偏好 prefers-color-scheme
 * 切换：原生 View Transitions 溶解过渡（优雅、平滑、无跳变）
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
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function switchTheme(next) {
    if (!reduced && document.startViewTransition) {
      document.startViewTransition(() => apply(next));
    } else {
      apply(next);
    }
    try { localStorage.setItem(KEY, next); } catch { /* 忽略 */ }
  }

  if (btn) {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      btn.classList.add("is-switching");
      switchTheme(next);
      setTimeout(() => btn.classList.remove("is-switching"), 600);
    });
  }

  apply(saved() || preferred());
})();

/* ============================================================
 * 日夜主题切换 js/theme.js
 * 读取：localStorage('mypage.theme') → 系统偏好 prefers-color-scheme
 * 切换：全屏遮罩淡入 → 瞬间切换主题 → 淡出（平滑、无渐变跳变）
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
  const overlay = document.getElementById("themeOverlay");
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (btn) {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

      if (overlay && !reduced) {
        // 1) 遮罩淡入（遮住旧主题，此刻背景色 = 旧主题，视觉柔和）
        overlay.style.opacity = "1";
        // 2) 遮罩完全盖住后，瞬间切换主题，避免任何颜色跳变
        setTimeout(() => {
          apply(next);
          btn.classList.add("is-switching");
          // 3) 淡出，露出新主题
          window.requestAnimationFrame(() => {
            overlay.style.opacity = "0";
          });
        }, 220);
        setTimeout(() => btn.classList.remove("is-switching"), 800);
      } else {
        apply(next);
        btn.classList.add("is-switching");
        setTimeout(() => btn.classList.remove("is-switching"), 600);
      }

      try { localStorage.setItem(KEY, next); } catch { /* 忽略 */ }
    });
  }

  apply(saved() || preferred());
})();

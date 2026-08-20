/* ============================================================
 * 页面动效 js/animate.js（主页与博客页共用）
 * 1) 顶部滚动进度条
 * 2) 滚动渐显动画（.reveal → .reveal-visible）
 * 3) 尊重 prefers-reduced-motion
 * ========================================================== */

(function () {
  const reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 滚动进度条 ---------- */
  const progress = document.getElementById("progress");
  function updateProgress() {
    if (!progress) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    progress.style.width = (max > 0 ? (doc.scrollTop / max) * 100 : 0) + "%";
  }
  if (progress) {
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }

  /* ---------- 滚动渐显 ---------- */
  let io = null;
  if (!reduced && "IntersectionObserver" in window) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("reveal-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
  }

  /* 重新扫描并观察 .reveal 元素（动态渲染的卡片也调用此方法） */
  window.refreshReveal = function () {
    const targets = document.querySelectorAll(".reveal:not(.reveal-visible)");
    if (!io) {
      targets.forEach((el) => el.classList.add("reveal-visible"));
      return;
    }
    targets.forEach((el) => io.observe(el));
  };

  window.refreshReveal();
})();

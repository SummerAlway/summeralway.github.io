/* ============================================================
 * 彩虹色鼠标拖尾特效 (canvas, 无依赖)
 * 跟随鼠标绘制一条渐变彩虹丝带，尾端渐隐
 * ========================================================== */

(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.id = "rainbow-trail";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let width = 0;
  let height = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const MAX = 50;
  const points = []; // {x, y}
  const mouse = { x: -100, y: -100, active: false };
  const smooth = { x: -100, y: -100 };
  let hueBase = 0;

  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  window.addEventListener("touchmove", (e) => {
    if (e.touches.length) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });

  window.addEventListener("mouseleave", () => { mouse.active = false; });
  window.addEventListener("touchend", () => { mouse.active = false; });

  function frame() {
    requestAnimationFrame(frame);
    ctx.clearRect(0, 0, width, height);

    // 平滑跟随鼠标
    smooth.x += (mouse.x - smooth.x) * 0.35;
    smooth.y += (mouse.y - smooth.y) * 0.35;

    if (mouse.active) {
      const dx = smooth.x - (points[0] ? points[0].x : -10000);
      const dy = smooth.y - (points[0] ? points[0].y : -10000);
      if (points.length === 0 || dx * dx + dy * dy > 1) {
        points.unshift({ x: smooth.x, y: smooth.y });
        if (points.length > MAX) points.pop();
      } else if (points.length) {
        points.pop(); // 鼠标静止时丝带渐消
      }
    } else if (points.length) {
      points.pop(); // 鼠标离开页面时丝带渐消
    }

    if (points.length < 2) return;

    hueBase = (hueBase + 0.5) % 360;

    // 沿轨迹绘制彩虹丝带（头部红色 → 尾部紫色）
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const f = i / points.length;
      const hue = (hueBase + f * 360) % 360;
      const alpha = (1 - f) * 0.9;
      const lw = Math.max(1, 12 * (1 - f));

      ctx.strokeStyle = "hsla(" + hue + ", 100%, 60%, " + alpha + ")";
      ctx.lineWidth = lw;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // 头部光点
    const head = points[0];
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.arc(head.x, head.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(frame);
})();

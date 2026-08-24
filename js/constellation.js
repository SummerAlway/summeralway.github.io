/* ============================================================
 * 博客页背景特效 js/constellation.js
 * 3D 线框体（立方体/八面体/四面体/棱锥）在两侧缓慢旋转漂浮，
 * 线段两端带光点；鼠标靠近时节点被弹开散落（加速度），
 * 离开后靠弹簧力重新聚合成形。
 * ========================================================== */

(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.id = "constellation";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W = 0, H = 0;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 移动端/平板缩小模型，避免在窄屏上显得过大
    const factor = W < 768 ? 0.5 : (W < 1024 ? 0.72 : 1);
    shapes.forEach((s) => {
      s.hx = s.pos[0] * W;
      s.hy = s.pos[1] * H;
      s.scale = s.baseScale * factor;
    });
  }

  /* ---------- 3D 线框体定义 ---------- */
  const shapes = [
    { pos: [0.10, 0.25], baseScale: 62, spin: [0.16, 0.22, 0.11], nodes: [
      [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
      edges: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]] },
    { pos: [0.90, 0.20], baseScale: 66, spin: [0.20, -0.16, 0.12], nodes: [
      [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
      edges: [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[2,5],[3,4],[3,5]] },
    { pos: [0.08, 0.82], baseScale: 72, spin: [-0.24, 0.18, -0.10], nodes: [
      [1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]],
      edges: [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]] },
    { pos: [0.92, 0.80], baseScale: 62, spin: [0.20, 0.22, -0.14], nodes: [
      [0,1.3,0],[1,-0.5,1],[-1,-0.5,1],[-1,-0.5,-1],[1,-0.5,-1]],
      edges: [[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1]] },
    { pos: [0.16, 0.55], baseScale: 48, spin: [-0.22, 0.26, 0.15], nodes: [
      [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],
      edges: [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]] },
    { pos: [0.84, 0.52], baseScale: 44, spin: [0.28, -0.16, 0.18], nodes: [
      [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
      edges: [[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,4],[2,5],[3,4],[3,5]] }
  ];

  /* ---------- 节点粒子 ---------- */
  const particles = [];
  shapes.forEach((s, si) => {
    s.start = particles.length;
    s.rotX = Math.random() * Math.PI * 2;
    s.rotY = Math.random() * Math.PI * 2;
    s.rotZ = Math.random() * Math.PI * 2;
    s.nodes.forEach((n, ni) => {
      particles.push({ si, ni, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
    });
  });

  /* ---------- 数学工具 ---------- */
  function rotXYZ(p, rx, ry, rz) {
    let { x, y, z } = p;
    let c = Math.cos(rz), s = Math.sin(rz);
    let x1 = x * c - y * s, y1 = x * s + y * c;
    x = x1; y = y1;
    c = Math.cos(ry); s = Math.sin(ry);
    let z1 = z * c - x * s, x2 = z * s + x * c;
    z = z1; x = x2;
    c = Math.cos(rx); s = Math.sin(rx);
    let y2 = y * c - z * s, z2 = y * s + z * c;
    y = y2; z = z2;
    return { x, y, z };
  }

  const F = 420; // 透视焦距

  /* 节点在形状内的静止位置（随旋转漂浮） */
  function restPos(s, ni) {
    const n = s.nodes[ni];
    const r = rotXYZ({ x: n[0] * s.scale, y: n[1] * s.scale, z: n[2] * s.scale }, s.rotX, s.rotY, s.rotZ);
    return { x: s.hx + r.x, y: s.hy + r.y, z: r.z };
  }

  /* 透视投影到屏幕 */
  function project(s, p) {
    const k = F / (F + p.z);
    return { x: s.hx + (p.x - s.hx) * k, y: s.hy + (p.y - s.hy) * k };
  }

  /* ---------- 鼠标 / 触屏 ---------- */
  const mouse = { x: -9999, y: -9999, active: false };
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
  });
  window.addEventListener("mouseleave", () => { mouse.active = false; });
  window.addEventListener("touchmove", (e) => {
    if (e.touches.length) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; mouse.active = true; }
  }, { passive: true });
  window.addEventListener("touchend", () => { mouse.active = false; });

  /* ---------- 主题配色 ---------- */
  function colors() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    // 窄屏减弱线条，避免干扰阅读
    const dim = W < 768 ? 0.5 : (W < 1024 ? 0.72 : 1);
    return dark
      ? { line: "rgba(147,197,253," + (0.42 * dim) + ")", dot: "rgba(147,197,253," + (0.8 * dim) + ")" }
      : { line: "rgba(37,99,235," + (0.34 * dim) + ")", dot: "rgba(37,99,235," + (0.65 * dim) + ")" };
  }

  /* ---------- 物理参数 ---------- */
  const SPRING_K = 0.035; // 弹簧回复力
  const DAMP = 0.90;      // 阻尼
  const MOUSE_R = 160;    // 斥力半径
  const FORCE = 2.4;      // 斥力强度
  const MAXV = 10;        // 速度上限

  resize();
  window.addEventListener("resize", resize);

  // 初始即渲染成形：节点从各自静止位置开始，避免从左上角飞入
  particles.forEach((p) => {
    const r = restPos(shapes[p.si], p.ni);
    p.x = r.x;
    p.y = r.y;
    p.z = r.z;
  });

  let t0 = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    // 阅读模式（?post=）下不绘制
    if (document.body.classList.contains("reading-mode")) return;

    ctx.clearRect(0, 0, W, H);
    const col = colors();
    const dt = Math.min((now - t0) / 16.67, 3) || 1;
    t0 = now;

    // 缓慢旋转漂浮
    shapes.forEach((s) => {
      s.rotX += s.spin[0] * 0.012 * dt;
      s.rotY += s.spin[1] * 0.012 * dt;
      s.rotZ += s.spin[2] * 0.012 * dt;
    });

    // 物理：弹簧回复 + 鼠标斥力 + 积分
    for (const p of particles) {
      const s = shapes[p.si];
      const rest = restPos(s, p.ni);

      p.vx += (rest.x - p.x) * SPRING_K;
      p.vy += (rest.y - p.y) * SPRING_K;
      p.vz += (rest.z - p.z) * SPRING_K;

      if (mouse.active) {
        const sp = project(s, p);
        const dx = sp.x - mouse.x;
        const dy = sp.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_R * MOUSE_R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / MOUSE_R) * FORCE * dt;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
          p.vz += (Math.random() - 0.5) * f * 0.6;
        }
      }

      p.vx *= DAMP; p.vy *= DAMP; p.vz *= DAMP;
      const vm = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
      if (vm > MAXV) { p.vx *= MAXV / vm; p.vy *= MAXV / vm; p.vz *= MAXV / vm; }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }

    // 投影
    const proj = particles.map((p) => project(shapes[p.si], p));

    // 绘制线段
    ctx.lineWidth = 1;
    ctx.strokeStyle = col.line;
    for (const s of shapes) {
      const start = s.start;
      for (const [a, b] of s.edges) {
        const pa = proj[start + a];
        const pb = proj[start + b];
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }

    // 两端光点
    ctx.fillStyle = col.dot;
    for (const pt of proj) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  requestAnimationFrame(frame);
})();

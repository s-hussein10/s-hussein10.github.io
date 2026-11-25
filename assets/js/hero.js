/* =========================================================
   HERO — interactive particle network + MCU/automotive SVG
   ========================================================= */
(function () {
  'use strict';
  const hero = document.getElementById('hero');
  if (!hero) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- shared state ---------- */
  let heroVisible = true;
  new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }).observe(hero);

  const mouse = { x: -9999, y: -9999, nx: 0, ny: 0, inside: false, speed: 0, lx: null, ly: null };
  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.nx = (mouse.x / r.width) * 2 - 1;
    mouse.ny = (mouse.y / r.height) * 2 - 1;
    if (mouse.lx !== null) mouse.speed += Math.hypot(e.clientX - mouse.lx, e.clientY - mouse.ly);
    mouse.lx = e.clientX; mouse.ly = e.clientY;
    mouse.inside = true;
  });
  hero.addEventListener('mouseleave', () => {
    mouse.inside = false; mouse.nx = 0; mouse.ny = 0; mouse.lx = null;
  });

  let burst = 1; // global speed multiplier (decays to 1)

  /* =========================================================
     1) CANVAS PARTICLE "CIRCUIT" NETWORK
     ========================================================= */
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  let W = 0, H = 0, parts = [];
  const ripples = [];
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const rgb = () => document.body.classList.contains('light-mode') ? '180,83,9' : '245,158,11';

  function resizeCanvas() {
    if (!ctx) return;
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.round(Math.min(85, Math.max(30, (W * H) / 17000)));
    parts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3), r: rand(0.6, 1.9)
    }));
  }

  function drawCanvas(dt) {
    ctx.clearRect(0, 0, W, H);
    const c = rgb(), LINK = 115, MR = 160;

    for (const p of parts) {
      p.x += p.vx * dt * burst; p.y += p.vy * dt * burst;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
      if (mouse.inside) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < MR && d > 0) { const f = (1 - d / MR) * 0.9; p.x += dx / d * f; p.y += dy / d * f; }
      }
      for (const rp of ripples) {
        const dx = p.x - rp.x, dy = p.y - rp.y, d = Math.hypot(dx, dy);
        if (Math.abs(d - rp.r) < 18 && d > 0) { p.x += dx / d * 2.2; p.y += dy / d * 2.2; }
      }
    }

    ctx.lineWidth = 0.6;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) {
          ctx.strokeStyle = `rgba(${c},${(1 - Math.sqrt(d2) / LINK) * 0.32})`;
          ctx.beginPath(); // PCB-style L-shaped trace
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      if (mouse.inside) {
        const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (d < MR) {
          ctx.strokeStyle = `rgba(${c},${(1 - d / MR) * 0.75})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${c},.85)`;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += 6 * dt; rp.a -= 0.018 * dt;
      if (rp.a <= 0) { ripples.splice(i, 1); continue; }
      ctx.strokeStyle = `rgba(${c},${rp.a})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); ctx.stroke();
    }
    if (mouse.inside) {
      ctx.fillStyle = `rgba(${c},.9)`;
      ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  hero.addEventListener('click', e => {
    if (e.target.closest('a, button')) return;
    const r = hero.getBoundingClientRect();
    ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 0, a: 0.8 });
    burst = Math.max(burst, 3);
  });

  /* =========================================================
     2) INTERACTIVE SVG
     ========================================================= */
  const svg = document.getElementById('hvSvg');
  let updateSvg = () => {};

  if (svg) {
    const $ = id => document.getElementById(id);
    const term = $('hvTerm'), nameEl = $('hvMcuName'), subEl = $('hvMcuSub');
    const mcuG = $('hvMcu'), pinG = $('hvPins'), pg = $('hvPackets');
    const ledTx = $('hvLedTx'), ledRx = $('hvLedRx');

    /* pins */
    const pins = [];
    for (let i = 0; i < 8; i++) {
      const y = 125 + i * 17;
      pins.push(mk('rect', { x: 243, y, width: 17, height: 10, rx: 1.5, class: 'hv-pin' }, pinG));
      pins.push(mk('rect', { x: 420, y, width: 17, height: 10, rx: 1.5, class: 'hv-pin' }, pinG));
    }
    for (let i = 0; i < 7; i++) {
      const x = 278 + i * 18;
      pins.push(mk('rect', { x, y: 93, width: 10, height: 17, rx: 1.5, class: 'hv-pin' }, pinG));
      pins.push(mk('rect', { x, y: 270, width: 10, height: 17, rx: 1.5, class: 'hv-pin' }, pinG));
    }
    const flash = (el, cls = 'on', ms = 120) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };

    /* traces + packets */
    const traces = [...svg.querySelectorAll('.hv-trace')].map(p => ({
      p, len: p.getTotalLength(), mod: p.dataset.mod, dir: +p.dataset.dir, packets: []
    }));
    traces.forEach(t => {
      for (let k = 0; k < 2; k++) {
        const dir = t.dir === 0 ? (k ? -1 : 1) : t.dir;
        t.packets.push({ t: Math.random(), dir, el: mk('circle', { r: 2.2, class: 'hv-packet' + (dir < 0 ? ' in' : '') }, pg) });
      }
    });

    /* MCU platforms */
    const mcus = [
      { name: 'STM32F401',  sub: 'CORTEX-M4 · 84 MHz · FOTA BOOT' },
      { name: 'ATmega32',   sub: 'AVR · 16 MHz · 32KB FLASH' },
      { name: 'PIC16F877A', sub: 'PIC · 20 MHz · 14KB FLASH' },
      { name: 'ESP32',      sub: 'XTENSA LX6 · 240 MHz · WiFi/BT' },
      { name: 'ATmega2560', sub: 'ARDUINO MEGA · 16 MHz · 256KB' }
    ];
    let mcuIdx = 0;

    /* terminal typewriter */
    let typeTimer = null;
    function typeTerm(s) {
      clearInterval(typeTimer);
      if (reduceMotion) { term.textContent = s; return; }
      let i = 0;
      typeTimer = setInterval(() => {
        i++;
        term.textContent = s.slice(0, i) + (i < s.length ? '█' : '');
        if (i >= s.length) clearInterval(typeTimer);
      }, 16);
    }

    function scramble(el, target) {
      if (reduceMotion) { el.textContent = target; return; }
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let f = 0;
      const run = () => {
        f++;
        el.textContent = target.split('').map((ch, i) =>
          i < (f / 14) * target.length ? ch : chars[Math.floor(Math.random() * chars.length)]).join('');
        if (f < 14) requestAnimationFrame(run); else el.textContent = target;
      };
      run();
    }

    function boot() {
      mcuG.classList.remove('boot');
      void mcuG.getBoundingClientRect();
      mcuG.classList.add('boot');
      burst = 5;
      pins.forEach((p, i) => setTimeout(() => flash(p, 'on', 160), i * 10));
    }

    function switchMcu() {
      mcuIdx = (mcuIdx + 1) % mcus.length;
      scramble(nameEl, mcus[mcuIdx].name);
      subEl.textContent = mcus[mcuIdx].sub;
      typeTerm('> flash ' + mcus[mcuIdx].name + ' ... OK');
      boot();
    }

    let autoTimer = setInterval(autoSwitch, 7000);
    function autoSwitch() { if (!activeMod && heroVisible && !document.hidden) switchMcu(); }
    mcuG.addEventListener('click', e => {
      e.stopPropagation();
      switchMcu();
      clearInterval(autoTimer); autoTimer = setInterval(autoSwitch, 7000);
    });

    /* module hover / click */
    const info = {
      sensors: '> read SENSORS: LM35 · DHT11 · HC-SR04 · MQ-2',
      esp32:   '> ESP32 link up: WiFi · BLE · Blynk cloud',
      can:     '> CAN rx 0x7E8 · OBD-II PID 0x0C (RPM)',
      engine:  '> ENGINE: live RPM via OBD-II signal'
    };
    let activeMod = null;
    const mods = [...svg.querySelectorAll('.hv-mod')];
    function setActive(mod) {
      activeMod = mod;
      mods.forEach(m => m.classList.toggle('on', m.dataset.mod === mod));
      traces.forEach(t => t.p.classList.toggle('on', t.mod === mod));
      typeTerm(mod ? info[mod] : '> ' + mcus[mcuIdx].name + ' running · all systems nominal');
    }
    mods.forEach(m => {
      m.addEventListener('mouseenter', () => setActive(m.dataset.mod));
      m.addEventListener('mouseleave', () => setActive(null));
      m.addEventListener('click', e => { e.stopPropagation(); burst = 4; if (m.dataset.mod === 'engine') rpmKick = 6; });
    });

    /* live readouts */
    const tempEl = $('hvTemp'), canEl = $('hvCanFrame');
    let temp = 27.4, hum = 41;
    setInterval(() => {
      if (!heroVisible) return;
      temp = Math.min(34, Math.max(22, temp + rand(-0.25, 0.25)));
      hum = Math.min(60, Math.max(30, hum + rand(-0.8, 0.8)));
      tempEl.textContent = `TEMP ${temp.toFixed(1)}°C · ${Math.round(hum)}%RH`;
    }, 900);
    const hex = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
    const ids = ['0x7E8', '0x7E0', '0x18F', '0x2A0', '0x0C9', '0x3B4'];
    setInterval(() => {
      if (!heroVisible) return;
      canEl.textContent = `${ids[Math.floor(Math.random() * ids.length)]}  ${hex()} ${hex()} ${hex()} ${hex()}`;
    }, 650);

    /* gauge */
    const G = { cx: 520, cy: 388, r: 40 };
    const pt = (a, r) => { const rad = a * Math.PI / 180; return [G.cx + r * Math.sin(rad), G.cy - r * Math.cos(rad)]; };
    const arc = (a0, a1, r) => {
      const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r);
      return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };
    const gG = $('hvGauge');
    mk('path', { d: arc(-120, 120, G.r), class: 'hv-gauge-track' }, gG);
    mk('path', { d: arc(75, 120, G.r), class: 'hv-gauge-red' }, gG);
    const gFill = mk('path', { d: arc(-120, 120, G.r), class: 'hv-gauge-fill' }, gG);
    const gLen = gFill.getTotalLength();
    gFill.style.strokeDasharray = gLen;
    for (let i = 0; i <= 8; i++) {
      const a = -120 + i * 30, [x0, y0] = pt(a, 29), [x1, y1] = pt(a, 34), [tx, ty] = pt(a, 22);
      mk('line', { x1: x0, y1: y0, x2: x1, y2: y1, class: 'hv-tick' }, gG);
      mk('text', { x: tx, y: ty + 2, class: 'hv-tick-num' }, gG).textContent = i;
    }
    const needle = $('hvNeedle'), rpmEl = $('hvRpm');
    let rpm = 0.8, rpmKick = 0;

    /* parallax layers */
    const layers = [...svg.querySelectorAll('.hv-layer')].map(g => ({ g, d: +g.dataset.depth }));
    let px = 0, py = 0;

    updateSvg = (dt) => {
      // parallax + 3D tilt
      px += (mouse.nx - px) * 0.06 * dt;
      py += (mouse.ny - py) * 0.06 * dt;
      for (const l of layers) l.g.setAttribute('transform', `translate(${(px * 9 * l.d).toFixed(2)} ${(py * 7 * l.d).toFixed(2)})`);
      svg.style.transform = `rotateY(${(px * 8).toFixed(2)}deg) rotateX(${(-py * 6).toFixed(2)}deg)`;

      // packets
      for (const t of traces) {
        const speed = 0.0045 * dt * burst * (t.mod === activeMod ? 2.6 : 1);
        for (const pk of t.packets) {
          pk.t += speed;
          if (pk.t >= 1) {
            pk.t -= 1;
            if (pk.dir < 0) flash(pins[Math.floor(Math.random() * pins.length)]);
            else if (t.mod === 'esp32') flash(ledTx, 'on', 90);
            if (t.mod === 'esp32' && pk.dir < 0) flash(ledRx, 'on', 90);
          }
          const pos = t.p.getPointAtLength((pk.dir > 0 ? pk.t : 1 - pk.t) * t.len);
          pk.el.setAttribute('cx', pos.x.toFixed(1));
          pk.el.setAttribute('cy', pos.y.toFixed(1));
        }
      }

      // RPM gauge driven by mouse speed
      mouse.speed *= Math.pow(0.9, dt);
      rpmKick *= Math.pow(0.95, dt);
      const target = Math.min(7.9, 0.8 + mouse.speed * 0.045 + rpmKick + (burst - 1) * 0.6);
      rpm += (target - rpm) * 0.08 * dt;
      const v = rpm / 8;
      needle.setAttribute('transform', `rotate(${(-120 + 240 * v).toFixed(2)} ${G.cx} ${G.cy})`);
      gFill.style.strokeDashoffset = gLen * (1 - v);
      rpmEl.textContent = rpm.toFixed(1);
      rpmEl.classList.toggle('red', rpm > 6.2);

      burst = 1 + (burst - 1) * Math.pow(0.96, dt);
    };
  }

  /* =========================================================
     MAIN LOOP
     ========================================================= */
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  if (reduceMotion) {
    if (ctx) drawCanvas(0);
    updateSvg(1);
    return;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(3, (now - last) / 16.67);
    last = now;
    if (!heroVisible || document.hidden) return;
    if (ctx) drawCanvas(dt);
    updateSvg(dt);
  }
  requestAnimationFrame(frame);
})();

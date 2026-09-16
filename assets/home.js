/* 홈 "출항" — 별 캔버스 · 단어 분해 · 스크롤 핀. index.html에서만 불러온다. */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var editing = location.hash === '#edit';
  var vh = window.innerHeight;

  /* ---------- 단어 분해: 문장을 <span class="w">로 쪼갠다 ----------
     소스는 평문 그대로 두고 런타임에만 쪼갠다. 편집 모드(#edit)는 innerHTML을 저장하므로
     편집 중에는 쪼개지 않고, 편집 모드로 바뀌면 원문으로 되돌린다. */
  var splitted = [];
  function splitWords(el) {
    var orig = el.innerHTML, words = [], nodes = [];
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(function (t) {
      if (!t.nodeValue.trim()) return;
      var frag = document.createDocumentFragment();
      t.nodeValue.split(/(\s+)/).forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        var s = document.createElement('span'); s.className = 'w'; s.textContent = p;
        frag.appendChild(s); words.push(s);
      });
      t.parentNode.replaceChild(frag, t);
    });
    words.forEach(function (w, i) { w.style.setProperty('--i', i); });
    splitted.push({ el: el, orig: orig });
    el.__w = words;
    return words;
  }
  function restore() {
    splitted.forEach(function (s) { s.el.innerHTML = s.orig; s.el.__w = null; });
    splitted = [];
    html.classList.add('ident-off');
    if (cv) { cv.remove(); cv = null; }
  }
  window.addEventListener('hashchange', function () { if (location.hash === '#edit') restore(); });

  if (!editing) {
    document.querySelectorAll('.hero .giant, .final .giant, .pin .words').forEach(splitWords);
  }
  var ident = document.querySelector('.ident');
  if (ident) ident.addEventListener('animationend', function (e) { if (e.target === ident) ident.remove(); });

  /* ---------- 진단 패널(?debug=1): 뷰포트·가로 넘침 상태를 화면에 표시 ---------- */
  if (/[?&]debug=1/.test(location.search)) {
    var dbg = document.createElement('pre');
    dbg.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;margin:0;padding:10px;background:rgba(0,0,0,.85);color:#7CFC9A;font:11px/1.5 Menlo,monospace;white-space:pre-wrap;border:1px solid #444;border-radius:8px;pointer-events:none';
    document.body.appendChild(dbg);
    var tick = function () {
      var vv = window.visualViewport, over = [];
      document.querySelectorAll('body *').forEach(function (el) {
        if (over.length >= 10 || el === dbg) return;
        var r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
        var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') return;
        if (r.left < -1 || r.right > window.innerWidth + 1) over.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' L' + Math.round(r.left) + ' R' + Math.round(r.right));
      });
      dbg.textContent = 'UA ' + navigator.userAgent.slice(0, 90) + '\ninner ' + window.innerWidth + 'x' + window.innerHeight + '  dpr ' + window.devicePixelRatio + '  scrollX ' + window.scrollX + '  docW ' + document.documentElement.scrollWidth + '  clientW ' + document.documentElement.clientWidth +
        (vv ? '\nvisualViewport w ' + Math.round(vv.width) + ' scale ' + vv.scale.toFixed(3) + ' offsetLeft ' + Math.round(vv.offsetLeft) + ' pageLeft ' + Math.round(vv.pageLeft) : '') +
        '\nhtml ' + document.documentElement.className + '  stars ' + !!document.getElementById('stars') +
        '\n넘침(' + over.length + '): ' + (over.join(' | ') || '없음');
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- 스크롤 핀: 진행도로 단어를 켜고, 배를 띄운다 ---------- */
  var pins = Array.prototype.slice.call(document.querySelectorAll('.pin'));
  function progress(sec) {
    var r = sec.getBoundingClientRect(), total = r.height - vh;
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, -r.top / total));
  }
  function updatePins() {
    pins.forEach(function (sec) {
      var p = progress(sec), ship = sec.classList.contains('ship');
      if (ship) sec.style.setProperty('--p', p.toFixed(3));
      var all = [];
      sec.querySelectorAll('.words').forEach(function (g) { (g.__w || []).forEach(function (w) { all.push(w); }); });
      if (!all.length) return;
      var lead = ship ? 0.3 : 0.06;                       // 배 섹션은 이미지가 먼저 떠오르고 글자는 뒤에
      var q = Math.max(0, Math.min(1, (p - lead) / (0.82 - lead)));
      var k = Math.round(q * all.length);
      all.forEach(function (w, i) { w.classList.toggle('on', i < k); });
    });
  }
  var fin = document.querySelector('.final');
  if (fin) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { fin.classList.add('in'); io.disconnect(); } });
      }, { threshold: 0.3 });
      io.observe(fin);
    } else fin.classList.add('in');
  }


  /* ---------- 밤바다(WebGL): 잔물결 위에 수평선 잔광과 보물의 황금빛이 비친다. 인트로 동안만 돈다 ---------- */
  (function ocean() {
    var sea = document.querySelector('.ident-sea .sea-gl');
    if (!sea || reduced || editing || html.classList.contains('ident-seen')) return;
    var gl = sea.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) return;
    var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var fs = 'precision mediump float;uniform vec2 r;uniform float t;uniform float g;' +
      'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}' +
      'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}' +
      'void main(){vec2 uv=gl_FragCoord.xy/r;float depth=1.-uv.y;' +
      'vec2 p=vec2((uv.x-.5)*(1.+depth*3.)*6.,uv.y*40./(depth+.15));' +
      'float n=fbm(p+vec2(t*.15,t*.35));float n2=fbm(p*2.1-vec2(t*.1,t*.5));float rip=n*.6+n2*.4;' +
      'float hz=exp(-depth*7.);vec3 water=vec3(.012,.010,.012);vec3 warm=vec3(1.,.62,.30);' +
      'float refl=hz*(.05+.30*pow(rip,2.));' +
      'float dx=(uv.x-.22)/(.05+.12*g);float col=exp(-dx*dx)*exp(-depth*2.2)*(.6+.8*pow(rip,1.5))*g;' +
      'vec3 gold=vec3(1.,.82,.45);vec3 c=water+warm*refl*.5+gold*col*1.6;' +
      'float sp=smoothstep(.80,.96,rip)*exp(-depth*3.)*.22*(.4+g);c+=vec3(1.,.9,.7)*sp;' +
      'gl_FragColor=vec4(c,1.);}';
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return;
    var prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uG = gl.getUniformLocation(prog, 'g');
    html.classList.add('seagl');   // 캔버스 클래스(.sea-gl)와 이름을 달리해 querySelector 혼동 방지
    var start = performance.now();
    function size() {
      var rect = sea.getBoundingClientRect(), s = 0.6;   // 저해상 렌더(가벼움, 물결엔 충분)
      sea.width = Math.max(2, Math.round(rect.width * s)); sea.height = Math.max(2, Math.round(rect.height * s));
      gl.viewport(0, 0, sea.width, sea.height);
    }
    size(); window.addEventListener('resize', size);
    (function draw(now) {
      if (!document.body.contains(sea)) return;              // 인트로가 DOM에서 빠지면 종료
      var t = (now - start) / 1000, g = Math.max(0, Math.min(1, (t - 2.2) / 1.2));   // 2.2s부터 황금빛
      gl.uniform2f(uR, sea.width, sea.height); gl.uniform1f(uT, t); gl.uniform1f(uG, g);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(draw);
    })(start);
  })();

  /* ---------- 별 캔버스: 아이덴트 직후 워프 → 느린 항해, 스크롤하면 가속 ---------- */
  var cv = document.getElementById('stars');
  var boost = 0, lastY = window.scrollY, queued = false;
  function onScroll() {
    var y = window.scrollY;
    boost = Math.min(1.8, boost + Math.abs(y - lastY) / vh * 1.4);
    lastY = y;
    if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; updatePins(); }); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  updatePins();

  if (!cv) return;
  // 주소 끝에 ?stars=0 이면 별을 끈다(비교·진단용). 그 외엔 모든 기기에서 켠다.
  var starsOff = /[?&]stars=0/.test(location.search);
  if (reduced || editing || starsOff) { cv.remove(); cv = null; return; }

  var ctx = cv.getContext('2d'), W, H, cx, cy, stars = [];
  var mobile = window.matchMedia('(max-width: 639px)').matches;
  function mk(far) {
    return { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: far ? 1 : Math.random() * .95 + .05,
             o: Math.random() * .55 + .45, orange: Math.random() < .12, px: null, py: null };
  }
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = window.innerWidth; H = window.innerHeight; vh = H;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2;
    var n = Math.max(180, Math.min(520, Math.round(W * H / 3000)));
    while (stars.length < n) stars.push(mk(false));
    stars.length = n;
    stars.forEach(function (s) { s.px = s.py = null; });
  }
  resize();
  window.addEventListener('resize', resize);

  var t0 = performance.now(), last = t0, running = !document.hidden;
  var seen = html.classList.contains('ident-seen');
  var warpAt = seen ? 0 : 3700, warpDur = seen ? 1300 : 2000;   // 보물의 빛이 터지는 3.7s에 워프 시작, 글자(4.3s)가 뜨면서 잦아든다   // ms — 일출 빛이 번질 때 워프가 시작된다
  function speedAt(now) {
    var t = now - t0, w = 0;
    if (t > warpAt) {
      var u = (t - warpAt) / warpDur;
      if (u < 1) w = (u < .22 ? u / .22 : Math.pow(1 - (u - .22) / .78, 2.2)) * 3.2;
    }
    return .05 + w + boost;
  }
  function frame(now) {
    if (!running) return;
    var dt = Math.min(.05, (now - last) / 1000); last = now;
    var sp = speedAt(now);
    boost *= Math.pow(.03, dt);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z -= sp * dt * .38;
      var k = 1.15 / s.z, sx = cx + s.x * cx * k, sy = cy + s.y * cy * k;
      if (s.z <= .03 || sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) { stars[i] = mk(true); continue; }
      var a = s.o * Math.min(1, (1 - s.z) * 2.1);
      var lw = (1 - s.z) * 2.1 + .45;
      ctx.strokeStyle = s.orange ? 'rgba(255,138,61,' + a + ')' : 'rgba(244,242,237,' + a + ')';
      ctx.lineWidth = lw;
      ctx.beginPath();
      if (s.px === null) ctx.moveTo(sx - .01, sy); else ctx.moveTo(s.px, s.py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      s.px = sx; s.py = sy;
    }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });
  requestAnimationFrame(frame);
})();

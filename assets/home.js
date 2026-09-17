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


  /* ---------- 빛의 수평선(WebGL): 빛점 → 수평선 → 빛줄기 확산 → 잔광. 홈에 머무는 동안 계속 산다 ----------
     t(초)로 장면을 계산한다. 재방문(ident-seen)은 잔광부터, 편집 모드·모션 축소는 정지 화면. */
  (function aurora() {
    var cv = document.getElementById('aurora'); if (!cv) return;
    var still = reduced || editing;
    var gl = cv.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
    if (!gl) { cv.remove(); return; }
    var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var fs = 'precision highp float;uniform vec2 r;uniform float t;uniform float amb;' +
      'float hash(float n){return fract(sin(n)*43758.5453);}' +
      'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);float a=hash(i.x+i.y*57.),b=hash(i.x+1.+i.y*57.),c=hash(i.x+(i.y+1.)*57.),d=hash(i.x+1.+(i.y+1.)*57.);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}' +
      'void main(){vec2 uv=gl_FragCoord.xy/r;float h0=.38;float dy=uv.y-h0;float cx=abs(uv.x-.5);' +
      'float tl=smoothstep(.35,1.25,t);float ts=smoothstep(1.2,2.7,t);float ta=smoothstep(2.5,3.9,t);' +
      // 백열 빛점 → 수평선(끝이 부드럽게 사라짐)
      'float ext=pow(tl,.55)*.66+.004;float xm=smoothstep(ext,ext-.14,cx);' +
      'float lw=mix(.0016,.0009,ts);float core=exp(-pow(dy/lw,2.))*xm*smoothstep(.2,.5,t)*(1.-ta*.92);' +
      'float bloomL=exp(-abs(dy)/(.015+.10*ts))*xm*tl*.5*(1.-ta*.75);' +
      // 빛줄기 16개: 길이·두께·밝기·시차가 제각각, 빛이 옆으로 흐르는 질감, 수평선 쪽으로 남는 잔상
      'float bands=0.;for(int i=0;i<16;i++){float fi=float(i);float r1=hash(fi*7.31),r2=hash(fi*3.7),r3=hash(fi*5.1),r4=hash(fi*2.3),r5=hash(fi*9.1);' +
      'float dl=r5*.55;float tsb=smoothstep(1.2+dl,2.6+dl,t);float dir=mod(fi,2.)<1.?1.:-1.;' +
      'float spread=dir*(.03+.34*pow(r1,1.4))*pow(tsb,.6);float yi=h0+spread*(1.-ta*.82)+.010*sin(t*(.4+r1)+fi);' +
      'float th=mix(.0025,.05,r2*r2)*(1.+ta*1.6);float br=(.12+.6*r3)*(1.-.6*r2*r2);' +
      'float xc=.5+(r4-.5)*.5;float xe=.22+.5*r1;float xmask=smoothstep(xe,xe-.34,abs(uv.x-xc));' +
      'float tex=.35+.65*vnoise(vec2(uv.x*4.+fi*3.+t*.35*dir,fi*1.7));' +
      'float d=(uv.y-yi)/th;float g=exp(-d*d);float d2=(uv.y-(yi-(yi-h0)*.18))/(th*2.6);g+=.28*exp(-d2*d2);' +
      'bands+=br*g*xmask*tex*tsb;}' +
      'bands*=(1.-ta*.68)*(1.-.45*pow(cx*2.,2.));' +
      // 잔광(지속): 수평선에 오로라처럼 숨 쉬는 빛 — 글자 아래에 머문다
      'float amb1=exp(-abs(dy)/.085)*(.20+.22*vnoise(vec2(uv.x*2.5+t*.05,t*.07)))*ta*amb;' +
      'amb1+=exp(-abs(dy)/.30)*.055*ta*amb+exp(-abs(dy)/.011)*.22*ta*amb*(.6+.4*vnoise(vec2(uv.x*9.+t*.2,t*.3)));' +
      'amb1*=(1.-.35*pow(cx*2.,2.));' +
      // 갈라지는 순간의 플래시
      'float flash=exp(-pow((t-1.3)/.16,2.))*1.2*exp(-abs(dy)/.22);' +
      'float I=core*3.+bloomL+bands+amb1+flash;' +
      'float I1=1.-exp(-I);vec3 deep=vec3(.40,.11,.03),org=vec3(.93,.43,.13),lt=vec3(1.,.64,.32),hot=vec3(1.,.95,.88);' +
      'vec3 c=mix(deep,org,smoothstep(0.,.35,I1));c=mix(c,lt,smoothstep(.35,.75,I1));c=mix(c,hot,smoothstep(.78,1.,I1));c*=I1;' +
      'c*=1.-.35*pow(length((uv-.5)*vec2(1.,1.3)),1.6);' +
      'gl_FragColor=vec4(c,1.);}';
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) { cv.remove(); return; }
    var prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.remove(); return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't'), uA = gl.getUniformLocation(prog, 'amb');
    html.classList.add('aurora');
    var scale = window.matchMedia('(max-width: 639px)').matches ? .55 : .6;
    function size() { cv.width = Math.max(2, Math.round(innerWidth * scale)); cv.height = Math.max(2, Math.round(innerHeight * scale)); gl.viewport(0, 0, cv.width, cv.height); }
    size(); window.addEventListener('resize', size);
    var start = performance.now(), offset = (html.classList.contains('ident-seen') || still) ? 4.2 : 0;   // 재방문·정지: 잔광부터
    var running = !document.hidden;
    function draw(now) {
      if (!running) return;
      var t = offset + (now - start) / 1000;
      var amb = Math.max(0, Math.min(1, 1 - window.scrollY / (innerHeight * .9)));   // 스크롤하면 잔광이 잦아든다
      gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, t); gl.uniform1f(uA, amb);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (still) return;                                       // 정지 화면은 한 프레임만
      if (amb <= 0 && t > 6) { running = false; return; }      // 홈 아래로 내려가면 쉰다
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    window.addEventListener('scroll', function () { if (!running && !still && !document.hidden && window.scrollY < innerHeight) { running = true; requestAnimationFrame(draw); } }, { passive: true });
    document.addEventListener('visibilitychange', function () { running = !document.hidden && !still; if (running) requestAnimationFrame(draw); });
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
  var warpAt = seen ? 0 : 1250, warpDur = seen ? 1300 : 1600;   // 빛이 갈라지는 1.25s에 별도 함께 흩어진다
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

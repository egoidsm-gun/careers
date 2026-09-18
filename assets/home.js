/* 홈 "출항" — 별 캔버스 · 단어 분해 · 스크롤 핀. index.html에서만 불러온다. */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var editing = location.hash === '#edit';
  var vh = window.innerHeight;
  var TF = 1.6;   // 빛이 갈라지는(플래시) 시각(초). 셰이더 타임라인·별 워프가 이 값을 기준으로 잡히고, site.css의 --tf(같은 값)·--t0(TF+1.48)도 맞춰야 한다
  function T(x) { return (TF + x).toFixed(2); }

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
  var crewStarted = false;
  function updatePins() {
    pins.forEach(function (sec) {
      var p = progress(sec), ship = sec.classList.contains('ship');
      if (ship) sec.style.setProperty('--p', p.toFixed(3));
      // 크루 행렬은 승선 구간이 화면을 붙잡고 조금 지난 뒤에 — 화면이 멈춰 있는 동안 벌어져야 시선이 모인다
      // 핀이 꺼진 화면(짧은 세로)에서는 progress()가 항상 1이라 섹션이 눈에 들어왔는지도 함께 본다
      if (sec.classList.contains('final') && !crewStarted && p > .12 && sec.getBoundingClientRect().top < vh * .5) {
        crewStarted = true;
        if (set2 && !reduced && !editing) crewBoarding(sec.querySelector('.btns'), sec);
      }
      var all = [];
      sec.querySelectorAll('.words').forEach(function (g) { (g.__w || []).forEach(function (w) { all.push(w); }); });
      if (!all.length) return;
      var lead = ship ? 0.3 : 0.06;                       // 배 섹션은 이미지가 먼저 떠오르고 글자는 뒤에
      var q = Math.max(0, Math.min(1, (p - lead) / (0.82 - lead)));
      var k = Math.round(q * all.length);
      all.forEach(function (w, i) { w.classList.toggle('on', i < k); });
    });
  }
  /* 승선(2026-09-17): 마지막 구간에 닿는 순간 별이 한 번 빨라지고(출항 때처럼), 이어서 CSS가 수평선의 빛을 버튼 아래에 다시 켠다.
     관측 대상은 섹션이 아니라 첫 글자 — 섹션은 위아래 여백이 커서 threshold로 잡으면 글자가 화면에 들어오기 한참 전에 애니메이션이 끝나 버린다. */
  /* 승선 2안(?set=2): 크루가 빛이 되어 버튼 아래에서 줄지어 올라와 승선구로 들어간다. 한 명씩 도착할수록 배가 밝아지고, 행렬이 끝나면 잔광만 남는다. */
  var set2 = !/[?&]set=1/.test(location.search);   // 2번(크루 승선)이 기본. `?set=1`이면 1번(빛의 귀환)으로 되돌려 본다
  if (set2) html.classList.add('set2');
  function crewBoarding(host, fin) {
    var cv = document.createElement('canvas'); cv.className = 'crewcv'; cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    var btn = fin.querySelector('.btn');
    var ctx = cv.getContext('2d'), W, H, dpr, mob = window.matchMedia('(max-width: 639px)').matches;
    var slow = parseFloat((/[?&]slow=([\d.]+)/.exec(location.search) || [])[1]) || 1;   // 진단: ?slow=4 면 4배 느리게
    var deckY, deckW, hullH, shipL;                                        // 갑판 y·배 폭·배 높이·선미 x — 캔버스 좌표(캔버스는 .btns 중앙에 겹쳐 있다)
    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.min(1100, innerWidth * .96); H = mob ? 300 : 380;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var keep = btn.style.transform; btn.style.transform = '';             // 흔들리는 중에 재면 그만큼 어긋난다
      var br = btn.getBoundingClientRect(), hr = host.getBoundingClientRect();
      deckY = H / 2 + (br.top - (hr.top + hr.height / 2)); deckW = br.width; hullH = br.height;
      shipL = W / 2 + (br.left - (hr.left + hr.width / 2));
      btn.style.transform = keep;
    }
    size(); window.addEventListener('resize', size);
    var N = mob ? 18 : 30, P = [], i, r;
    for (i = 0; i < N; i++) {
      var side = i % 2 ? 1 : -1; r = .30 + Math.random() * .34;
      P.push({ sx: .5 + side * r, sy: .80 + Math.random() * .40,            // 버튼 아래 좌우에서 출발 — 글자 위를 지나지 않는다
               slot: (i + .5) / N + (Math.random() - .5) * .5 / N,          // 갑판에서 설 자리 — 선미에서 뱃머리 앞까지 고르게, 뱃머리 끝은 비워 둔다
               arc: side * (.05 + Math.random() * .09),
               d: (140 + i * 48 + Math.random() * 80) * slow, dur: (880 + Math.random() * 520) * slow,
               w: 1.2 + Math.random() * 1.7,
               h: (mob ? 9 : 11) + Math.random() * (mob ? 4 : 5), lean: (Math.random() - .5) * .16, ph: Math.random() * 6.283 });
    }
    var last = P.reduce(function (m, p) { return Math.max(m, p.d + p.dur); }, 0);
    var HORN = last + 260, ENG = HORN + 700;                               // 마지막 크루가 발을 딛고 한 박자 뒤 뱃고동 → 이어서 시동
    function spot(p) { return shipL + deckW * (.075 + p.slot * .755); }
    function at(p, u) {                                                    // 완만한 호를 그리며 자기 자리로
      var sx = p.sx * W, sy = p.sy * H, tx = spot(p), ty = deckY;
      var cx = (sx + tx) / 2 - (ty - sy) * p.arc, cy = (sy + ty) / 2 + (tx - sx) * p.arc;
      var k = 1 - u;
      return [k * k * sx + 2 * k * u * cx + u * u * tx, k * k * sy + 2 * k * u * cy + u * u * ty];
    }
    /* 배의 자세 — 시동이 걸리면 물결(느린 상하·기울기)에 엔진의 미세 진동이 얹히고 뱃머리가 살짝 든다.
       버튼(CSS transform)과 갑판 위 모든 것(캔버스)이 정확히 같은 자세를 써야 같이 흔들린다 — 그래서 배 쪽도 CSS 애니메이션이 아니라 여기서 준다. */
    var sh = { x: 0, y: 0, a: 0 };
    function tf(x, y) {                                                    // 배에 붙은 점 → 지금 자세의 화면 위치(버튼 중심 기준 회전 = CSS transform-origin과 동일)
      var cx = shipL + deckW / 2, cy = deckY + hullH / 2, dx = x - cx, dy = y - cy, c = Math.cos(sh.a), s = Math.sin(sh.a);
      return [cx + dx * c - dy * s + sh.x, cy + dx * s + dy * c + sh.y];
    }
    function person(x, y, h, a, tilt) {                                    // 갑판에 선 크루 — 머리 + 어깨에서 발로 좁아지는 몸
      var w = h * .34;
      ctx.save(); ctx.translate(x, y); if (tilt) ctx.rotate(tilt);
      ctx.fillStyle = 'rgba(255,228,198,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(0, -h + w * .6, w * .6, 0, 6.283); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * .5, -h + w * 1.3); ctx.lineTo(w * .5, -h + w * 1.3);
      ctx.lineTo(w * .32, 0); ctx.lineTo(-w * .32, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    /* 프로펠러 — 선미 아래, 수면 밑. 처음엔 멈춰 있다가 전원 탑승하면 빠르게 돈다(2026-09-18 사용자 "굴뚝 연기보다 프로펠러가 낫겠다").
       옆에서 본 원판이라 세운 타원으로 그린다(rx = ry의 36%). 빨라지면 날개 대신 잔상 원판과 흐린 날개로 — 그래야 돈다고 읽힌다. */
    var ang = 0;
    function propeller(spin, dt) {
      var hub = tf(shipL + deckW * .036, deckY + hullH * .82), ry = Math.max(10, hullH * .22), rx = ry * .36, b, th, tx, ty, mx, my, nx, ny, bw = ry * .30;
      ang += spin * .024 * dt;                                            // 최고 약 3.8회전/초
      ctx.save(); ctx.translate(hub[0], hub[1]); ctx.rotate(sh.a);
      ctx.strokeStyle = 'rgba(110,46,14,.95)'; ctx.lineWidth = 2;        // 축
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9, 0); ctx.stroke();
      if (spin > .1) {                                                   // 회전 잔상 — 돌수록 원판이 차오른다
        ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.05, ry * 1.05, 0, 0, 6.283);
        ctx.fillStyle = 'rgba(255,168,96,' + (.08 + .16 * spin).toFixed(3) + ')'; ctx.fill();
      }
      var blades = spin > .5 ? 6 : 3, step = 6.283 / blades, al = spin > .5 ? .38 : 1 - .5 * spin;
      for (b = 0; b < blades; b++) {
        th = ang + b * step; tx = rx * Math.cos(th); ty = ry * Math.sin(th);
        mx = tx * .5; my = ty * .5; nx = -ty; ny = tx;                    // 날개 폭 방향(화면 기준 수직)
        var nl = Math.hypot(nx, ny) || 1; nx = nx / nl * bw; ny = ny / nl * bw;
        var g = ctx.createLinearGradient(0, 0, tx, ty);
        g.addColorStop(0, 'rgba(244,146,72,' + al.toFixed(3) + ')'); g.addColorStop(1, 'rgba(168,74,24,' + al.toFixed(3) + ')');
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(0, 0); ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty); ctx.quadraticCurveTo(mx - nx, my - ny, 0, 0); ctx.fill();
        if (spin < .5) { ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(255,200,160,' + (.55 * al).toFixed(3) + ')'; ctx.stroke(); }   // 멈춰 있을 땐 가는 밝은 테로 검은 배경에서 살린다
      }
      ctx.beginPath(); ctx.arc(0, 0, ry * .22, 0, 6.283); ctx.fillStyle = '#e8853f'; ctx.fill();   // 허브
      ctx.beginPath(); ctx.arc(0, 0, ry * .22, 0, 6.283); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(70,28,8,.9)'; ctx.stroke();
      ctx.restore();
      if (spin > .05) {                                                  // 프로펠러 물살 — 뒤로 뻗는 따뜻한 빛, 회전에 맞춰 일렁인다
        var fl = .8 + .2 * Math.sin(t_ / 61) + .1 * Math.sin(t_ / 23), wl = deckW * .34;
        var wg = ctx.createLinearGradient(hub[0], 0, hub[0] - wl, 0);
        wg.addColorStop(0, 'rgba(255,170,100,' + (.30 * spin * fl).toFixed(3) + ')'); wg.addColorStop(.4, 'rgba(255,140,70,' + (.10 * spin * fl).toFixed(3) + ')'); wg.addColorStop(1, 'rgba(255,120,50,0)');
        ctx.beginPath(); ctx.ellipse(hub[0] - wl * .5, hub[1], wl * .5, ry * .95 * (1 + .1 * fl), 0, 0, 6.283); ctx.fillStyle = wg; ctx.fill();
      }
    }
    /* 빛줄기 — 탑승 완료의 신호(2026-09-18 사용자 "일자로 된 빛줄기가 배에는 강하게, 멀어질수록 줄어들며 은은하게").
       인트로를 열었던 수평선의 빛이 배의 수면에서 다시 켜진다: 뱃고동 순간 배에서 좌우로 뻗어 나가며 한 번 세게 빛나고, 그 뒤엔 은은하게 숨 쉬며 남는다.
       가는 심선 + 얇은 블룸 + 넓은 안개 세 겹, 셋 다 배에서 멀어질수록 잦아든다. 캔버스가 배 뒤에 있어 배는 빛을 등진 실루엣이 된다. */
    function beam(k, I) {                                                // k: 뻗은 정도 0~1, I: 밝기
      var cx = shipL + deckW / 2, y = deckY + hullH * .755, half = W * .5 * k, q;   // 수면(어두운 띠가 시작되는 높이)
      var layers = [[18, .50], [60, .16]];                                // [세로 반폭, 중심 알파]
      for (q = 0; q < 2; q++) {
        ctx.save(); ctx.translate(cx, y); ctx.scale(half, layers[q][0]);
        var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        rg.addColorStop(0, 'rgba(255,170,100,' + Math.min(1, layers[q][1] * I).toFixed(3) + ')');
        rg.addColorStop(.35, 'rgba(255,150,80,' + Math.min(1, layers[q][1] * .34 * I).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(255,130,60,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 1, 0, 6.283); ctx.fill(); ctx.restore();
      }
      var lg = ctx.createLinearGradient(cx - half, 0, cx + half, 0), c = Math.min(1, .95 * I);
      lg.addColorStop(0, 'rgba(255,224,190,0)'); lg.addColorStop(.25, 'rgba(255,224,190,' + (c * .30).toFixed(3) + ')');
      lg.addColorStop(.5, 'rgba(255,236,214,' + c.toFixed(3) + ')');
      lg.addColorStop(.75, 'rgba(255,224,190,' + (c * .30).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,224,190,0)');
      ctx.fillStyle = lg; ctx.fillRect(cx - half, y - .75, half * 2, 1.5);
    }
    var t_ = 0;
    var t0 = performance.now(), prevT = 0, litSet = false;
    function frame(now) {
      var t = now - t0, dt = Math.min(64, t - prevT); prevT = t;
      var vr = fin.getBoundingClientRect();
      if (vr.bottom < 0 || vr.top > innerHeight) { requestAnimationFrame(frame); return; }   // 화면 밖이면 그리지 않는다
      var lit = 0, k;
      for (k = 0; k < N; k++) if (t >= P[k].d + P[k].dur) lit++;
      // 시동 — 뱃고동 뒤 1.6초에 걸쳐 차오른다(smoothstep)
      var e = t < ENG ? 0 : Math.min(1, (t - ENG) / 1600); e = e * e * (3 - 2 * e);
      var swell = Math.sin(t / 1500) * 2.4, tremor = Math.sin(t / 43) * .26 + Math.sin(t / 19) * .14;
      var surge = 1.4 * (.5 + .5 * Math.sin(t / 2400));                   // 밧줄에 매인 채 앞으로 밀리다 돌아온다
      sh.x = e * (Math.sin(t / 29) * .2 + surge); sh.y = e * (swell + tremor);
      sh.a = e * (Math.sin(t / 1500 + .7) * .0052 - .0095);              // -.0095rad ≈ 뱃머리가 0.54° 든다(음수 = 반시계 = 오른쪽이 위로)
      btn.style.transform = e ? 'translate(' + sh.x.toFixed(2) + 'px,' + sh.y.toFixed(2) + 'px) rotate(' + (sh.a * 57.2958).toFixed(3) + 'deg)' : '';
      // 뱃고동 — 탑승 완료의 한 박자. 선체가 잠깐 밝아지며 수면의 빛줄기가 켜지고, 별도 한 번 빨라진다(출항 때처럼)
      var flash = 0;
      if (t >= HORN) {
        if (!litSet) { litSet = true; fin.classList.add('lit'); boost = Math.max(boost, 1.6); }
        var fp = Math.min(1, (t - HORN) / 560); flash = Math.sin(fp * Math.PI) * .8;
        btn.style.backgroundColor = fp < 1 ? 'rgb(' + Math.round(237 + 18 * flash) + ',' + Math.round(109 + 112 * flash) + ',' + Math.round(32 + 150 * flash) + ')' : '';
      }
      ctx.clearRect(0, 0, W, H);
      if (lit) {                                                           // 탄 사람이 늘수록 배가 밝아진다
        var f = lit / N, g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * .40);
        g.addColorStop(0, 'rgba(237,109,32,' + (.26 * f).toFixed(3) + ')');
        g.addColorStop(.45, 'rgba(237,109,32,' + (.09 * f).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(237,109,32,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      t_ = t;
      if (t >= HORN) {                                                   // 빛줄기 — 900ms 동안 뻗어 나가며 한 번 세게, 그 뒤엔 은은하게 숨 쉰다
        var bk = Math.min(1, (t - HORN) / 900), be = 1 - Math.pow(1 - bk, 3);
        var breath = 1 + .05 * Math.sin(t / 1300) + e * (.02 * Math.sin(t / 43));
        beam(.12 + .88 * be, (1 + .9 * (1 - be)) * breath);
      }
      var spin = t < HORN + 300 ? 0 : Math.min(1, (t - HORN - 300) / 1300); spin = spin * spin * (3 - 2 * spin);
      propeller(spin, dt);
      ctx.lineCap = 'round';
      for (k = 0; k < N; k++) {
        var p = P[k], u = (t - p.d) / p.dur;
        if (u < 0) continue;
        if (u >= 1) {                                                      // 승선 — 빛이 갑판 위에 사람으로 선다
          var age2 = t - (p.d + p.dur), a = Math.min(1, age2 / 300);
          var pos = tf(spot(p), deckY), ph2 = p.h * (.55 + .45 * a);
          var tilt = sh.a + p.lean * a + e * Math.sin(t / 650 + p.ph) * .02;   // 시동이 걸리면 각자 미세하게 몸을 가눈다
          person(pos[0], pos[1] - (1 - a) * 4, ph2, .92 * a, tilt);
          if (age2 < 280) {                                                // 발 딛는 순간의 짧은 섬광
            var fa = 1 - age2 / 280;
            ctx.beginPath(); ctx.arc(pos[0], pos[1], 1.5 + 5 * (1 - fa), 0, 6.283);
            ctx.fillStyle = 'rgba(255,214,170,' + (.5 * fa * fa).toFixed(3) + ')'; ctx.fill();
          }
          if (flash > 0) {                                                 // 뱃고동에 전원이 함께 빛난다
            ctx.beginPath(); ctx.arc(pos[0], pos[1] - ph2 + ph2 * .34 * .6, 1.6 + 2.2 * flash, 0, 6.283);
            ctx.fillStyle = 'rgba(255,240,220,' + (.55 * flash).toFixed(3) + ')'; ctx.fill();
          }
          continue;
        }
        var e2 = 1 - Math.pow(1 - u, 2.2);                                 // 다가갈수록 느려진다
        var cur = at(p, e2), prev = at(p, Math.max(0, e2 - .11));          // 꼬리
        var al = Math.min(1, u / .12) * (u > .84 ? (1 - u) / .16 : 1);     // 갑판에 닿으며 스며든다
        var grd = ctx.createLinearGradient(prev[0], prev[1], cur[0], cur[1]);
        grd.addColorStop(0, 'rgba(237,109,32,0)');
        grd.addColorStop(1, 'rgba(255,190,130,' + (.9 * al).toFixed(3) + ')');
        ctx.strokeStyle = grd; ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke();
        ctx.beginPath(); ctx.arc(cur[0], cur[1], p.w * .95, 0, 6.283);     // 머리의 빛점
        ctx.fillStyle = 'rgba(255,226,196,' + (.95 * al).toFixed(3) + ')'; ctx.fill();
      }
      requestAnimationFrame(frame);       // 캔버스는 지우지 않는다 — 크루가 갑판에 남아 배와 함께 흔들린다
    }
    requestAnimationFrame(frame);
  }

  var fin = document.querySelector('.final');
  if (fin) {
    // 글자 등장·별 가속만 여기서. 크루 행렬은 핀이 걸린 뒤 updatePins에서 시작한다
    var board = function () { fin.classList.add('in'); boost = Math.max(boost, 2.2); };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { board(); io.disconnect(); } });
      }, { rootMargin: '0px 0px -12% 0px' });
      io.observe(fin.querySelector('.eyebrow') || fin);
    } else board();
  }



  /* ---------- 빛의 수평선(WebGL): 빛점 → 수평선 → 빛줄기 확산 → 잔광. 홈에 머무는 동안 계속 산다 ----------
     t(초)로 장면을 계산한다. 재방문(ident-seen)은 잔광부터, 편집 모드·모션 축소는 정지 화면. */
  /* ---------- 아이덴트 "빛의 수평선" v8 — WebGL 다중 패스: 장면 → 블룸 밉체인 → 합성 ----------
     장면 셰이더는 색이 아니라 '빛의 세기'(스칼라, HDR)를 그린다 → 블룸 패스가 세기를 여러 해상도로 번지게 한다
     (다운: 4탭 박스, 업: 3×3 텐트 누적) → 합성 셰이더가 세기를 색 램프(deep→org→lt→hot)로 바꾸면서
     플래시 순간의 색수차·비네트·필름 그레인(24fps)·디더를 한 번에 얹는다. 카메라로 찍은 빛처럼 보이게 하는 층.
     텍스처는 half float가 되면 HDR, 아니면 8비트(x/(1+x) 압축 + 디더). 진단: ?at=1.3(그 시각 정지 프레임) ?post=0(후처리 끔) ?hdr=0(8비트 폴백 강제) */
  (function aurora() {
    var cv = document.getElementById('aurora'); if (!cv) return;
    var still = reduced || editing;
    var gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) { cv.remove(); return; }
    var atQ = /[?&]at=([\d.]+)/.exec(location.search), at = atQ ? parseFloat(atQ[1]) : null;
    var post = !/[?&]post=0/.test(location.search);
    if (at !== null) still = true;

    function mkFbo(w, h, type) {
      var tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);
      var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb: fb, tx: tx, w: w, h: h, ok: ok };
    }
    function freeFbo(f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tx); }

    // 텍스처 형식: half float 렌더 타깃이 되면 HDR(클리핑·밴딩 없음), 아니면 8비트 + 압축·디더
    var hf = gl.getExtension('OES_texture_half_float'), hfl = gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('EXT_color_buffer_half_float');
    var texType = gl.UNSIGNED_BYTE, hdr = false;
    if (hf && hfl && !/[?&]hdr=0/.test(location.search)) { var probe = mkFbo(4, 4, hf.HALF_FLOAT_OES); if (probe.ok) { texType = hf.HALF_FLOAT_OES; hdr = true; } freeFbo(probe); }   // ?hdr=0 이면 8비트 경로를 강제(폴백 검증용)

    var PRE = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec2 v;';
    var ENC = hdr ? 'float enc(float x){return x;}float dec(float x){return x;}'
                  : 'float enc(float x){return x/(1.+x);}float dec(float x){return x/max(1.-x,.004);}';
    var IGN = 'float ign(vec2 p){return fract(52.9829189*fract(.06711056*p.x+.00583715*p.y));}';
    var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';

    // ① 장면: 빛의 세기 I(r 채널, HDR)와 색온도 tp(g 채널: 플래시 순간 백열→쿨 화이트)
    var SCENE = PRE + ENC + IGN + 'uniform float t;uniform float amb;uniform float fr;uniform float pxh;uniform float nb;' +
      'float hash(float n){return fract(sin(n)*43758.5453);}' +
      'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);float a=hash(i.x+i.y*57.),b=hash(i.x+1.+i.y*57.),c=hash(i.x+(i.y+1.)*57.),d=hash(i.x+1.+(i.y+1.)*57.);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}' +
      'void main(){vec2 uv=v;float h0=.38;float dy=uv.y-h0;float cx=abs(uv.x-.5);' +
      'float tl=smoothstep(.35,1.1,t);float ch=smoothstep(' + T(-.4) + ',' + T(-.02) + ',t);float ts=smoothstep(' + T(0) + ',' + T(.93) + ',t);float ta=smoothstep(' + T(.83) + ',' + T(1.98) + ',t);' +
      // 백열 빛점 → 수평선. 다 늘어난 뒤 갈라지기 전 한 박자: 밝아지며 가늘어지고(충전) 직전에 살짝 숨을 죽인다(예비 동작)
      'float ext=pow(tl,.55)*.66+.004;float xm=smoothstep(ext,ext-.14,cx);' +
      'float env=(1.+1.2*ch)*(1.-.4*exp(-pow((t-' + T(-.05) + ')/.04,2.)));' +
      'float lw=mix(.0016,.0009,max(ch,ts));float lwe=max(lw,.9*pxh);float core=exp(-pow(dy/lwe,2.))*(lw/lwe)*xm*smoothstep(.2,.5,t)*(1.-ta*.92)*env;' +   // 선이 렌더 픽셀보다 가늘어지면 넓히되 총량은 보존(서브픽셀로 어두워지지 않게)
      'float halo=exp(-abs(dy)/(.010+.04*ts))*xm*tl*.2*(1.-ta*.8);' +   // 선 주변의 얇은 광륜 — 넓은 번짐은 블룸 패스가 맡는다
      // 빛줄기(v8.2, 수평선에 힘을 모으는 구도 — 사용자 선택): 가느다란 필라멘트 수십 개가 플래시에 수평선에서 터져 나가 감속하고,
      // 잠깐 머물며 천천히 옆으로 흐르다가, 각자 다른 시차로 중력처럼 가속해 수평선으로 되돌아와 닿는 순간 선을 잠깐 밝히며 흡수된다.
      // 끝은 가우시안으로 부드럽고, 밝기·두께는 거듭제곱 분포(대부분 어둡고 가늘게), 가는 심+옅은 베일, 렌더 픽셀보다 가늘면 총량 보존해 넓힘.
      'float bands=0.;for(int i=0;i<32;i++){float k=float(i);if(k>=nb)break;' +
      'float r1=hash(k*7.31+1.7),r2=hash(k*3.7+2.1),r3=hash(k*5.1+3.3),r4=hash(k*2.3+4.9),r5=hash(k*9.1+5.7),r6=hash(k*1.9+6.3),r7=hash(k*4.3+7.9);' +
      'float dir=mod(k,2.)<1.?1.:-1.;float dl=r5*.25;float To=.5+.25*r6;float hold=.1+.25*r7;float Tr=.5+.5*r2;' +
      'float t1=t-' + T(0) + '-dl;float u1=clamp(t1/To,0.,1.);float out_=(1.-exp(-4.*u1))/.982;' +           // 터져 나가 감속
      'float u2=clamp((t1-To-hold)/Tr,0.,1.);float back=pow(u2,1.8);' +                                        // 중력처럼 가속해 복귀
      'float S=.012+.15*pow(r1,1.5);float yi=h0+dir*S*out_*(1.-back);' +
      'yi+=(.001+.003*r6)*sin(uv.x*(2.+3.*r2)+k*1.3+t*.5)*(1.-back)+(r7-.5)*.012*(uv.x-.5)*(1.-back);' +      // 살짝 휘고 기울되 선에 닿을 땐 곧게
      'float th=mix(.0006,.004,r2*r2*r2)*(1.+.5*u1)*(1.-.55*back);float the=max(th,.9*pxh);float d=(uv.y-yi)/the;float g=(exp(-d*d)+.14*exp(-d*d/20.))*(th/the);' +
      'float xc=.5+(r4-.5)*.8+(r3-.5)*.1*u1;float L=.1+.3*r1;float xe=uv.x-xc;float env=exp(-xe*xe/(L*L));' +   // 끝이 부드러운 길이
      'float tex=.55+.45*vnoise(vec2(uv.x*12.+k*7.+t*(.3+.4*r7)*dir,k*3.1));' +
      'float life=smoothstep(0.,.1,u1)*(1.-smoothstep(.8,1.,u2));float br=(.08+.75*pow(r3,2.5))*(1.+.6*back);' +   // 돌아올수록 조금 밝아지며 가늘어진다
      'bands+=br*g*env*tex*life*exp(-abs(yi-h0)*5.);' +
      'bands+=.9*br*env*exp(-pow((u2-.93)/.07,2.))*exp(-abs(dy)/.0035)*step(.01,u2);}' +                       // 닿는 순간 선 위의 짧은 흡수 플레어
      'bands*=1.-.4*pow(cx*2.,2.);' +
      // 잔광(지속): 수평선에 오로라처럼 숨 쉬는 빛 — 글자 아래에 머문다
      'float amb1=exp(-abs(dy)/.085)*(.20+.22*vnoise(vec2(uv.x*2.5+t*.05,t*.07)))*ta;' +
      'amb1+=exp(-abs(dy)/.30)*.055*ta+exp(-abs(dy)/.011)*.22*ta*(.6+.4*vnoise(vec2(uv.x*9.+t*.2,t*.3)));' +
      'amb1*=(1.-.35*pow(cx*2.,2.));' +
      // 갈라지는 순간의 플래시: 0.05s에 터지고 0.32s 시상수로 식는다, 식으면서 폭이 넓어진다
      'float fl=t-' + T(0) + ';float fa=fl<0.?exp(-pow(fl/.05,2.)):exp(-fl/.32);' +
      'float flash=fa*.9*exp(-abs(dy)/(.07+.35*clamp(fl,0.,1.)))+fa*.04;' +
      'float I=(core*3.+halo+bands+amb1+flash)*amb;float e=enc(I);' +   // amb = 스크롤 감쇠(0~1): 인트로 중이든 잔광이든 빛 전체에 적용
      (hdr ? '' : 'e+=(ign(gl_FragCoord.xy+vec2(fr*17.,fr*11.))-.5)/255.;') +
      'gl_FragColor=vec4(e,clamp(fa*1.1,0.,1.),0.,1.);}';
    // ② 프리필터+첫 다운샘플: 문턱(소프트 니) 넘는 세기만 블룸 원천으로
    var PREF = PRE + ENC + 'uniform sampler2D s;uniform vec2 px;uniform float th;' +
      'float src(vec2 p){float I=dec(texture2D(s,p).r);float k=th*.5;float rq=clamp(I-th+k,0.,2.*k);rq=rq*rq/(4.*k+1e-4);return max(rq,I-th);}' +
      'void main(){float b=src(v+px*vec2(-1.,-1.))+src(v+px*vec2(1.,-1.))+src(v+px*vec2(-1.,1.))+src(v+px*vec2(1.,1.));gl_FragColor=vec4(enc(b*.25),0.,0.,1.);}';
    var DOWN = PRE + ENC + 'uniform sampler2D s;uniform vec2 px;float src(vec2 p){return dec(texture2D(s,p).r);}' +
      'void main(){float b=src(v+px*vec2(-1.,-1.))+src(v+px*vec2(1.,-1.))+src(v+px*vec2(-1.,1.))+src(v+px*vec2(1.,1.));gl_FragColor=vec4(enc(b*.25),0.,0.,1.);}';
    // ③ 업샘플: 작은 단계를 3×3 텐트로 키워 같은 크기의 다운 단계에 누적(w<1이면 넓은 베일이 절제된다)
    var UP = PRE + ENC + 'uniform sampler2D s;uniform sampler2D b;uniform vec2 px;uniform float w;float src(vec2 p){return dec(texture2D(s,p).r);}' +
      'void main(){float a=src(v+px*vec2(-1.,-1.))+2.*src(v+px*vec2(0.,-1.))+src(v+px*vec2(1.,-1.))+2.*src(v+px*vec2(-1.,0.))+4.*src(v)+2.*src(v+px*vec2(1.,0.))+src(v+px*vec2(-1.,1.))+2.*src(v+px*vec2(0.,1.))+src(v+px*vec2(1.,1.));' +
      'gl_FragColor=vec4(enc(dec(texture2D(b,v).r)+a/16.*w),0.,0.,1.);}';
    // ④ 합성: 세기(직접+블룸) → 색 램프. 플래시 순간 색수차(R/B를 중심 기준 반대로 밀기), 비네트, 필름 그레인(어두운 곳은 검게 유지)+디더
    var COMP = PRE + ENC + IGN + 'uniform sampler2D s;uniform sampler2D b;uniform float bl;uniform float ca;uniform float gr;uniform float fr;' +
      'vec3 ramp(float I,float tp){float I1=1.-exp(-I);vec3 deep=vec3(.40,.11,.03),org=vec3(.93,.43,.13),lt=vec3(1.,.64,.32),hot=mix(vec3(1.,.95,.88),vec3(.94,.97,1.),tp);' +
      'vec3 c=mix(deep,org,smoothstep(0.,.35,I1));c=mix(c,lt,smoothstep(.35,.75,I1));c=mix(c,hot,smoothstep(.78,1.,I1));return c*I1;}' +
      'float I(vec2 p){return dec(texture2D(s,p).r)+dec(texture2D(b,p).r)*bl;}' +
      'void main(){vec2 d=v-.5;vec2 o=d*ca;float tp=texture2D(s,v).g;' +
      'vec3 c=vec3(ramp(I(v+o),tp).r,ramp(I(v),tp).g,ramp(I(v-o),tp).b);' +
      'c*=1.-.35*pow(length(d*vec2(1.,1.3)),1.6);' +
      'float n=ign(gl_FragCoord.xy+vec2(fr*17.,fr*11.))-.5;float lum=dot(c,vec3(.299,.587,.114));' +
      'c+=n*(gr*smoothstep(0.,.12,lum)*(1.-.6*lum))+n*(1.2/255.);' +
      'gl_FragColor=vec4(c,1.);}';

    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(o)); return null; } return o; }
    function mkProg(fsSrc) {
      var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, fsSrc); if (!vs || !fs) return null;
      var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
      gl.useProgram(p); if (u.s) gl.uniform1i(u.s, 0); if (u.b) gl.uniform1i(u.b, 1);
      return { p: p, u: u };
    }
    var Ps = mkProg(SCENE), Pp = mkProg(PREF), Pd = mkProg(DOWN), Pu = mkProg(UP), Pc = mkProg(COMP);
    if (!Ps || !Pp || !Pd || !Pu || !Pc) { cv.remove(); return; }
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // 튠 상수: 블룸 문턱 · 단계 가중 · 블룸 세기 · 색수차 최대치 · 그레인 양
    var TH = .35, UW = .8, BL = .5, CA = .02, GR = .04, N = 5;
    var mobile = window.matchMedia('(max-width: 639px)').matches;
    var scene = null, mips = [], ups = [], ok = false;
    function free() { if (scene) freeFbo(scene); mips.forEach(freeFbo); ups.forEach(freeFbo); scene = null; mips = []; ups = []; }
    function size() {
      var W = innerWidth, H = innerHeight;
      var dpr = Math.min(devicePixelRatio || 1, 1.5); if (W * dpr > 2000) dpr = 2000 / W;   // 합성(출력)은 화면 해상도 가깝게 — 그레인이 고와야 한다
      cv.width = Math.max(2, Math.round(W * dpr)); cv.height = Math.max(2, Math.round(H * dpr));
      var ss = mobile ? .75 : .6, w = Math.max(2, Math.round(W * ss)), h = Math.max(2, Math.round(H * ss));   // 장면은 축소 렌더(빛은 부드러워 무방)
      free(); scene = mkFbo(w, h, texType); ok = scene.ok;
      for (var i = 0; i < N; i++) {
        w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
        var m = mkFbo(w, h, texType); mips.push(m); ok = ok && m.ok;
        if (i < N - 1) { var u = mkFbo(w, h, texType); ups.push(u); ok = ok && u.ok; }
      }
    }
    size();
    if (!ok) { free(); cv.remove(); return; }   // FBO가 안 되는 환경: CSS 잔광 폴백
    window.addEventListener('resize', size);
    html.classList.add('aurora');

    function pass(P, fbo, w, h) { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h); gl.useProgram(P.p); }
    function tex(unit, tx) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx); }
    function quad() { gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    function render(t, amb) {
      var fr = Math.floor(t * 24), fl = t - TF, fa = fl < 0 ? Math.exp(-Math.pow(fl / .05, 2)) : Math.exp(-fl / .32);
      pass(Ps, scene.fb, scene.w, scene.h); gl.uniform1f(Ps.u.t, t); gl.uniform1f(Ps.u.amb, amb); gl.uniform1f(Ps.u.fr, fr); gl.uniform1f(Ps.u.pxh, 1 / scene.h); gl.uniform1f(Ps.u.nb, mobile ? 18 : 28); quad();
      if (post) {
        pass(Pp, mips[0].fb, mips[0].w, mips[0].h); tex(0, scene.tx); gl.uniform2f(Pp.u.px, 1 / scene.w, 1 / scene.h); gl.uniform1f(Pp.u.th, TH); quad();
        for (var i = 1; i < N; i++) { pass(Pd, mips[i].fb, mips[i].w, mips[i].h); tex(0, mips[i - 1].tx); gl.uniform2f(Pd.u.px, 1 / mips[i - 1].w, 1 / mips[i - 1].h); quad(); }
        var prev = mips[N - 1];
        for (i = N - 2; i >= 0; i--) { pass(Pu, ups[i].fb, ups[i].w, ups[i].h); tex(0, prev.tx); tex(1, mips[i].tx); gl.uniform2f(Pu.u.px, 1 / prev.w, 1 / prev.h); gl.uniform1f(Pu.u.w, UW); quad(); prev = ups[i]; }
      }
      pass(Pc, null, cv.width, cv.height); tex(0, scene.tx); tex(1, post ? ups[0].tx : mips[0].tx);
      gl.uniform1f(Pc.u.bl, post ? BL : 0); gl.uniform1f(Pc.u.ca, post ? CA * fa : 0); gl.uniform1f(Pc.u.gr, post ? GR : 0); gl.uniform1f(Pc.u.fr, fr); quad();
    }

    var start = performance.now(), offset = (html.classList.contains('ident-seen') || still) ? 4.2 : 0;   // 재방문·정지: 잔광부터
    var running = !document.hidden;
    function draw(now) {
      if (!running) return;
      var t = at !== null ? at : offset + (now - start) / 1000;
      var sc = Math.min(1, window.scrollY / (innerHeight * .32)), amb = Math.pow(1 - sc, 1.6);   // 스크롤하면 빛 전체가 빠르게 잦아들어 화면 1/3을 내려가기 전(SCROLL 표시가 수평선 위로 올라오는 지점)에 완전히 사라진다
      render(t, amb);
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
  var warpAt = seen ? 0 : TF * 1000, warpDur = seen ? 1300 : 1600;   // 빛이 갈라지는 순간(TF)에 별도 함께 흩어진다
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

/* 컬처덱 슬라이드 보기 — 원본 덱을 한 장씩 넘긴다 (2026-10-13, 사용자 "컬처덱 다운로드와 슬라이드 보기에 컬처덱 ppt 원본을 넣어주면 돼")
   원본: 대표 키노트 '올핸즈미팅_260526.key'의 컬처덱 부분을 공개본으로 뽑은 이미지(assets/culture/v1.0/NN.jpg, 1920×1080).
   목록 · 대체 글은 assets/culture/slides.json, 다운로드는 같은 공개본의 PDF.
   켜기: 히어로의 '슬라이드로 보기'(#slides) / #slide-12 처럼 번호로 진입. 나가기: '글로 보기' · Esc. 편집 모드(#edit)에서는 돌지 않는다. */
(function () {
  'use strict';
  var hero = document.querySelector('.cd-hero');
  if (!hero || location.hash === '#edit') return;
  var BASE = window.__EGO_BASE || '', VER = window.__EGO_VER || Date.now(), DIR = BASE + 'assets/culture/';

  var stage = null, slides = [], idx = 0, active = false, deck = null;
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function render() {
    stage = document.createElement('div'); stage.className = 'sl'; stage.setAttribute('aria-label', '컬처덱 슬라이드'); stage.setAttribute('data-noedit', '');
    var track = document.createElement('div'); track.className = 'sl-track';
    deck.slides.forEach(function (s) {
      var el = document.createElement('figure'); el.className = 'sl-slide after'; el.setAttribute('aria-hidden', 'true');
      var img = document.createElement('img'); img.alt = s.alt; img.width = deck.w; img.height = deck.h; img.decoding = 'async'; img.draggable = false;
      el.appendChild(img); track.appendChild(el);
      slides.push({ el: el, img: img, src: DIR + s.src });   // 이미지는 판(v1.0)마다 폴더가 달라 ?v= 없이 캐시에 맡긴다
    });
    stage.appendChild(track);
    stage.insertAdjacentHTML('beforeend',
      '<div class="sl-bar"><i></i></div><div class="sl-foot"><span class="sl-count"></span><a class="sl-exit" href="#">글로 보기</a>' +
      '<span class="sl-nav"><button type="button" class="sl-prev" aria-label="이전 장">‹</button><button type="button" class="sl-next" aria-label="다음 장">›</button></span></div>');
    hero.parentNode.insertBefore(stage, hero);
    stage.querySelector('.sl-prev').addEventListener('click', function () { go(idx - 1); });
    stage.querySelector('.sl-next').addEventListener('click', function () { go(idx + 1); });
    stage.querySelector('.sl-exit').addEventListener('click', function (e) { e.preventDefault(); leave(); });
    /* 폰: 가로로 밀면 넘김. 핀치로 확대한 동안은 밀기를 쉬고 화면 이동을 브라우저에 돌려준다 */
    var sx = 0, sy = 0, on = false;
    stage.addEventListener('touchstart', function (e) { on = e.touches.length === 1; if (on) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (!on || zoomed()) return; on = false;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(idx + (dx < 0 ? 1 : -1));
    });
    if (window.visualViewport) visualViewport.addEventListener('resize', function () { stage.classList.toggle('zoomed', zoomed()); });
    /* 휠: 한 번의 제스처(사이가 220ms 넘게 비면 새 제스처)에 한 장 */
    var lastWheel = 0;
    stage.addEventListener('wheel', function (e) {
      if (e.ctrlKey) return;   // 트랙패드 핀치 확대는 그대로
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, now = Date.now(), gap = now - lastWheel;
      lastWheel = now; e.preventDefault();
      if (Math.abs(d) >= 2 && gap > 220) go(idx + (d > 0 ? 1 : -1));
    }, { passive: false });
  }
  function zoomed() { return !!(window.visualViewport && visualViewport.scale > 1.02); }
  function load(i) { var s = slides[i]; if (s && !s.img.getAttribute('src')) s.img.src = s.src; }

  function fit() { if (!stage) return; var top = stage.getBoundingClientRect().top + scrollY; stage.style.height = Math.max(280, innerHeight - top) + 'px'; }
  function go(n) {
    n = Math.max(0, Math.min(slides.length - 1, n)); idx = n;
    slides.forEach(function (s, i) { s.el.className = 'sl-slide' + (i < n ? ' before' : i > n ? ' after' : ' on'); s.el.setAttribute('aria-hidden', i !== n ? 'true' : 'false'); });
    [n, n + 1, n - 1, n + 2].forEach(load);   // 보이는 장과 앞뒤만 받는다
    stage.querySelector('.sl-count').textContent = pad(n + 1) + ' / ' + pad(slides.length);
    stage.querySelector('.sl-bar i').style.width = ((n + 1) / slides.length * 100) + '%';
    stage.querySelector('.sl-prev').disabled = n === 0; stage.querySelector('.sl-next').disabled = n === slides.length - 1;
    history.replaceState(null, '', location.pathname + location.search + '#slide-' + (n + 1));
  }
  function enter(n) {
    if (!stage) render();
    active = true; document.documentElement.classList.add('slides');
    window.scrollTo({ top: 0, behavior: 'instant' }); fit(); go(n);
  }
  function exit() { active = false; document.documentElement.classList.remove('slides'); }
  function leave() { history.replaceState(null, '', location.pathname + location.search); exit(); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function fromHash() {
    var m = location.hash.match(/^#slide(?:s|-(\d+))$/);
    if (m) enter(m[1] ? Math.max(0, parseInt(m[1], 10) - 1) : 0); else if (active) exit();
  }

  document.addEventListener('keydown', function (e) {
    if (!active) return; var t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(idx + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
    else if (e.key === 'Escape') { leave(); }
  });
  var rt;
  window.addEventListener('resize', function () { if (!active) return; clearTimeout(rt); rt = setTimeout(fit, 120); });

  /* 목록과 스타일을 먼저 받고 나서 버튼을 달고 해시를 본다 — 스타일 없이 슬라이드가 잠깐 비치지 않게 */
  var cssReady = new Promise(function (ok) {
    var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = BASE + 'assets/deck.css?v=' + VER;
    link.onload = link.onerror = ok; document.head.appendChild(link);
  });
  Promise.all([cssReady, fetch(DIR + 'slides.json?v=' + VER).then(function (r) { return r.json(); })]).then(function (r) {
    deck = r[1]; if (!deck.slides || !deck.slides.length) return;
    var dl = hero.querySelector('.btn');
    if (dl) { var open = document.createElement('a'); open.className = 'btn ghost'; open.href = '#slides'; open.textContent = '슬라이드로 보기'; dl.parentNode.insertBefore(open, dl.nextSibling); }
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }).catch(function () {});   // 목록을 못 받으면 버튼을 달지 않는다 — 글 보기와 다운로드는 그대로
})();

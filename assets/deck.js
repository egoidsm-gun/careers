/* 컬처덱 슬라이드 보기 (2026-10-13, 사용자 "슬라이드형 웹(한 장씩 넘김) 구현해볼래?")
   긴 글 페이지(.cd)의 내용을 그대로 잘라 한 장씩 넘긴다 — 내용 원본은 한 곳(culture.html)뿐이라 편집 모드로 고친 문구가 슬라이드에도 그대로 나온다.
   켜기: 히어로의 '슬라이드로 보기'(#slides) / #slide-12 처럼 번호로 진입. '글로 보기'·Esc는 해시를 지운다.
   site.js가 .cd 가 있는 페이지에서만 불러온다. 편집 모드(#edit)에서는 아예 돌지 않는다. */
(function () {
  'use strict';
  var cd = document.querySelector('.cd'), hero = document.querySelector('.cd-hero');
  if (!cd || !hero || location.hash === '#edit') return;
  var BASE = window.__EGO_BASE || '', VER = window.__EGO_VER || Date.now();

  var stage = null, slides = [], idx = 0, built = false, mobile = false, active = false;
  function isMobile() { return innerWidth < 640; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function cl(n) {   // 복제본엔 편집 표식·id를 남기지 않는다(id가 겹치면 글 보기의 #v05 같은 앵커가 숨은 복제본을 가리킨다)
    var c = n.cloneNode(true);
    [c].concat(Array.prototype.slice.call(c.querySelectorAll('[data-e],[id]'))).forEach(function (e) { e.removeAttribute('data-e'); e.removeAttribute('id'); });
    return c;
  }

  /* ---------- 자르기 규칙 ----------
     표지 → 선언문 한 장 → 문단은 한 장에 하나 → 격자는 단순 셀(제목+짧은 글) 4개 · 목록이 있는 셀 2개씩(폰은 2 · 1)
     → 장 제목은 자기 장 → 소제목(.cd-sub)은 이어지는 장들의 머리글로, 그룹 라벨(.cd-group)은 눈썹으로
     → 격자 바로 앞 문단 하나는 단순 격자면 같은 장에, 아니면 따로 → 외침 · 인용은 한 장씩, 버튼은 마지막 장에. */
  function build() {
    var list = [], intro = [];
    var cover = document.createElement('div'); cover.className = 'sl-cover';
    cover.appendChild(cl(hero.querySelector('.cd-title'))); cover.appendChild(cl(hero.querySelector('.cd-meta')));
    list.push({ kind: 'cover', nodes: [cover] });
    function flush(eb, sub) { intro.forEach(function (p) { list.push({ kind: 'text', eyebrow: eb, sub: sub, nodes: [cl(p)] }); }); intro = []; }
    function grid(g, eb, sub, group) {
      var cells = Array.prototype.slice.call(g.children), g3 = g.classList.contains('g3');
      var rich = cells.some(function (c) { return c.querySelector('ul'); });
      var per = g3 ? 3 : rich ? (mobile ? 1 : 2) : (mobile ? 2 : 4);
      var alone = rich || (g3 && mobile);   // 폰에서 세 칸을 세로로 쌓으면 앞 문단까지 한 장에 안 들어간다
      if (intro.length > 1 || (intro.length && alone)) { var keep = alone ? null : intro.pop(); flush(eb, sub); if (keep) intro = [keep]; }
      for (var i = 0; i < cells.length; i += per) {
        var box = document.createElement('div'); box.className = 'sl-grid' + (g3 ? ' g3' : rich ? ' rich' : '');
        cells.slice(i, i + per).forEach(function (c) { box.appendChild(cl(c)); });
        var nodes = [];
        if (i === 0 && intro.length) { nodes.push(cl(intro[0])); intro = []; }
        nodes.push(box);
        list.push({ kind: 'grid', eyebrow: eb, sub: sub, group: group, nodes: nodes });
      }
    }
    Array.prototype.slice.call(cd.children).forEach(function (el) {
      if (el.matches('.cd-state')) { flush('', null); list.push({ kind: 'state', nodes: [cl(el)] }); }
      else if (el.matches('p')) intro.push(el);
      else if (el.matches('.cd-grid')) grid(el, '', null, '');
      else if (el.matches('section')) {
        flush('', null);
        var eb = el.querySelector('.eyebrow'), h2 = el.querySelector('h2'), num = eb ? eb.textContent.trim() : '', sub = null, group = '';
        list.push({ kind: 'title', sec: el.id, nodes: [cl(eb), cl(h2)] });
        Array.prototype.slice.call(el.children).forEach(function (c) {
          if (c === eb || c === h2) return;
          if (c.matches('.cd-sub')) { flush(num, sub); sub = c; group = ''; }
          else if (c.matches('.cd-group')) { flush(num, sub); group = c.textContent.trim(); }
          else if (c.matches('.cd-state')) { flush(num, sub); list.push({ kind: 'state', eyebrow: num, nodes: [cl(c)] }); }
          else if (c.matches('.cd-shout')) { flush(num, sub); list.push({ kind: 'shout', eyebrow: num, nodes: [cl(c)] }); }
          else if (c.matches('.cd-quote')) { flush(num, sub); list.push({ kind: 'quote', eyebrow: num, nodes: [cl(c)] }); }
          else if (c.matches('p')) intro.push(c);
          else if (c.matches('ul')) { var n = intro.map(cl); intro = []; n.push(cl(c)); list.push({ kind: 'list', eyebrow: num, sub: sub, nodes: n }); }
          else if (c.matches('.cd-grid')) grid(c, num, sub, group);
          else if (c.matches('.btns')) { flush(num, sub); list[list.length - 1].nodes.push(cl(c)); }
        });
        flush(num, sub);
      }
    });
    flush('', null);
    return list;
  }

  function render() {
    stage = document.createElement('div'); stage.className = 'sl'; stage.setAttribute('aria-label', '컬처덱 슬라이드'); stage.setAttribute('data-noedit', '');
    var track = document.createElement('div'); track.className = 'sl-track';
    slides.forEach(function (s) {
      var el = document.createElement('section'); el.className = 'sl-slide ' + s.kind; el.setAttribute('aria-hidden', 'true');
      var box = document.createElement('div'); box.className = 'sl-in';
      if (s.eyebrow || s.group) { var e = document.createElement('p'); e.className = 'eyebrow'; e.textContent = s.eyebrow + (s.eyebrow && s.group ? ' · ' : '') + (s.group || ''); box.appendChild(e); }
      if (s.sub) { var t = cl(s.sub); t.className = 'sl-sub'; box.appendChild(t); }
      var body = document.createElement('div'); body.className = 'sl-body';   // 눈썹·머리글과 본문을 갈라 둬야 본문 크기 규칙이 머리글에 번지지 않는다
      s.nodes.forEach(function (n) { body.appendChild(n); });
      box.appendChild(body); el.appendChild(box); track.appendChild(el); s.el = el;
    });
    stage.appendChild(track);
    stage.insertAdjacentHTML('beforeend',
      '<div class="sl-bar"><i></i></div><div class="sl-foot"><span class="sl-count"></span><a class="sl-exit" href="#">글로 보기</a>' +
      '<span class="sl-nav"><button type="button" class="sl-prev" aria-label="이전 장">‹</button><button type="button" class="sl-next" aria-label="다음 장">›</button></span></div>');
    hero.parentNode.insertBefore(stage, hero);
    stage.querySelector('.sl-prev').addEventListener('click', function () { go(idx - 1); });
    stage.querySelector('.sl-next').addEventListener('click', function () { go(idx + 1); });
    stage.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]'); if (!a) return;
      e.preventDefault();
      if (a.classList.contains('sl-exit')) { leave(); return; }
      var id = a.getAttribute('href').slice(1);   // 미리보기 격자(I · II · III)를 누르면 그 장의 제목 슬라이드로
      for (var i = 0; i < slides.length; i++) if (slides[i].sec === id) { go(i); return; }
    });
    /* 터치: 가로로 밀면 넘김(세로는 긴 장 안에서 스크롤) */
    var sx = 0, sy = 0, down = false;
    stage.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; down = true; sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointercancel', function () { down = false; });
    stage.addEventListener('pointerup', function (e) {
      if (!down) return; down = false;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) go(idx + (dx < 0 ? 1 : -1));
    });
    /* 휠: 한 번의 제스처(사이가 220ms 넘게 비면 새 제스처)에 한 장. 긴 장은 안에서 먼저 끝까지 스크롤 */
    var lastWheel = 0;
    stage.addEventListener('wheel', function (e) {
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, now = Date.now(), gap = now - lastWheel;
      lastWheel = now;
      if (Math.abs(d) < 2) return;
      var el = slides[idx].el;
      if (d === e.deltaY && el.scrollHeight > el.clientHeight + 2 && ((d > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 2) || (d < 0 && el.scrollTop > 2))) return;
      e.preventDefault();
      if (gap > 220) go(idx + (d > 0 ? 1 : -1));
    }, { passive: false });
  }

  function fit() { if (!stage) return; var top = stage.getBoundingClientRect().top + scrollY; stage.style.height = Math.max(320, innerHeight - top) + 'px'; }
  function go(n) {
    n = Math.max(0, Math.min(slides.length - 1, n)); idx = n;
    slides.forEach(function (s, i) { s.el.className = 'sl-slide ' + s.kind + (i < n ? ' before' : i > n ? ' after' : ' on'); s.el.setAttribute('aria-hidden', i !== n ? 'true' : 'false'); });
    slides[n].el.scrollTop = 0;
    stage.querySelector('.sl-count').textContent = pad(n + 1) + ' / ' + pad(slides.length);
    stage.querySelector('.sl-bar i').style.width = ((n + 1) / slides.length * 100) + '%';
    stage.querySelector('.sl-prev').disabled = n === 0; stage.querySelector('.sl-next').disabled = n === slides.length - 1;
    history.replaceState(null, '', location.pathname + location.search + '#slide-' + (n + 1));
  }
  function rebuild() {
    if (stage) stage.parentNode.removeChild(stage);
    mobile = isMobile(); slides = build(); render(); built = true;
  }
  function enter(n) {
    if (!built || isMobile() !== mobile) rebuild();
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
  window.addEventListener('resize', function () {
    if (!active) return; clearTimeout(rt);
    rt = setTimeout(function () {
      if (isMobile() !== mobile) { var k = idx / Math.max(1, slides.length - 1); rebuild(); fit(); go(Math.round(k * (slides.length - 1))); }   // 폰↔PC를 넘나들면 장 수가 달라지니 비율로 이어 간다
      else fit();
    }, 120);
  });

  /* 스타일을 먼저 받고 나서 버튼을 달고 해시를 본다 — 스타일 없이 슬라이드가 잠깐 비치지 않게 */
  var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = BASE + 'assets/deck.css?v=' + VER;
  link.onload = link.onerror = function () {
    var dl = hero.querySelector('[data-print]');
    if (dl) { var open = document.createElement('a'); open.className = 'btn ghost'; open.href = '#slides'; open.textContent = '슬라이드로 보기'; dl.parentNode.insertBefore(open, dl.nextSibling); }
    window.addEventListener('hashchange', fromHash);
    fromHash();
  };
  document.head.appendChild(link);
})();

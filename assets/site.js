(function () {
  'use strict';

  /* ---------- 편집 모드(#edit): 편집기 스크립트만 따로 불러온다 ---------- */
  var BASE = (function () {
    var s = document.currentScript;
    if (!s) { var all = document.querySelectorAll('script[src]'); s = all[all.length - 1]; }
    return (s && s.src || '').replace(/assets\/site\.js.*$/, '');
  })();
  window.__EGO_BASE = BASE;
  function loadEditor() {
    if (window.__edLoaded) { location.reload(); return; }  // 나갔다가 다시 켤 때는 새로 불러온다
    window.__edLoaded = true;
    var es = document.createElement('script');
    es.src = BASE + 'assets/edit.js?v=' + Date.now();
    document.body.appendChild(es);
  }
  if (location.hash === '#edit') loadEditor();
  // 주소창에 #edit만 덧붙이면 페이지가 새로 뜨지 않으므로, 해시 변경도 잡는다
  window.addEventListener('hashchange', function () { if (location.hash === '#edit') loadEditor(); });

  /* ---------- 내비 ---------- */
  var nav = document.getElementById('nav');
  var isHome = document.body.classList.contains('home');
  function onScroll() { nav.classList.toggle('solid', !isHome || window.scrollY > 24); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // 터치 기기: 드롭다운 있는 탭은 첫 탭에 펼치고, 두 번째 탭에 이동
  var touch = window.matchMedia('(hover: none)').matches;
  function closeDd(li) { li.classList.remove('open'); var tg = li.querySelector('.dd-trigger'); tg && tg.setAttribute('aria-expanded', 'false'); }
  document.querySelectorAll('.menu li.has-dd > a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var li = a.parentElement, isBtn = a.classList.contains('dd-trigger');
      if (isBtn || (touch && !li.classList.contains('open'))) {
        e.preventDefault();
        var willOpen = !li.classList.contains('open');
        document.querySelectorAll('.menu li.open').forEach(closeDd);
        if (willOpen) li.classList.add('open');
        if (isBtn) a.setAttribute('aria-expanded', String(willOpen));
      }
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.menu li')) document.querySelectorAll('.menu li.open').forEach(closeDd);
  });
  // 클릭으로 연 드롭다운(.open)은 마우스가 탭을 떠나거나 포커스가 빠지면 닫는다 — 안 그러면 CONTENTS를 누른 뒤
  // BRAND에 마우스를 올렸을 때 두 드롭다운이 겹쳐 떴다(2026-09-26 사용자 신고). 터치는 바깥을 누르면 닫히니 마우스만.
  document.querySelectorAll('.menu li.has-dd').forEach(function (li) {
    li.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') closeDd(li); });
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) closeDd(li); });
  });

  /* ---------- 컬처덱 목차 하이라이트 ---------- */
  var toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (l) { var t = document.getElementById(l.getAttribute('href').slice(1)); if (t) map[t.id] = l; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { links.forEach(function (l) { l.classList.remove('on'); }); map[en.target.id].classList.add('on'); }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }
  document.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });

  /* ---------- 공고 (나인하이어 ATS 실시간) ---------- */
  var NH = 'https://api.ninehire.com/identity-access/homepage/recruitments?companyId=5fd88f20-09f9-11f0-b150-cb7581ab7290&page=1&countPerPage=50&order=created_at_desc';
  var POST = 'https://egoidsm.ninehire.site/job_posting/';
  var ET = { full_time: '정규직', contractor: '계약직', intern: '인턴', part_time: '파트타임', freelancer: '프리랜서' };
  var BRAND_KEYS = {
    gulgang: ['gulgang', '굴강', '굴뚝'], mnms: ['미뇽', 'mnms', 'mignon'], vasol: ['바쏠', 'vasol'],
    huug: ['휴그', 'huug'], feura: ['퓌라', 'feura'], faverse: ['페이버스', 'faverse']
  };
  var BRAND_LABEL = { all: '전체', gulgang: '굴뚝강아지', mnms: '미뇽맨션', vasol: '바쏠', huug: '휴그', feura: '퓌라', faverse: '페이버스', egoidsm: '에고이즘 · 공통' };
  // API가 막혔을 때 보여줄 정적 목록 (2026-09-12 기준) — 가끔 갱신
  var FALLBACK = [
    { title: '[feura] 마케팅 디자이너', aff: '퓌라(feura)', group: '디자인', types: ['정규직', '계약직'], key: '1KUbruO3' },
    { title: '[에고이즘] AX Engineer (채용연계형 인턴)', aff: '에고이즘', group: '개발', types: ['인턴'], key: '0oslCSTD' },
    { title: '[에고이즘] 브랜드 MD (채용연계형 인턴)', aff: '에고이즘', group: 'MD', types: ['인턴'], key: 'w7O5E6BK' },
    { title: '[GULGANG] 브랜드 마케터', aff: 'GULGANG(굴강)', group: '마케팅', types: ['정규직', '계약직'], key: '1kbJm422' },
    { title: '[바쏠] 브랜드 마케터', aff: '바쏠(vasol)', group: '마케팅', types: ['정규직', '계약직'], key: 'K7UiwytW' },
    { title: '[그로스팀] AX Engineer', aff: '그로스팀', group: '개발', types: ['정규직', '계약직'], key: 'iq0Jfxvs' },
    { title: '[GULGANG] 온라인 MD', aff: 'GULGANG(굴강)', group: 'MD', types: ['정규직', '계약직'], key: 'YENhiODQ' }
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function brandOf(aff) {
    var s = (aff || '').toLowerCase();
    for (var k in BRAND_KEYS) if (BRAND_KEYS[k].some(function (w) { return s.indexOf(w.toLowerCase()) > -1; })) return k;
    return 'egoidsm';
  }
  function normalize(r) {
    var aff = r.affiliation && r.affiliation.title;
    return {
      title: r.externalTitle || r.title, aff: aff || '에고이즘', group: r.jobGroup && r.jobGroup.title || '',
      types: (r.employmentType || []).map(function (t) { return ET[t] || t; }), key: r.addressKey, brand: brandOf(aff)
    };
  }
  function loadJobs() {
    try {
      var c = sessionStorage.getItem('nhjobs');
      if (c) { var o = JSON.parse(c); if (Date.now() - o.t < 600000) return Promise.resolve(o.d); }
    } catch (e) { }
    return fetch(NH, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        var d = (j.results || []).filter(function (x) { return x.status === 'in_progress'; }).map(normalize);
        try { sessionStorage.setItem('nhjobs', JSON.stringify({ t: Date.now(), d: d })); } catch (e) { }
        return d;
      })
      .catch(function () { return FALLBACK.map(function (j) { j.brand = brandOf(j.aff); return j; }); });
  }
  function renderList(el, list, key) {
    if (!el) return;
    if (!list.length) {
      var msg = key && key !== 'all' ? BRAND_LABEL[key] + '에는 지금 열린 공고가 없습니다. ' : '지금은 열린 공고가 없습니다. ';
      el.innerHTML = '<div class="empty">' + msg + '인재풀에 남겨두시면 자리가 열릴 때 먼저 연락드립니다.</div>';
      return;
    }
    el.innerHTML = list.map(function (j) {
      return '<a class="job" href="' + POST + esc(j.key) + '" target="_blank" rel="noopener">' +
        '<div><div class="t">' + esc(j.title) + '</div><div class="meta">' +
        (j.aff ? '<em>' + esc(j.aff) + '</em>' : '') + (j.group ? '<span>' + esc(j.group) + '</span>' : '') +
        (j.types && j.types.length ? '<span>' + esc(j.types.join(' · ')) + '</span>' : '') +
        '</div></div><span class="ar">↗</span></a>';
    }).join('');
  }

  var containers = document.querySelectorAll('[data-jobs]');
  var counters = document.querySelectorAll('[data-jobs-count]');
  if (containers.length || counters.length) {
    loadJobs().then(function (jobs) {
      counters.forEach(function (el) { el.textContent = jobs.length; });
      containers.forEach(function (el) {
        var f = el.getAttribute('data-jobs');
        renderList(el, f === 'all' ? jobs : jobs.filter(function (j) { return j.brand === f; }), f);
      });
      var fb = document.getElementById('jobfilters');
      if (fb) {
        var keys = ['all', 'gulgang', 'mnms', 'vasol', 'huug', 'feura', 'faverse', 'egoidsm'].filter(function (k) {
          return k === 'all' || jobs.some(function (j) { return j.brand === k; });
        });
        fb.innerHTML = keys.map(function (k) {
          var n = k === 'all' ? jobs.length : jobs.filter(function (j) { return j.brand === k; }).length;
          return '<button type="button" class="chip' + (k === 'all' ? ' on' : '') + '" data-f="' + k + '">' + BRAND_LABEL[k] + '<span>' + n + '</span></button>';
        }).join('');
        fb.addEventListener('click', function (e) {
          var b = e.target.closest('.chip'); if (!b) return;
          fb.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
          var k = b.getAttribute('data-f');
          renderList(document.querySelector('[data-jobs="all"]'), k === 'all' ? jobs : jobs.filter(function (j) { return j.brand === k; }), k);
        });
      }
    });
  }
  /* ---------- 브랜드 허브: 커버플로 ----------
     자리 공식·수치는 site.css 커버플로 주석과 같다(레퍼런스 coverflow.ashishgogula.in 실측). pos는 연속값이라 드래그 중에도 손을 그대로 따라온다.
     여섯 장은 끝없이 돈다 — 보이는 창은 가운데 기준 [-3.5, 2.5)(왼쪽 셋·오른쪽 둘)이고, 이음새 반 칸에서 흐려졌다가 반대편에서 나타난다. */
  var cf = document.querySelector('.cflow');
  if (cf) (function () {
    var stage = cf.querySelector('.cf-stage'), items = [].slice.call(cf.querySelectorAll('.cf-item')), caps = [].slice.call(cf.querySelectorAll('.cf-cap'));
    var N = items.length, LO = -N / 2 - .5;
    var TAU = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : .16;   // 넘김 = 지수 감쇠, τ≈0.16s (실측: 0.3초에 85%, 0.85초에 정착)
    var pos = 0, target = 0, raf = 0, last = 0, drag = null, moved = false, wheelT = 0;
    var fill = cf.querySelector('.pl-fill'), noEl = cf.querySelector('.pl-no'), totEl = cf.querySelector('.pl-total'), playBtn = cf.querySelector('.pl-play');
    var DUR = 4, playing = false, elapsed = 0;   // 재생: 브랜드 하나 = 4초짜리 곡. 손으로 넘기면 그 곡부터 다시(음악 앱처럼 재생은 계속)
    function editing() { return document.body.classList.contains('editing'); }
    function unit() { return items[0].offsetWidth * 250 / 400; }   // 한 칸 = 가운데→첫 이웃 거리(px)
    function wrap(d) { return ((d - LO) % N + N) % N + LO; }
    function cur() { return ((Math.round(target) % N) + N) % N; }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function progress() {
      if (fill) fill.style.setProperty('--pp', Math.min(1, elapsed / DUR).toFixed(4));
      if (noEl) noEl.textContent = pad(cur() + 1);
    }
    function render() {
      for (var i = 0; i < N; i++) {
        var d = wrap(i - pos), a = Math.abs(d), sg = d < 0 ? -1 : 1, t = Math.min(a, 1), st = items[i].style;
        st.setProperty('--tx', (sg * (a < 1 ? 250 * a : 250 + (a - 1) * 100)).toFixed(2));
        st.setProperty('--tz', (-200 * t).toFixed(2));
        st.setProperty('--ry', (-sg * 50 * t).toFixed(3));
        st.setProperty('--br', (1 - .5 * t).toFixed(3));
        st.setProperty('--op', Math.max(0, Math.min(1, (d - LO) / .5, (LO + N - d) / .5)).toFixed(3));
        st.setProperty('--z', String(Math.round(1000 - a * 10)));
        var co = Math.max(0, 1 - a * 1.6);
        caps[i].style.opacity = co.toFixed(3);
        caps[i].setAttribute('aria-hidden', co > .5 ? 'false' : 'true');
      }
    }
    function tick(now) {
      var real = (now - last) / 1000, dt = Math.min(.05, real); last = now;   // dt는 감쇠 안정용으로 자르고, 재생 타이머는 실제 시간으로 센다
      if (playing && !drag) { elapsed += Math.min(.25, real); if (elapsed >= DUR) { elapsed = 0; target = Math.round(target) + 1; } }
      if (!drag) pos = TAU ? pos + (target - pos) * (1 - Math.exp(-dt / TAU)) : target;
      if (!drag && Math.abs(target - pos) < .0005) pos = target;
      render(); progress();
      if (drag || pos !== target || playing) { raf = requestAnimationFrame(tick); return; }
      raf = 0;
      if (Math.abs(pos) > 60) { pos = target = wrap(pos); }   // 계속 돌려도 숫자가 커지지 않게
    }
    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    function go(i) { var b = Math.round(target), dd = ((i - b) % N + N) % N; if (dd > N / 2) dd -= N; target = b + dd; elapsed = 0; kick(); }
    function skip(n) { target = Math.round(target) + n; elapsed = 0; kick(); }
    function setPlay(on) {
      playing = on; cf.classList.toggle('playing', on);
      if (playBtn) { playBtn.setAttribute('aria-pressed', String(on)); playBtn.setAttribute('aria-label', on ? '일시정지' : '재생'); }
      kick();
    }
    if (playBtn) playBtn.addEventListener('click', function () { setPlay(!playing); });
    [['.pl-prev', -1], ['.pl-next', 1]].forEach(function (b) { var el = cf.querySelector(b[0]); if (el) el.addEventListener('click', function () { skip(b[1]); }); });
    if (totEl) totEl.textContent = pad(N);

    items.forEach(function (el, i) {
      el.addEventListener('click', function (e) {
        if (moved) { e.preventDefault(); return; }                     // 드래그를 마치며 뗀 손은 클릭이 아니다
        if (i !== cur() || editing()) { e.preventDefault(); go(i); }   // 옆 커버는 가운데로 불러오기만, 가운데 커버는 그 브랜드로
      });
      el.addEventListener('focus', function () { if (el.matches(':focus-visible')) go(i); });   // Tab으로 들어오면 그 커버를 가운데로
    });
    cf.addEventListener('keydown', function (e) {
      var n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!n) return;
      e.preventDefault(); skip(n);
      if (items.indexOf(document.activeElement) > -1) items[cur()].focus({ preventScroll: true });   // 커버에 초점이 있었으면 새 가운데로(Enter가 그 브랜드를 열도록)
    });
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || editing()) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, p: 0, axis: '', lx: e.clientX, lt: e.timeStamp, v: 0 };
      moved = false;
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) <= Math.abs(dy)) { drag = null; return; }   // 세로로 움직이면 페이지 스크롤에 양보
        drag.axis = 'x'; drag.p = pos + dx / unit(); moved = true;
        stage.setPointerCapture(e.pointerId); cf.classList.add('dragging');
      }
      var dt = e.timeStamp - drag.lt;
      if (dt > 0) { drag.v = (e.clientX - drag.lx) / dt; drag.lx = e.clientX; drag.lt = e.timeStamp; }
      pos = target = drag.p - dx / unit(); elapsed = 0; kick();
    });
    function release(e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.axis) { target = Math.round(pos - drag.v * 200 / unit()); elapsed = 0; kick(); }   // 던진 속도만큼 한두 칸 더
      drag = null; cf.classList.remove('dragging');
      setTimeout(function () { moved = false; }, 0);
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('wheel', function (e) {
      var dx = e.deltaX * (e.deltaMode === 1 ? 16 : 1);
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || editing()) return;   // 세로 휠은 페이지 스크롤 그대로
      e.preventDefault(); target += dx / (unit() * 1.5); elapsed = 0; kick();
      clearTimeout(wheelT); wheelT = setTimeout(function () { target = Math.round(target); kick(); }, 120);
    }, { passive: false });
    render(); progress();
  })();
})();

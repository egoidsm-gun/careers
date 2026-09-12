(function () {
  'use strict';

  /* ---------- 내비 ---------- */
  var nav = document.getElementById('nav');
  var isHome = document.body.classList.contains('home');
  function onScroll() { nav.classList.toggle('solid', !isHome || window.scrollY > 24); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var burger = document.getElementById('burger'), mmenu = document.getElementById('mmenu');
  if (burger && mmenu) {
    burger.addEventListener('click', function () {
      var open = mmenu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
      burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) nav.classList.add('solid');
    });
  }
  // 터치 기기: 드롭다운 있는 탭은 첫 탭에 펼치고, 두 번째 탭에 이동
  var touch = window.matchMedia('(hover: none)').matches;
  document.querySelectorAll('.menu li.has-dd > a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var li = a.parentElement;
      if (touch && !li.classList.contains('open')) {
        e.preventDefault();
        document.querySelectorAll('.menu li.open').forEach(function (x) { x.classList.remove('open'); });
        li.classList.add('open');
      }
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.menu li')) document.querySelectorAll('.menu li.open').forEach(function (x) { x.classList.remove('open'); });
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
      var msg = key === 'search' ? '검색 결과가 없습니다. 다른 키워드로 찾아보세요. '
        : (key && key !== 'all' ? BRAND_LABEL[key] + '에는 지금 열린 공고가 없습니다. ' : '지금은 열린 공고가 없습니다. ');
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

  /* ---------- 포지션 검색 오버레이 (넷플릭스 바의 돋보기 자리) ---------- */
  var sov = document.getElementById('sov'), sbtn = document.getElementById('sbtn'), sclose = document.getElementById('sclose'),
    sinput = document.getElementById('sinput'), sres = document.getElementById('sres'), sform = document.getElementById('sform');
  var stimer = null;
  function runSearch() {
    var q = (sinput.value || '').trim().toLowerCase();
    loadJobs().then(function (jobs) {
      var list = q ? jobs.filter(function (j) {
        return [j.title, j.aff, j.group, (j.types || []).join(' ')].join(' ').toLowerCase().indexOf(q) > -1;
      }) : jobs;
      renderList(sres, list, q ? 'search' : 'all');
    });
  }
  function openSearch() {
    if (!sov) return;
    if (mmenu && mmenu.classList.contains('open')) { mmenu.classList.remove('open'); burger && burger.setAttribute('aria-expanded', 'false'); }
    sov.classList.add('open');
    document.body.style.overflow = 'hidden';
    sbtn && sbtn.setAttribute('aria-expanded', 'true');
    setTimeout(function () { sinput.focus(); }, 40);
    runSearch();
  }
  function closeSearch() {
    if (!sov) return;
    sov.classList.remove('open');
    document.body.style.overflow = '';
    sbtn && sbtn.setAttribute('aria-expanded', 'false');
  }
  if (sov) {
    sbtn && sbtn.addEventListener('click', openSearch);
    sclose && sclose.addEventListener('click', closeSearch);
    document.querySelectorAll('[data-open-search]').forEach(function (b) { b.addEventListener('click', openSearch); });
    sform && sform.addEventListener('submit', function (e) { e.preventDefault(); runSearch(); });
    sinput && sinput.addEventListener('input', function () { clearTimeout(stimer); stimer = setTimeout(runSearch, 120); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sov.classList.contains('open')) closeSearch(); });
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
})();

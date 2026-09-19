/* 편집 모드 — 주소 끝에 #edit 를 붙이면 site.js가 이 파일을 불러온다.
   문구를 직접 고치고 [저장]하면 GitHub 저장소의 원본 파일(src/pages/*.html)에 커밋되고,
   GitHub Actions가 사이트를 다시 만들어 1~2분 안에 반영한다. 토큰은 이 브라우저에만 저장된다.
   권한: 편집 UI는 저장소(egoidsm-gun/careers)에 쓰기 권한이 있는 GitHub 토큰을 확인한 뒤에만 켜진다.
   토큰이 없거나 권한이 없으면 아무것도 편집할 수 없다 — 진짜 잠금은 GitHub 쪽에 있다. */
(function () {
  'use strict';
  var BASE = window.__EGO_BASE || './';
  var CFG = { owner: 'egoidsm-gun', repo: 'careers', branch: 'main' };
  var TOKEN_KEY = 'ego_edit_token';
  var DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);  // 내 맥의 편집 서버에서 열었나
  var main = document.getElementById('main');
  var key = main && main.getAttribute('data-editkey');
  var rootPrefix = (main && main.getAttribute('data-root')) || '';
  if (!key) return;

  var css = [
    'body.editing [data-e]{outline:1px dashed rgba(237,109,32,.5);outline-offset:3px;border-radius:3px;cursor:text;transition:outline-color .15s}',
    'body.editing [data-e]:hover{outline-color:rgba(237,109,32,.95)}',
    'body.editing [data-e]:focus{outline:2px solid #ED6D20;outline-offset:3px;background:rgba(237,109,32,.07)}',
    'body.editing .hero .lines span,body.editing .hero .lead,body.editing .hero .btns,body.editing .hero .eyebrow{animation:none;opacity:1;transform:none}',
    "#ed-bar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:1000;display:flex;align-items:center;gap:8px;background:#141416;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:8px 10px 8px 18px;box-shadow:0 20px 60px rgba(0,0,0,.6);font:600 14px/1 'Pretendard Variable',Pretendard,-apple-system,sans-serif;color:#f4f2ed;white-space:nowrap}",
    "#ed-bar .ed-tag{color:#ED6D20;font-family:'Oswald',sans-serif;font-weight:600;letter-spacing:.12em;font-size:13px;margin-right:4px}",
    '#ed-bar .ed-n{color:#cfcbc3;margin-right:6px}',
    '#ed-bar button{font:inherit;border:1px solid rgba(255,255,255,.18);background:transparent;color:#f4f2ed;border-radius:999px;padding:9px 14px;cursor:pointer}',
    '#ed-bar button:hover{border-color:#fff}',
    '#ed-bar button.ed-primary{background:#ED6D20;border-color:#ED6D20;color:#fff}',
    '#ed-bar button.ed-primary:hover{background:#ff8a3d}',
    '#ed-bar button:disabled{opacity:.4;cursor:default}',
    '#ed-bar button.ed-link{border:0;color:#8e8a82;padding:9px 6px}',
    "#ed-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:1000;background:#1c1c1e;color:#f4f2ed;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:12px 16px;font:500 14px/1.5 'Pretendard Variable',Pretendard,-apple-system,sans-serif;max-width:min(560px,90vw);box-shadow:0 20px 60px rgba(0,0,0,.6);display:none}",
    '#ed-toast.show{display:block}',
    '#ed-toast.err{border-color:#ff6b6b}',
    '#ed-toast button{font:inherit;margin-left:10px;background:#ED6D20;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer}',
    "#ed-dlg{background:#141416;color:#f4f2ed;border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:26px;max-width:460px;width:92vw;font:500 15px/1.6 'Pretendard Variable',Pretendard,-apple-system,sans-serif}",
    '#ed-dlg::backdrop{background:rgba(0,0,0,.65)}',
    '#ed-dlg h3{margin:0 0 8px;font-size:20px}',
    '#ed-dlg p{margin:0 0 6px;color:#cfcbc3;font-size:14px}',
    '#ed-dlg a{color:#ED6D20}',
    '#ed-dlg input{width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:#0b0b0c;color:#fff;font:inherit;margin:14px 0}',
    '#ed-dlg .row{display:flex;gap:8px;justify-content:flex-end}',
    '#ed-dlg button{font:inherit;border:1px solid rgba(255,255,255,.18);background:transparent;color:#f4f2ed;border-radius:8px;padding:9px 16px;cursor:pointer}',
    '#ed-dlg button.ed-primary{background:#ED6D20;border-color:#ED6D20;color:#fff}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.body.classList.add('editing');

  var toastEl = document.createElement('div'); toastEl.id = 'ed-toast'; document.body.appendChild(toastEl);
  var toastTimer = null;
  function toast(msg, err, sticky, btn) {
    clearTimeout(toastTimer);
    toastEl.className = 'show' + (err ? ' err' : '');
    toastEl.textContent = msg;
    if (btn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = btn.label; b.onclick = btn.fn; toastEl.appendChild(b); }
    if (!sticky) toastTimer = setTimeout(function () { toastEl.className = ''; }, err ? 7000 : 4500);
  }

  function n(s) { return s.replace(/\s+/g, ' ').trim(); }
  /* 저장 직전 정리. <div>·<p>는 줄바꿈으로 바꾼다 — contenteditable에서 Enter는 insertLineBreak로 가로채 두었지만
     붙여넣기나 브라우저 기본 동작으로 블록이 끼어드는 경우가 있고, <p> 안에 <div>가 들어가면 파싱 규칙상
     그 자리에서 문단이 강제로 닫혀 뒷부분이 스타일 밖으로 튕겨 나간다(2026-09-19 크루 서브 카피 둘째 줄이
     작게 나온 원인). 나머지 태그는 손대지 않는다 — <br>·<span> 같은 건 문구에 쓰인다. */
  function clean(h) {
    return h.replace(/&nbsp;/g, ' ')
            .replace(/<(div|p)\b[^>]*>/gi, '<br>').replace(/<\/(div|p)>/gi, '')
            .replace(/^(\s*<br\s*\/?>)+/i, '')
            .replace(/(<br\s*\/?>)+\s*$/, '');
  }
  function changed() { return els.filter(function (el) { return n(el.innerHTML) !== n(orig[el.getAttribute('data-e')]); }); }
  function refresh() {
    var c = changed().length;
    document.getElementById('ed-n').textContent = c + '곳 수정';
    document.getElementById('ed-save').disabled = !c || locked;
  }

  function b64d(b) { var bin = atob(b.replace(/\n/g, '')); var u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  function b64e(s) { var u = new TextEncoder().encode(s), bin = ''; for (var i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); }

  function getToken(force) {
    var t = localStorage.getItem(TOKEN_KEY);
    if (t && !force) return Promise.resolve(t);
    return new Promise(function (resolve) {
      var dlg = document.getElementById('ed-dlg');
      if (!dlg) {
        dlg = document.createElement('dialog'); dlg.id = 'ed-dlg';
        dlg.innerHTML = '<h3>GitHub 토큰</h3>' +
          '<p>편집은 GitHub 저장소(egoidsm-gun/careers)에 <b>쓰기 권한이 있는 계정</b>만 할 수 있어요. 저장하면 원본 파일에 바로 커밋되고, 토큰은 이 브라우저에만 저장됩니다.</p>' +
          '<p>없다면 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">여기서 Fine-grained 토큰 만들기 ↗</a> — Repository access: <b>careers</b>만, Permissions: <b>Contents → Read and write</b>.</p>' +
          '<input type="password" id="ed-token-input" placeholder="github_pat_…" autocomplete="off">' +
          '<div class="row"><button type="button" id="ed-dlg-cancel">취소</button><button type="button" class="ed-primary" id="ed-dlg-ok">저장</button></div>';
        document.body.appendChild(dlg);
      }
      var input = dlg.querySelector('#ed-token-input'); input.value = t || '';
      dlg.querySelector('#ed-dlg-ok').onclick = function () {
        var v = input.value.trim();
        if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY);
        dlg.close(); resolve(v || null);
      };
      dlg.querySelector('#ed-dlg-cancel').onclick = function () { dlg.close(); resolve(null); };
      dlg.showModal(); input.focus();
    });
  }

  // 편집 내용을 파일별 패치로 묶는다 (검증용으로도 노출)
  function jsonText(el) { return JSON.stringify(el.textContent.replace(/\s+/g, ' ').trim()).slice(1, -1); }
  function plan(targets) {
    var byId = {}; map.items.forEach(function (it) { byId[it[0]] = it; });
    var files = {}, bad = [];
    targets.forEach(function (el) {
      var id = el.getAttribute('data-e'), it = byId[id];
      if (!it) return bad.push(id);
      var fi = it[4] || 0, kind = it[5] || 'html';
      (files[fi] = files[fi] || []).push({ id: id, s: it[1], e: it[2], expect: it[3], kind: kind, html: kind === 'json' ? jsonText(el) : clean(el.innerHTML) });
    });
    return { files: files, bad: bad };
  }
  function apply(src, patches) {
    for (var i = 0; i < patches.length; i++) {
      var p = patches[i], cur = src.slice(p.s, p.e);
      if (n(p.kind === 'json' ? cur : cur.split('{{root}}').join(rootPrefix)) !== p.expect) return { error: true };
    }
    var out = src;
    patches.slice().sort(function (a, b) { return b.s - a.s; }).forEach(function (p) { out = out.slice(0, p.s) + p.html + out.slice(p.e); });
    return { out: out };
  }
  window.__edPlan = function () { return plan(changed()); };
  window.__edApply = apply;

  var saving = false;
  function ghFetch(url, token, opt) {
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, opt.headers || {});
    return fetch(url, opt);
  }
  function saveFile(token, file, patches) {
    var url = 'https://api.github.com/repos/' + CFG.owner + '/' + CFG.repo + '/contents/' + file;
    return ghFetch(url + '?ref=' + CFG.branch, token).then(function (r) {
      if (r.status === 401 || r.status === 403 || r.status === 404) { localStorage.removeItem(TOKEN_KEY); throw new Error('토큰이 틀리거나 권한(Contents: Read and write)이 없어요. 토큰을 다시 넣어주세요.'); }
      if (!r.ok) throw new Error('GitHub에서 원본을 못 읽었어요 (' + r.status + ')');
      return r.json();
    }).then(function (j) {
      var res = apply(b64d(j.content), patches);
      if (res.error) throw new Error('원본이 이미 바뀌어 있어 저장을 멈췄어요. 새로고침한 뒤 다시 고쳐주세요.');
      return ghFetch(url, token, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '편집 모드: ' + file.split('/').pop() + ' 문구 ' + patches.length + '곳 수정', content: b64e(res.out), sha: j.sha, branch: CFG.branch })
      });
    }).then(function (put) { if (!put.ok) throw new Error('저장 실패 (' + put.status + ')'); });
  }
  function save() {
    if (saving) return;
    if (locked) return toast('저장한 내용이 배포되는 중이에요. 반영된 뒤 새로고침하고 이어서 편집하세요.');
    var ch = changed();
    if (!ch.length) return toast('바뀐 곳이 없어요.');
    if (!map) return toast('편집 지도를 아직 못 불러왔어요. 잠시 후 다시 눌러주세요.', true);
    var pl = plan(ch);
    if (pl.bad.length) return toast('알 수 없는 요소가 있어 저장을 멈췄어요. 새로고침 후 다시 시도해 주세요.', true);
    saving = true;
    if (DEV) {  // 로컬 편집 서버: 소스 반영 → 재빌드 → GitHub push까지 서버가 한다
      toast('저장 중…', false, true);
      fetch('/__save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: map.files, root: rootPrefix, patches: pl.files }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.ok) throw new Error(j.error || '저장 실패');
          locked = true;
          toast('반영됐어요 — 새로 불러옵니다. (GitHub에도 올라가는 중, 사이트엔 1~2분 뒤)', false, true);
          setTimeout(function () { location.reload(); }, 800);
        })
        .catch(function (e) { saving = false; toast(e.message || String(e), true, true); });
      return;
    }
    getToken().then(function (token) {
      if (!token) { saving = false; return; }
      toast('저장 중…', false, true);
      var idxs = Object.keys(pl.files);
      return idxs.reduce(function (chain, fi) {
        return chain.then(function () { return saveFile(token, map.files[fi], pl.files[fi]); });
      }, Promise.resolve()).then(function () {
        locked = true; saving = false;
        ch.forEach(function (el) { orig[el.getAttribute('data-e')] = el.innerHTML; });
        refresh();
        toast('저장 완료. GitHub가 사이트를 다시 만들고 있어요(1~2분) — 끝나면 알려드릴게요.', false, true);
        watchDeploy(token, Date.now());
      });
    }).catch(function (e) { saving = false; toast(e.message || String(e), true, true); });
  }

  function watchDeploy(token, since) {
    var tries = 0;
    var timer = setInterval(function () {
      if (++tries > 30) { clearInterval(timer); toast('배포가 오래 걸리네요. 잠시 후 새로고침해서 확인해 주세요.', false, true, { label: '새로고침', fn: function () { location.reload(); } }); return; }
      fetch('https://api.github.com/repos/' + CFG.owner + '/' + CFG.repo + '/actions/runs?branch=' + CFG.branch + '&per_page=1', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var run = j && j.workflow_runs && j.workflow_runs[0];
          if (!run || new Date(run.created_at).getTime() < since - 60000) return;
          if (run.status === 'completed') {
            clearInterval(timer);
            if (run.conclusion === 'success') toast('사이트에 반영됐어요. 새로고침하면 이어서 편집할 수 있어요.', false, true, { label: '새로고침', fn: function () { location.reload(); } });
            else toast('배포가 실패했어요(' + run.conclusion + '). 잠시 후 다시 시도하거나 담당자에게 알려주세요.', true, true);
          }
        }).catch(function () { });
    }, 10000);
  }

  /* ---------- 권한 확인 → 편집 UI ---------- */
  var els = [], orig = {}, map = null, locked = false;
  function leave() {
    document.body.classList.remove('editing');
    history.replaceState(null, '', location.pathname + location.search);
  }
  function validate(token) {
    return fetch('https://api.github.com/repos/' + CFG.owner + '/' + CFG.repo, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return !!(j && j.permissions && j.permissions.push); })
      .catch(function () { return false; });
  }
  function init() {
  var bar = document.createElement('div'); bar.id = 'ed-bar';
  bar.innerHTML = '<span class="ed-tag">EDIT</span><span class="ed-n" id="ed-n">0곳 수정</span>' +
    '<button type="button" class="ed-primary" id="ed-save" disabled>저장</button>' +
    '<button type="button" id="ed-reset">되돌리기</button>' +
    '<button type="button" id="ed-exit">나가기</button>' +
    '<button type="button" class="ed-link" id="ed-token">토큰</button>';
  document.body.appendChild(bar);
  els = Array.prototype.slice.call(document.querySelectorAll('[data-e]'));
  els.forEach(function (el) { orig[el.getAttribute('data-e')] = el.innerHTML; });
  fetch(BASE + 'assets/edit/' + key + '.json?v=' + Date.now())
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (j) { map = j; })
    .catch(function () { toast('편집 지도를 못 불러왔어요. 새로고침해 보세요.', true, true); });

  els.forEach(function (el) {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.addEventListener('input', refresh);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, t);
    });
  });
  // 편집 중에는 문구 안의 링크·버튼이 동작하지 않게 (글자만 고치도록)
  document.addEventListener('click', function (e) {
    var t = e.target.closest('a, button');
    if (t && t.closest('[data-e]')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.addEventListener('beforeunload', function (e) { if (changed().length && !locked) { e.preventDefault(); e.returnValue = ''; } });

  document.getElementById('ed-save').addEventListener('click', save);
  document.getElementById('ed-reset').addEventListener('click', function () {
    els.forEach(function (el) { el.innerHTML = orig[el.getAttribute('data-e')]; }); refresh(); toast('되돌렸어요.');
  });
  document.getElementById('ed-exit').addEventListener('click', function () {
    if (changed().length && !locked && !confirm('저장하지 않은 수정이 있어요. 그냥 나갈까요?')) return;
    location.hash = ''; location.reload();
  });
  document.getElementById('ed-token').addEventListener('click', function () { getToken(true).then(function (t) { if (t) toast('토큰을 저장했어요.'); }); });
  refresh();
  toast('편집 모드 — 점선 친 글자를 눌러 고치고 [저장]을 누르세요. 줄바꿈은 Enter.', false);
  }

  if (DEV && !localStorage.getItem(TOKEN_KEY)) { init(); toast('편집 모드 — 점선 친 글자를 눌러 고치고 [저장]. 저장하면 바로 반영되고 GitHub에도 올라가요.', false); return; }
  getToken().then(function (token) {
    if (!token) { leave(); return; }
    toast('권한 확인 중…', false, true);
    return validate(token).then(function (ok) {
      if (ok) { init(); return; }
      localStorage.removeItem(TOKEN_KEY);
      toast('이 저장소에 편집 권한이 있는 GitHub 토큰이 아니에요. 편집 모드를 닫습니다.', true, true);
      setTimeout(leave, 3000);
    });
  });
})();

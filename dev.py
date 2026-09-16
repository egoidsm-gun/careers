#!/usr/bin/env python3
"""로컬 편집 서버 — _site/를 서빙하고, 편집 모드(#edit)의 저장을 받아
소스(src/)에 반영 → 즉시 재빌드 → 뒤에서 GitHub에 커밋·푸시한다.
  python3 careers/dev.py   (127.0.0.1:8124 — 이 맥 안에서만 접속됨, 토큰 불필요)
"""
import base64
import json
import os
import pathlib
import re
import subprocess
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import build  # noqa: E402

PORT = int(os.environ.get('PORT', 8124))
LOCK = threading.Lock()


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def apply_patches(text, patches, root):
    """편집기와 같은 규칙: UTF-16 오프셋 구간이 지도의 정규화 문자열과 일치할 때만 덧쓴다."""
    u = text.encode('utf-16-le')
    for p in patches:
        cur = u[2 * p['s']:2 * p['e']].decode('utf-16-le')
        chk = cur if p.get('kind') == 'json' else cur.replace('{{root}}', root)
        if norm(chk) != p['expect']:
            raise ValueError(f"원본 불일치: {p.get('id', '?')} — 페이지를 새로 불러온 뒤 다시 고쳐주세요")
    for p in sorted(patches, key=lambda x: -x['s']):
        u = u[:2 * p['s']] + p['html'].encode('utf-16-le') + u[2 * p['e']:]
    return u.decode('utf-16-le')


def git(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)


def publish(msg):
    """커밋 → (원격 변경 흡수) → 푸시. 토큰은 키체인에서. 실패해도 로컬 커밋은 남는다."""
    with LOCK:
        git('add', '-A', 'src')
        git('commit', '-q', '-m', msg)
        r = subprocess.run(['security', 'find-generic-password', '-s', 'careers-deploy:github.com', '-w'],
                           capture_output=True, text=True)
        tok = r.stdout.strip()
        if not tok:
            print('키체인에 토큰 없음 — 커밋만 하고 push 생략', flush=True)
            return
        hdr = 'Authorization: Basic ' + base64.b64encode(f'x-access-token:{tok}'.encode()).decode()
        git('-c', 'credential.helper=', '-c', f'http.extraheader={hdr}', 'pull', '-q', '--rebase', 'origin', 'main')
        p = git('-c', 'credential.helper=', '-c', f'http.extraheader={hdr}', 'push', '-q', 'origin', 'main')
        print('push:', 'ok' if p.returncode == 0 else p.stderr.strip()[:300], flush=True)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT / '_site'), **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')  # 미리보기가 옛 파일을 붙들지 않게
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.path.startswith('/__'):
            super().log_message(fmt, *args)

    def do_POST(self):
        if self.path != '/__save':
            self.send_error(404)
            return
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
            files, root, changed = body['files'], body.get('root', ''), []
            with LOCK:
                for fi, patches in body['patches'].items():
                    rel = files[int(fi)]
                    path = (ROOT / rel).resolve()
                    if not str(path).startswith(str((ROOT / 'src').resolve())):
                        raise ValueError(f'허용되지 않은 파일: {rel}')
                    path.write_text(apply_patches(path.read_text(), patches, root))
                    changed.append((rel, len(patches)))
                build.main()
            msg = '편집 모드(로컬): ' + ', '.join(f'{pathlib.Path(r).name} {n}곳' for r, n in changed)
            threading.Thread(target=publish, args=(msg,), daemon=True).start()
            out, code = json.dumps({'ok': True, 'changed': changed}, ensure_ascii=False).encode(), 200
        except Exception as e:  # 편집기에 그대로 보여준다
            out, code = json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False).encode(), 400
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)


if __name__ == '__main__':
    build.main()
    print(f'편집 서버 http://localhost:{PORT}/  — #edit 로 열면 저장이 바로 반영되고 GitHub에도 올라갑니다', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()

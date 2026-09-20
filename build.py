#!/usr/bin/env python3
"""에고이즘 채용 사이트 빌드.

src/pages/*.html (앞머리 JSON 주석 = 페이지 메타) + src/layout.html → _site/ (GitHub Actions가 빌드·배포)
  python3 build.py            # 블로그 RSS는 캐시(src/data/blog.json) 우선
  python3 build.py --refresh  # RSS를 새로 받아 캐시 갱신 후 빌드
편집 모드(#edit): 문구 요소마다 data-e="페이지:번호"를 붙이고, 소스 파일 안의 위치(UTF-16 오프셋)를
_site/assets/edit/<페이지>.json 에 적어 둔다. 브라우저 편집기가 그 위치를 GitHub의 원본 파일에 그대로 덧쓴다.
"""
import datetime
import email.utils
import html
import json
import pathlib
import re
import subprocess
import sys
import urllib.request
import shutil
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent
SRC, PAGES, DATA = ROOT / 'src', ROOT / 'src' / 'pages', ROOT / 'src' / 'data'
OUT = ROOT / '_site'
SITE = 'https://egoidsm-gun.github.io/careers/'   # OG·canonical 절대 URL에만 쓰인다(페이지 링크는 전부 {{root}} 상대경로)
# 정식 도메인 연결은 2026-09-20에 준비만 하고 되돌렸다 — DNS가 Cloudflare에 있는데 계정을 못 찾아서다.
# 다시 붙일 때: SITE를 https://egoidsm.com/ 로, 아래 DOMAIN·CNAME 줄의 주석을 풀고, layout.html의 noindex를 지운 뒤
#   PUT /repos/egoidsm-gun/careers/pages -d '{"cname":"egoidsm.com"}'. ★ DNS를 먼저 바꿀 것 — 순서를 어기면 볼 수 있는 주소가 사라진다.
# DOMAIN = 'egoidsm.com'   # _site/CNAME 으로 나간다. Pages 설정(API cname)과 같아야 한다
# 채용 링크가 가는 곳 — 사이트 안 recruiting/ 이 아니라 ATS(나인하이어). 공고 카드·상세(assets/site.js POST)와 같은 호스트다.
# 상단 RECRUITING 버튼(layout.html)뿐 아니라 페이지 본문의 채용 버튼 9개도 {{ats}}를 쓴다({{content}} 치환이 {{ats}}보다 먼저라 본문에서도 동작한다).
# ★ layout.html에는 반드시 {{ats}} 자리표시자로 둘 것 — URL을 직접 박으면 부모 <div class="nav-right">의 내용에 {{ 가 사라져
#   scan_editable이 그 div를 '편집 가능한 잎'으로 잡아 버리고, 편집 지도가 RECRUITING 대신 <a> 태그 통째를 가리킨다(실측).
ATS = 'https://egoidsm.ninehire.site'
BLOG_RSS = 'https://egoidsmblog.com/rss'

NAV_FILE = SRC / 'nav.json'   # 상단 알약·드롭다운 글자 — 편집 모드에서 고칠 수 있게 데이터 파일로 분리
NAV = json.loads(NAV_FILE.read_text())

# RSS 30개 창 밖에 있는 예전 크루 인터뷰 (구 사이트에 걸려 있던 글)
LEGACY_INTERVIEWS = [
    {'title': '1년 간 3명에서 37억!? 압도적인 효율을 만드는 법', 'link': 'https://egoidsmblog.com/1년-간-3명에서-37억-압도적인-효율을-만드는-법-40128', 'date': '', 'cat': '크루 인터뷰', 'img': '', 'who': '휴그팀 MD'},
    {'title': '에고이즘의 특별한 조직문화', 'link': 'https://egoidsmblog.com/에고이즘의-특별한-조직문화-40466', 'date': '', 'cat': '크루 인터뷰', 'img': '', 'who': '경영팀 HR'},
    {'title': '스타트업, 그 속에서 성공하기 위한 우리들만의 채용 방식', 'link': 'https://egoidsmblog.com/%EC%8A%A4%ED%83%80%ED%8A%B8%EC%97%85-%EC%B1%84%EC%9A%A9-%EC%A4%91%EC%9A%94%ED%95%9C-%EC%9D%B4%EC%9C%A0-40490', 'date': '', 'cat': '크루 인터뷰', 'img': '', 'who': '경영팀 HR'},
    {'title': '끊임없는 성장의 비결', 'link': 'https://egoidsmblog.com/%EB%81%8A%EC%9E%84%EC%97%86%EB%8A%94-%EC%84%B1%EC%9E%A5%EC%9D%98-%EB%B9%84%EA%B2%B0-40264', 'date': '', 'cat': '크루 인터뷰', 'img': '', 'who': '미뇽맨션팀 MD'},
]


def href(root, h):
    return h if h.startswith(('http', '#', 'mailto:')) else root + h


def esc(s):
    return html.escape(s or '', quote=True)


def fetch_blog(force=False):
    cache = DATA / 'blog.json'
    if cache.exists() and not force:
        return json.loads(cache.read_text())
    xml = ''
    try:
        req = urllib.request.Request(BLOG_RSS, headers={'User-Agent': 'Mozilla/5.0'})
        xml = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', 'ignore')
    except Exception as e:  # 이 맥의 파이썬은 인증서가 없어 SSL 실패 → curl로 재시도
        try:
            xml = subprocess.run(['curl', '-sL', '-m', '20', '-A', 'Mozilla/5.0', BLOG_RSS],
                                 capture_output=True, text=True, timeout=30).stdout
        except Exception as e2:
            print('RSS 실패:', e, e2)
    if '<item>' not in xml:  # 오프라인이면 캐시로
        print('RSS 없음 → 캐시 사용')
        return json.loads(cache.read_text()) if cache.exists() else []
    posts = []
    for it in re.findall(r'<item>(.*?)</item>', xml, re.S):
        def g(k):
            m = re.search(r'<' + k + r'[^>]*>(.*?)</' + k + '>', it, re.S)
            return html.unescape(re.sub(r'<!\[CDATA\[|\]\]>', '', m.group(1))).strip() if m else ''
        img = re.search(r'<enclosure[^>]+url="([^"]+)"', it)
        d = email.utils.parsedate_to_datetime(g('pubDate')) if g('pubDate') else None
        posts.append({'title': g('title'), 'link': g('link'), 'date': d.strftime('%Y.%m.%d') if d else '',
                      'cat': g('category'), 'img': html.unescape(img.group(1)) if img else ''})
    DATA.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(posts, ensure_ascii=False, indent=1))
    return posts


def post_cards(posts, cat, n):
    sel = [p for p in posts if cat == 'all' or p['cat'] == cat][:n]
    out = []
    for p in sel:
        img = f'<img src="{esc(p["img"])}" alt="" loading="lazy">' if p.get('img') else ''
        meta = p.get('who') or p.get('date') or ''
        out.append(
            f'<a class="post" href="{esc(p["link"])}" target="_blank" rel="noopener">'
            f'<div class="thumb">{img}</div><div class="pb"><span class="cat">{esc(p["cat"])}</span>'
            f'<b>{esc(p["title"])}</b><time>{esc(meta)}</time></div></a>')
    return '\n'.join(out) or '<p class="mute">아직 글이 없습니다.</p>'


def render_nav(root, section, ids):
    """가운데 알약 탭 — RECRUITING은 오른쪽 사각 버튼이므로 알약에서 뺀다. ids: 편집 모드용 data-e."""
    items = []
    for n in NAV:
        if n['key'] == 'recruiting':
            continue
        cls = ('on ' if n['key'] == section else '') + ('has-dd' if n['subs'] else '')
        dd = ''
        if n['subs']:
            dd = '<div class="dd">' + ''.join(
                f'<a href="{href(root, h)}" data-e="{ids[(n["key"], i)]}"{" target=\"_blank\" rel=\"noopener\"" if h.startswith("http") else ""}>{esc(l)}</a>'
                for i, (h, l) in enumerate(n['subs'])) + '</div>'
        de = f' data-e="{ids[(n["key"], None)]}"'
        trig = (f'<a href="{href(root, n["href"])}"{de}>{esc(n["label"])}</a>' if n['href']
                else f'<a href="#" class="dd-trigger" role="button" aria-haspopup="true" aria-expanded="false"{de}>{esc(n["label"])}</a>')
        items.append(f'<li class="{cls.strip()}">{trig}{dd}</li>')
    return ''.join(items)


def nav_edit_items(file_idx):
    """nav.json 안에서 각 라벨 문자열의 위치(UTF-16 오프셋)를 찾아 편집 지도 항목과 data-e id를 만든다."""
    raw = NAV_FILE.read_text()
    items, ids, cursor, k = [], {}, 0, 0
    for n in NAV:
        for sub_i, label in [(None, n['label'])] + [(i, l) for i, (h, l) in enumerate(n['subs'])]:
            enc = json.dumps(label, ensure_ascii=False)
            at = raw.index(enc, cursor)
            s_, e_ = at + 1, at + len(enc) - 1
            eid = f'nav:{k}'; k += 1
            items.append([eid, u16(raw[:s_]), u16(raw[:e_]), norm(enc[1:-1]), file_idx, 'json'])
            ids[(n['key'], sub_i)] = eid
            cursor = e_
    return items, ids


# ---------- 편집 모드: 소스 스캔 ----------
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
# 이 태그를 자손으로 가진 요소는 통째로 편집 대상이 되지 않는다(그 안의 잎 요소들이 대상)
CONTAINER = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'blockquote', 'summary', 'figcaption',
             'div', 'ul', 'ol', 'dl', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'section', 'article', 'aside',
             'nav', 'header', 'footer', 'form', 'details', 'main', 'figure', 'iframe', 'script', 'style', 'svg', 'pre'}
SKIP_SELF = {'script', 'style', 'iframe', 'svg', 'html', 'head', 'body', 'title', 'meta', 'link', 'img', 'br', 'hr', 'i'}


class Scan(HTMLParser):
    """요소별 시작태그 위치·내용 구간을 기록한다 (오프셋은 원본 문자열 기준)."""

    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.lines = [0] + [m.end() for m in re.finditer('\n', text)]
        self.stack, self.nodes = [], []

    def pos(self):
        ln, col = self.getpos()
        return self.lines[ln - 1] + col

    def handle_starttag(self, tag, attrs):
        p = self.pos()
        raw = self.get_starttag_text() or ''
        node = {'tag': tag, 'attrs': dict(attrs), 'start': p, 'cstart': p + len(raw), 'cend': None,
                'children': [], 'parent': self.stack[-1] if self.stack else None}
        if node['parent']:
            node['parent']['children'].append(node)
        self.nodes.append(node)
        if tag not in VOID and not raw.endswith('/>'):
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag:
                self.stack[i]['cend'] = self.pos()
                del self.stack[i:]
                return


def _has_container(node):
    return any(c['tag'] in CONTAINER or _has_container(c) for c in node['children'])


def _has_text(s):
    return re.search(r'\S', re.sub(r'<[^>]*>', '', s)) is not None


def u16(s):
    """JS 문자열 인덱스(UTF-16 코드 유닛)로 환산 — 이모지 때문에 필요."""
    return len(s.encode('utf-16-le')) // 2


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


def scan_editable(text, key, root):
    """편집 가능한 잎 요소에 data-e를 주입한 텍스트와, 편집 지도 항목을 돌려준다."""
    sc = Scan(text)
    sc.feed(text)
    sc.close()
    items, marks = [], []

    def walk(n, inside):
        ok, c = False, ''
        if n['cend'] is not None and n['tag'] not in SKIP_SELF and 'data-noedit' not in n['attrs']:
            c = text[n['cstart']:n['cend']]
            ok = '{{' not in c and not inside and not _has_container(n) and _has_text(c)
        if ok:
            eid = f'{key}:{len(items)}'
            items.append([eid, u16(text[:n['cstart']]), u16(text[:n['cend']]), norm(c.replace('{{root}}', root))])
            marks.append((n, eid))
        for ch in n['children']:
            walk(ch, inside or ok)

    for top in [n for n in sc.nodes if n['parent'] is None]:
        walk(top, False)
    out = text
    for n, eid in sorted(marks, key=lambda x: -x[0]['start']):
        raw = out[n['start']:n['cstart']]
        assert raw.endswith('>'), raw
        out = out[:n['start']] + raw[:-1] + f' data-e="{eid}">' + out[n['cstart']:]
    return out, items


def main():
    global NAV
    NAV = json.loads(NAV_FILE.read_text())
    force = '--refresh' in sys.argv
    posts = fetch_blog(force)
    interviews = [p for p in posts if p['cat'] == '크루 인터뷰'] + LEGACY_INTERVIEWS
    layout = (SRC / 'layout.html').read_text()
    version = datetime.datetime.now().strftime('%Y%m%d%H%M')
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ROOT / 'assets', OUT / 'assets')
    (OUT / 'assets' / 'edit').mkdir(exist_ok=True)
    (OUT / '.nojekyll').write_text('')
    # (OUT / 'CNAME').write_text(DOMAIN + '\n')   # 정식 도메인 붙일 때 되살릴 것
    built = []
    for f in sorted(PAGES.glob('*.html')):
        txt = f.read_text()
        m = re.match(r'\s*<!--\s*(\{.*?\})\s*-->', txt, re.S)
        if not m:
            print('메타 없음, 건너뜀:', f.name)
            continue
        meta = json.loads(m.group(1))
        path = meta['path']
        root = '../' * path.count('/')
        key = f.stem
        injected, items = scan_editable(txt, key, root)
        lay_injected, lay_items = scan_editable(layout, 'layout', root)
        nav_items, nav_ids = nav_edit_items(2)
        (OUT / 'assets' / 'edit' / f'{key}.json').write_text(json.dumps({
            'files': [f'src/pages/{f.name}', 'src/layout.html', 'src/nav.json'],
            'items': [it + [0] for it in items] + [it + [1] for it in lay_items] + nav_items}, ensure_ascii=False))
        body = injected[m.end():]
        body = body.replace('{{root}}', root)
        body = re.sub(r'\{\{posts:([^:}]+):(\d+)\}\}', lambda mm: post_cards(posts, mm.group(1), int(mm.group(2))), body)
        body = body.replace('{{interviews}}', post_cards(interviews, 'all', 12))
        og = meta.get('og', 'assets/img/hero.jpg')
        page = (lay_injected
                .replace('{{title}}', esc(meta['title']))
                .replace('{{desc}}', esc(meta.get('desc', '')))
                .replace('{{og}}', SITE + og)
                .replace('{{canonical}}', SITE + path)
                .replace('{{bodyclass}}', meta.get('bodyclass', 'sub'))
                .replace('{{nav}}', render_nav(root, meta.get('section'), nav_ids))
                .replace('{{content}}', body)
                .replace('{{v}}', version)
                .replace('{{home}}', root or './')
                .replace('{{ats}}', ATS)
                .replace('{{editkey}}', key)
                .replace('{{root}}', root))
        out = OUT / path / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page)
        built.append(str(out.relative_to(ROOT)))
    print(f'빌드 완료 {len(built)}개 · v{version}')
    for b in built:
        print(' -', b)


if __name__ == '__main__':
    main()

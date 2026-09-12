#!/usr/bin/env python3
"""에고이즘 채용 사이트 빌드.

src/pages/*.html (앞머리 JSON 주석 = 페이지 메타) + src/layout.html → 각 경로의 index.html
  python3 build.py            # 블로그 RSS는 캐시(src/data/blog.json) 우선
  python3 build.py --refresh  # RSS를 새로 받아 캐시 갱신 후 빌드
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

ROOT = pathlib.Path(__file__).resolve().parent
SRC, PAGES, DATA = ROOT / 'src', ROOT / 'src' / 'pages', ROOT / 'src' / 'data'
SITE = 'https://egoidsm-gun.github.io/careers/'  # 정식 도메인 연결 시 https://egoidsm.com/ 으로
BLOG_RSS = 'https://egoidsmblog.com/rss'

NAV = [
    {'key': 'only', 'label': 'ONLY AT egoidsm', 'href': 'about/',
     'subs': [('about/', '회사소개'), ('benefit/', '베네핏'), ('growth/', '성장')]},
    {'key': 'brand', 'label': 'BRAND', 'href': 'brand/',
     'subs': [('brand/gulgang/', '굴뚝강아지'), ('brand/mnms/', '미뇽맨션'), ('brand/vasol/', '바쏠'),
              ('brand/huug/', '휴그'), ('brand/feura/', '퓌라'), ('brand/faverse/', '페이버스')]},
    {'key': 'contents', 'label': 'CONTENTS', 'href': 'contents/',
     'subs': [('contents/', '콘텐츠'), ('https://egoidsmblog.com/', 'BLOG ↗')]},
    {'key': 'recruiting', 'label': 'RECRUITING', 'href': 'recruiting/', 'subs': []},
]

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


def render_nav(root, section):
    """가운데 알약 탭 — RECRUITING은 오른쪽 사각 버튼이므로 알약에서 뺀다."""
    items = []
    for n in NAV:
        if n['key'] == 'recruiting':
            continue
        cls = ('on ' if n['key'] == section else '') + ('has-dd' if n['subs'] else '')
        dd = ''
        if n['subs']:
            dd = '<div class="dd">' + ''.join(
                f'<a href="{href(root, h)}"{" target=\"_blank\" rel=\"noopener\"" if h.startswith("http") else ""}>{esc(l)}</a>'
                for h, l in n['subs']) + '</div>'
        items.append(f'<li class="{cls.strip()}"><a href="{href(root, n["href"])}">{esc(n["label"])}</a>{dd}</li>')
    return ''.join(items)


def render_subtabs(root, meta):
    tabs = meta.get('subtabs')
    if tabs is None:
        n = next((x for x in NAV if x['key'] == meta.get('section')), None)
        tabs = [list(t) for t in n['subs']] if n and n['subs'] else []
    if not tabs:
        return ''
    sub = meta.get('sub', '')
    out = []
    for h, l in tabs:
        on = ' class="on"' if h == sub else ''
        tgt = ' target="_blank" rel="noopener"' if h.startswith('http') else ''
        out.append(f'<a href="{href(root, h)}"{on}{tgt}>{esc(l)}</a>')
    return '<nav class="subtabs" aria-label="하위 메뉴"><div class="wrap">' + ''.join(out) + '</div></nav>'


def main():
    force = '--refresh' in sys.argv
    posts = fetch_blog(force)
    interviews = [p for p in posts if p['cat'] == '크루 인터뷰'] + LEGACY_INTERVIEWS
    layout = (SRC / 'layout.html').read_text()
    version = datetime.datetime.now().strftime('%Y%m%d%H%M')
    built = []
    for f in sorted(PAGES.glob('*.html')):
        txt = f.read_text()
        m = re.match(r'\s*<!--\s*(\{.*?\})\s*-->', txt, re.S)
        if not m:
            print('메타 없음, 건너뜀:', f.name)
            continue
        meta = json.loads(m.group(1))
        body = txt[m.end():]
        path = meta['path']
        root = '../' * path.count('/')
        body = body.replace('{{root}}', root)
        body = re.sub(r'\{\{posts:([^:}]+):(\d+)\}\}', lambda mm: post_cards(posts, mm.group(1), int(mm.group(2))), body)
        body = body.replace('{{interviews}}', post_cards(interviews, 'all', 12))
        og = meta.get('og', 'assets/img/hero.jpg')
        page = (layout
                .replace('{{title}}', esc(meta['title']))
                .replace('{{desc}}', esc(meta.get('desc', '')))
                .replace('{{og}}', SITE + og)
                .replace('{{canonical}}', SITE + path)
                .replace('{{bodyclass}}', meta.get('bodyclass', 'sub'))
                .replace('{{nav}}', render_nav(root, meta.get('section')))
                .replace('{{subtabs}}', render_subtabs(root, meta))
                .replace('{{content}}', body)
                .replace('{{v}}', version)
                .replace('{{home}}', root or './')
                .replace('{{root}}', root))
        out = (ROOT / path / 'index.html') if path else ROOT / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(page)
        built.append(str(out.relative_to(ROOT)))
    print(f'빌드 완료 {len(built)}개 · v{version}')
    for b in built:
        print(' -', b)


if __name__ == '__main__':
    main()

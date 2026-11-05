#!/usr/bin/env python3
"""Validate the author/book discovery pages without third-party dependencies."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://shaniakhan.com'
NEW = ['/books/', '/books/rich-grandma-energy/', '/books/the-goodbye-theory/', '/about/']
CHANGED = NEW + ['/', '/shop/', '/mediakit/', '/blog/rich-grandma-energy/', '/blog/goodbye-theory-explained/']

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags = []; self.scripts = []; self.capture = False; self.buffer = []
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs); self.tags.append((tag, attrs))
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.capture = True; self.buffer = []
    def handle_data(self, data):
        if self.capture: self.buffer.append(data)
    def handle_endtag(self, tag):
        if tag == 'script' and self.capture:
            self.scripts.append(json.loads(''.join(self.buffer))); self.capture = False

def target(url):
    path = unquote(urlsplit(url).path)
    file = ROOT / path.lstrip('/')
    return file / 'index.html' if path.endswith('/') or not path else file

def nodes(data):
    if isinstance(data, dict):
        yield data
        for value in data.values(): yield from nodes(value)
    elif isinstance(data, list):
        for value in data: yield from nodes(value)

errors = []; parsed = {}
def check(condition, message):
    if not condition: errors.append(message)

for path in CHANGED:
    text = target(path).read_text(); p = Page(text); parsed[path] = p
    check(sum(t == 'h1' for t, a in p.tags) == 1, path + ': one H1 required')
    canonical = [a.get('href') for t, a in p.tags if t == 'link' and a.get('rel') == 'canonical']
    check(canonical == [BASE + path], path + ': canonical mismatch')
    check(sum(t == 'title' for t, a in p.tags) == 1, path + ': one title required')
    check(sum(t == 'meta' and a.get('name') == 'description' for t, a in p.tags) == 1, path + ': description required')
    check(bool(p.scripts), path + ': structured data required')
    for tag, attrs in p.tags:
        if tag in ('a', 'link', 'img'):
            url = attrs.get('href', attrs.get('src', ''))
            if url.startswith('/') and not url.startswith('//'):
                check(target(url).is_file(), path + ': broken local path ' + url)
                fragment = urlsplit(url).fragment
                if fragment and target(url).is_file():
                    other = Page(target(url).read_text())
                    check(any(a.get('id') == fragment for t, a in other.tags), path + ': broken anchor ' + url)
        if tag == 'img' and path in NEW: check('alt' in attrs, path + ': image needs alt')
    if path in NEW:
        check(any(t == 'main' and a.get('id') == 'main' for t,a in p.tags), path + ': skip link target required')
        check('bestsell' not in text.lower(), path + ': unverified bestseller claim')
        check('aggregateRating' not in text and '"isbn"' not in text, path + ': unverified rating or edition ID')
        for script in p.scripts:
            for node in nodes(script):
                if node.get('@type') == 'Offer':
                    check(node.get('price') == '9.99' and node.get('priceCurrency') == 'USD', path + ': digital offer mismatch')
                    check(node.get('url') in ('https://payhip.com/b/nutLQ', 'https://payhip.com/b/shZLD'), path + ': unknown offer URL')

sitemap = ET.parse(ROOT / 'sitemap.xml').getroot()
ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
locations = [x.text for x in sitemap.findall('s:url/s:loc',ns)]
check(len(locations) == len(set(locations)), 'Duplicate sitemap URL')
for node in sitemap.iter():
    if node.tag.endswith('urlset') or node.tag.endswith('url'):
        check(not (node.text or '').strip(), 'Unexpected sitemap text')
    check(not (node.tail or '').strip(), 'Unexpected sitemap tail text')
for path in NEW:
    check(BASE + path in locations, path + ': absent from sitemap')
    check(BASE + path in (ROOT / 'llms.txt').read_text(), path + ': absent from llms.txt')
for url in locations:
    check(target(url).is_file(), 'Sitemap target missing: ' + url)

for path,fmt in [('/books/rich-grandma-energy/','application/pdf'),('/books/the-goodbye-theory/','application/epub+zip')]:
    allnodes = [node for script in parsed[path].scripts for node in nodes(script)]
    check(any(n.get('encodingFormat') == fmt and n.get('bookFormat') == 'https://schema.org/EBook' for n in allnodes), path + ': edition format mismatch')
    check(any(n.get('@id') == BASE + '/#person' and n.get('name') == 'Shania Khan' for n in allnodes), path + ': author identity missing')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(CHANGED)} pages, metadata, JSON-LD, local links/anchors, book formats/offers, {len(locations)} sitemap URLs, and discovery links.')

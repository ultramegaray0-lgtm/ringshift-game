#!/usr/bin/env python3
"""Build the itch.io HTML5 upload: a ZIP with index.html at its root.

  python3 tools/build_itch.py            # -> dist/ringshift-<version>-itch-html5.zip

The game is the file named by GAME_FILE in .github/workflows/pages.yml (the same
build GitHub Pages publishes), copied in as index.html, plus the .html pages listed in
EXTRA_PAGES there (privacy.html, terms.html; other files there are site-only), which the game links to. Nothing in
the repository is changed. The ZIP is deterministic (fixed timestamps, sorted
names), so the same commit always gives the same file.

itch.io's rules (https://itch.io/docs/creators/html5): index.html at the root,
relative paths only, case-sensitive names, at most 1,000 files and 500 MB.
"""
import hashlib, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WF = open(os.path.join(ROOT, '.github', 'workflows', 'pages.yml'), encoding='utf-8').read()
GAME = re.search(r'^\s*GAME_FILE:\s*(.+?)\s*$', WF, re.M).group(1).strip('"\'')
EXTRA = re.search(r'^\s*EXTRA_PAGES:\s*(.+?)\s*$', WF, re.M).group(1).split()
# Only the pages players can open go into the upload. EXTRA_PAGES also carries site-only files
# (e.g. the TikTok domain-verification .txt), which have no business inside the game ZIP.
SKIPPED = [p for p in EXTRA if not p.lower().endswith('.html')]
EXTRA = [p for p in EXTRA if p.lower().endswith('.html')]
VERSION = re.search(r'v\d+\.\d+', GAME).group(0)
OUT_DIR = os.path.join(ROOT, 'dist')
OUT = os.path.join(OUT_DIR, f'ringshift-{VERSION}-itch-html5.zip')

files = [('index.html', GAME)] + [(p, p) for p in EXTRA]
for arc, src in files:
    path = os.path.join(ROOT, src)
    if not os.path.isfile(path):
        sys.exit(f'missing: {src}')
    html = open(path, encoding='utf-8').read()
    # itch.io serves the game from a subdirectory: absolute local paths would break
    bad = re.findall(r'''(?:src|href)\s*=\s*["']/(?!/)[^"']*''', html)
    if bad:
        sys.exit(f'{src}: absolute local path(s) {bad[:3]}')

os.makedirs(OUT_DIR, exist_ok=True)
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for arc, src in sorted(files):
        info = zipfile.ZipInfo(arc, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, open(os.path.join(ROOT, src), 'rb').read())

with zipfile.ZipFile(OUT) as z:
    names = z.namelist()
    assert 'index.html' in names and len(names) <= 1000
    total = sum(i.file_size for i in z.infolist())
sha = hashlib.sha256(open(OUT, 'rb').read()).hexdigest()
if SKIPPED:
    print('left out (not game pages): ' + ', '.join(SKIPPED))
print(f'{os.path.relpath(OUT, ROOT)}: {len(names)} files ({", ".join(sorted(names))}), '
      f'{total/1024:.0f} KB unpacked, {os.path.getsize(OUT)/1024:.0f} KB zipped, sha256 {sha[:16]}')

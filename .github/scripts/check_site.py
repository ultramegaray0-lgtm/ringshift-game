#!/usr/bin/env python3
"""Check the generated Pages site before it is deployed.

Usage: python3 .github/scripts/check_site.py _site

Fails (exit 1) if:
  * index.html is missing, empty, or not an HTML document;
  * the page references a local file (img/script/link/source/... or a CSS
    url()) that is not present in the site folder;
  * the page references a local file by an absolute path ("/foo.js"), which
    would break under the project-site prefix (/ringshift-game/).

Only real markup and <style> blocks are inspected. URLs that are built at
runtime inside <script> code are not static references and are ignored.
"""
import os
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

URL_ATTRS = {"src", "href", "poster", "data", "action", "formaction", "manifest"}
CSS_URL = re.compile(r"""url\(\s*(['"]?)(.*?)\1\s*\)""", re.I)
SKIP_SCHEMES = ("http:", "https:", "data:", "blob:", "mailto:", "tel:", "javascript:", "about:")


class Refs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        self.in_style = tag == "style"
        for name, value in attrs:
            if not value:
                continue
            if name in URL_ATTRS:
                self.refs.append((f"<{tag} {name}>", value))
            elif name in ("srcset", "imagesrcset"):
                for part in value.split(","):
                    if part.strip():
                        self.refs.append((f"<{tag} {name}>", part.split()[0]))
            elif name == "style":
                for m in CSS_URL.finditer(value):
                    self.refs.append((f"<{tag} style>", m.group(2)))

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False

    def handle_data(self, data):
        if self.in_style:
            for m in CSS_URL.finditer(data):
                self.refs.append(("<style> url()", m.group(2)))


def main(site):
    index = os.path.join(site, "index.html")
    if not os.path.isfile(index) or os.path.getsize(index) == 0:
        print(f"::error::{index} is missing or empty")
        return 1
    with open(index, encoding="utf-8") as fh:
        html = fh.read()
    if not re.search(r"<html[\s>]", html, re.I):
        print(f"::error::{index} does not look like an HTML document")
        return 1

    parser = Refs()
    parser.feed(html)
    problems, local = [], 0
    for where, url in parser.refs:
        url = url.strip()
        low = url.lower()
        if not url or url.startswith("#") or low.startswith(SKIP_SCHEMES) or url.startswith("//"):
            continue
        local += 1
        path = unquote(urlsplit(url).path)
        if path.startswith("/"):
            problems.append(f"{where} uses an absolute path '{url}' (breaks under /ringshift-game/)")
            continue
        target = os.path.normpath(os.path.join(site, path))
        if not target.startswith(os.path.abspath(site)) and not target.startswith(os.path.normpath(site)):
            problems.append(f"{where} points outside the site: '{url}'")
        elif not os.path.exists(target):
            problems.append(f"{where} references missing file '{url}'")

    size_kb = os.path.getsize(index) / 1024
    print(f"index.html: {size_kb:.0f} KB, {len(parser.refs)} URL references, {local} local")
    for p in problems:
        print(f"::error::{p}")
    if problems:
        return 1
    print("Site check passed: no missing assets or broken relative paths.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "_site"))

#!/usr/bin/env python3
"""Render the Ringshift itch.io cover.

  python3 build_cover.py [board.json] [out_dir]

board.json is a board traced by the game's own traceAllBeams() (see
trace_board.py). The template ringshift-cover.html draws it; this script
renders at 2x in headless Chromium, downsamples to 1920x1080, and runs the
beam/rim check: no beam pixel may appear outside the rim.
"""
import asyncio, json, sys, os, math
from playwright.async_api import async_playwright
from PIL import Image
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
BOARD = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'board.json')
OUT = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else HERE
OPT = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

async def render():
    tpl = open(os.path.join(HERE, 'ringshift-cover.html'), encoding='utf-8').read()
    html = tpl.replace('/*BOARD_JSON*/null', open(BOARD).read()).replace('/*OPT_JSON*/{}', json.dumps(OPT))
    page_path = os.path.join(OUT, '_render.html')
    open(page_path, 'w', encoding='utf-8').write(html)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=2)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + page_path)
        await pg.wait_for_function('window.READY===true')
        await pg.evaluate('document.fonts.ready')
        await pg.wait_for_timeout(300)
        info = await pg.evaluate('({maxBeamR:window.MAX_BEAM_R, title:window.TITLE_BOX, gBeam:window.G_BEAM, dbg:window.TITLE_DEBUG, err:window.ERR||null})')
        if info.get('err'): errs.append(info['err'])
        await pg.screenshot(path=os.path.join(OUT, '_2x.png'), full_page=False)
        # beam-only pass: hide everything except beam strokes, on black
        await pg.evaluate("""()=>{
          document.body.style.background='#000';
          const svg=document.getElementById('cover');
          svg.querySelectorAll('*').forEach(e=>{ if(['defs','linearGradient','radialGradient','stop','filter','clipPath'].includes(e.tagName)||e.closest('defs')) return;
            if(e.tagName==='g'||e.tagName==='svg') return;
            if(!e.classList.contains('beam')) e.style.display='none'; });
          svg.querySelectorAll('.beam').forEach(e=>{ e.removeAttribute('filter'); e.setAttribute('stroke','#ffffff'); e.setAttribute('fill', e.tagName==='circle'?'#ffffff':'none'); e.setAttribute('opacity','1'); });
          document.getElementById('title').style.display='none';
        }""")
        await pg.screenshot(path=os.path.join(OUT, '_beams.png'))
        await b.close()
    os.remove(page_path)
    return info, errs

def main():
    info, errs = asyncio.run(render())
    big = Image.open(os.path.join(OUT, '_2x.png')).convert('RGB')
    cover = big.resize((1920, 1080), Image.LANCZOS)
    out_png = os.path.join(OUT, 'ringshift-itch-cover-1920x1080.png')
    cover.save(out_png, optimize=True)
    # itch.io cover slot is 630x500; centre crop of the 16:9 art at that ratio
    cw = round(1080 * 630 / 500)
    x0 = (1920 - cw) // 2
    crop = big.crop((x0 * 2, 0, (x0 + cw) * 2, 2160)).resize((1260, 1000), Image.LANCZOS)
    crop.save(os.path.join(OUT, 'ringshift-itch-cover-630x500@2x.png'), optimize=True)

    # ---- beam / rim check ----
    beams = np.asarray(Image.open(os.path.join(OUT, '_beams.png')).convert('L')).astype(np.int32)
    Hh, Ww = beams.shape
    s = Ww / 1920
    bx, by, bs = 960 * s, OPT.get('boardY', 428) * s, OPT.get('boardScale', 1.5) * s
    yy, xx = np.mgrid[0:Hh, 0:Ww]
    rr = np.hypot(xx - bx, yy - by) / bs          # in game units
    lit = beams > 40
    outside_band = lit & (rr > 250)               # past the rim glass's outer edge
    past_mid = lit & (rr > 232 + 2.8 / 2 + 1.0)   # past RIM_R (+ half the core stroke + AA)
    print(json.dumps({
        'engine_max_beam_radius': info['maxBeamR'],
        'RIM_R': 232,
        'beam_pixels_total': int(lit.sum()),
        'beam_pixels_outside_rim_band(r>250)': int(outside_band.sum()),
        'beam_pixels_past_RIM_R': int(past_mid.sum()),
        'max_beam_pixel_radius_units': round(float(rr[lit].max()), 2) if lit.any() else None,
        'title_box': info['title'], 'title_dbg': info.get('dbg'), 'g_beam': info['gBeam'], 'page_errors': errs,
    }, indent=1))
    os.remove(os.path.join(OUT, '_2x.png'))

if __name__ == '__main__':
    main()

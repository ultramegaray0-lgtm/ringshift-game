#!/usr/bin/env python3
"""Trace the cover's showcase board with the GAME'S OWN engine and write board.json.

  python3 trace_board.py "../../ringshift v0.34.html" board.json

Loads the game in headless Chromium and calls its traceAllBeams() on the board
below (12 slots, 3 rings, all rotations 0). Nothing in the game file is changed.
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

GAME = sys.argv[1] if len(sys.argv) > 1 else '../../ringshift v0.34.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'board.json'

RINGS = [
    {"spokeSlots": [9], "gimmicks": {"4": {"type": "block"}, "5": {"type": "mirror_r", "fixed": True}, "10": {"type": "block"}}},
    {"spokeSlots": [2], "gimmicks": {}},
    {"spokeSlots": [11], "gimmicks": {"3": {"type": "prism"}}},
]
LOCKS = [2, 8, 4, 11]   # 2/8/4 are lit by this position; 11 is left unlit (red)

JS = """(a)=>{ const [rings,lockSlots]=a; const n=12; const rot=rings.map(()=>0);
 const t=traceAllBeams({slots:n,rings,lockSlots},rot);
 return {n,rimR:RIM_R,ringR:rings.map((_,i)=>ringRadius(i)),rings,rot,lockSlots,lit:[...t.litLocks],selected:0,
  beams:t.beamResults.map(b=>({ring:b.ring,liveSlot:b.liveSlot,lit:b.result.hitLockSlots.length>0,
    segs:b.result.segments.map(s=>({x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,strong:!!s.strong,lit:!!(s.litSlots&&s.litSlots.length)})),
    ends:b.result.ends}))}; }"""

async def main():
    import os
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto('file://' + os.path.abspath(GAME)); await pg.wait_for_timeout(800)
        d = await pg.evaluate(JS, [RINGS, LOCKS])
        await b.close()
    json.dump(d, open(OUT, 'w'), indent=1)
    mx = max(max((s['x1']**2 + s['y1']**2)**.5, (s['x2']**2 + s['y2']**2)**.5) for bm in d['beams'] for s in bm['segs'])
    print('lit locks', d['lit'], '| max beam radius %.3f (RIM_R %d)' % (mx, d['rimR']))

asyncio.run(main())

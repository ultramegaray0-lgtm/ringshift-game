#!/usr/bin/env python3
"""Trace the cover's showcase board with the GAME'S OWN engine and write board.json.

  python3 trace_board.py "../../ringshift v0.44.html" board.json

Loads the game in headless Chromium and calls its traceAllBeams() on the board
below (12 slots, 3 rings, all rotations 0). Nothing in the game file is changed.
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

GAME = sys.argv[1] if len(sys.argv) > 1 else '../../ringshift v0.44.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'board.json'

# v0.44 board (mirror rule since v0.36, turned beam leaves from the mirror's centre):
#  ring 1 source @9  -> right along the axis -> pinned Mirror (╲) on ring 0 @3 -> turns DOWN -> Lock 4
#  ring 1 source @6  -> up through the centre -> Prism on ring 2 @0 -> two branches -> Locks 11 and 1
#  ring 2 source @1  -> down-left through the centre -> Block on ring 0 @7 -> stopped; Lock 7 stays red
RINGS = [
    {"spokeSlots": [], "gimmicks": {"3": {"type": "mirror_l", "fixed": True}, "7": {"type": "block"}}},
    {"spokeSlots": [9, 6], "gimmicks": {}},
    {"spokeSlots": [1], "gimmicks": {"0": {"type": "prism"}}},
]
LOCKS = [11, 1, 4, 7]   # 11/1/4 are lit by this position; 7 sits behind the Block (unlit, red)
SELECTED = 2            # the ring whose unlit beam is drawn white (the blocked one)

JS = """(a)=>{ const [rings,lockSlots]=a; const n=12; const rot=rings.map(()=>0);
 const t=traceAllBeams({slots:n,rings,lockSlots},rot);
 return {n,rimR:RIM_R,ringR:rings.map((_,i)=>ringRadius(i)),rings,rot,lockSlots,lit:[...t.litLocks],selected:a[2],
  beams:t.beamResults.map(b=>({ring:b.ring,liveSlot:b.liveSlot,lit:b.result.hitLockSlots.length>0,
    segs:b.result.segments.map(s=>({x1:s.x1,y1:s.y1,x2:s.x2,y2:s.y2,strong:!!s.strong,lit:!!(s.litSlots&&s.litSlots.length)})),
    ends:b.result.ends}))}; }"""

async def main():
    import os
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto('file://' + os.path.abspath(GAME)); await pg.wait_for_timeout(800)
        d = await pg.evaluate(JS, [RINGS, LOCKS, SELECTED])
        await b.close()
    json.dump(d, open(OUT, 'w'), indent=1)
    mx = max(max((s['x1']**2 + s['y1']**2)**.5, (s['x2']**2 + s['y2']**2)**.5) for bm in d['beams'] for s in bm['segs'])
    print('lit locks', d['lit'], '| max beam radius %.3f (RIM_R %d)' % (mx, d['rimR']))

asyncio.run(main())

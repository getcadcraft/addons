/* SPDX-License-Identifier: Apache-2.0 */
// Run with `npm test` (tools/addon-test.mjs). Inputs answer the command's questions in order; null = Enter.
import { area, perimeter, worldPoints, csv } from '../lib/outline.js';

export default async function (t) {
  t.ok(t.registered.commands.join() === 'OUTLINE,OUTLINEFROM', 'two commands');
  t.ok(t.registered.objects.join() === 'outline' && t.registered.exporters.join() === 'outlines-csv', 'one object kind, one exporter');

  // the geometry, by hand: a 40 × 20 rectangle and a 3-4-5 triangle
  const rect = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }];
  t.ok(area(rect) === 800 && perimeter(rect) === 120, 'rectangle: area 800, perimeter 120');
  t.ok(area([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }]) === 6 && perimeter([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }]) === 12, 'triangle 3-4-5: area 6, perimeter 12');
  const w = worldPoints({ x: 100, y: 50, rot: Math.PI / 2, sx: 2, sy: 1 }, rect);
  t.ok(Math.abs(w[1].x - 100) < 1e-9 && Math.abs(w[1].y - 130) < 1e-9 && Math.abs(area(w) - 1600) < 1e-9, 'placed: turned a quarter, twice as long → area 1600');
  t.ok(csv([['=SUM(A1)', 'a,b', 'say "hi"']]) === "'=SUM(A1),\"a,b\",\"say \"\"hi\"\"\"\r\n", 'CSV: formulas defused, commas and quotes escaped');

  // drawing one: four corners, Enter, a tag
  const [o] = await t.command('OUTLINE', [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 30 }, { x: 10, y: 30 }, null, 'Panel A']);
  t.ok(o && o.type === 'insert' && o.x === 10 && o.y === 10, 'OUTLINE adds one object at its first corner');
  const d = t.api.objects.dataOf(o);
  t.ok(d.tag === 'Panel A' && d.pts.length === 4 && d.pts[0].x === 0 && d.pts[2].x === 40 && d.pts[2].y === 20, 'its data: the tag and its corners in its own frame');
  const drawn = t.draw(o);
  t.ok(drawn.some((e) => e.type === 'poly' && e.closed && e.pts.length === 4) && drawn.some((e) => e.type === 'text' && e.s === 'Panel A'), 'it draws a closed outline and its tag');
  const moved = t.gripMove(o, 'v2', { x: 60, y: 20 });
  t.ok(moved.pts[2].x === 60 && moved.pts[1].x === 40, 'a corner grip moves that corner only');

  // Properties
  const f = t.props(o);
  t.ok(f.map((x) => x.key).join() === 'tag,area,perimeter', 'Properties: tag (editable), area and perimeter');
  t.ok(f[1].get(o) === '800.00' && f[2].get(o) === '120.00', 'area and perimeter of the placed outline');
  const renamed = f[0].set(o, '  Panel B ');
  t.ok(t.api.objects.dataOf(renamed).tag === 'Panel B', 'the tag can be changed (trimmed)');

  // a closed polyline turned into an outline: one step, the polyline gone
  let poly;
  t.doc.change('setup', () => { poly = t.doc.add({ type: 'poly', closed: true, layer: 'CUT', pts: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }] }); });
  const steps = t.doc.steps.length;
  const [o2] = await t.command('OUTLINEFROM', [{ id: poly.id }, 'Tri']);
  t.ok(o2 && !t.doc.get(poly.id) && o2.layer === 'CUT' && t.doc.steps.length === steps + 1, 'OUTLINEFROM replaces the polyline in one step, on its layer');
  let open;
  t.doc.change('setup', () => { open = t.doc.add({ type: 'poly', closed: false, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }); });
  t.ok((await t.command('OUTLINEFROM', [{ id: open.id }, 'x'])).length === 0 && t.doc.get(open.id), 'an open polyline is refused and left alone');

  // the exporter
  const ex = t.exporter('outlines-csv');
  const text = ex.write(t.doc);
  const rows = text.trim().split('\r\n');
  t.ok(ex.extension === 'csv' && rows[0] === 'Tag,Area,Perimeter,Corners,Layer', 'CSV header');
  t.ok(rows.includes('Panel A,800.0000,120.0000,4,0') && rows.includes('Tri,6.0000,12.0000,3,CUT'), 'one row per outline, measured where it is placed', text);
}

/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Outline — an example CadCraft add-on (API 1.0) for 2D work: a closed outline that carries a tag, the kind of object a
 * cutting, sign-making or space-planning add-on starts from. Smaller than a product on purpose; copy what you need.
 *
 * What it shows, beyond the template:
 *   - an object kind ("outline") whose shape is its data, with a grip on every corner;
 *   - one property (the tag) in the Properties panel, plus read-only area and perimeter;
 *   - a command that collects points until Enter (OUTLINE), and one that turns an existing closed polyline into an outline;
 *   - an exporter (CSV of every outline: tag, area, perimeter, corners) listed by CadCraft's EXPORT command;
 *   - nothing to do for DWG and DXF: the object saves as a block reference with its data under the add-on's own
 *     application name, and comes back as an outline when the drawing is opened with the add-on.
 */
import { toLocal, worldPoints, area, perimeter, middle, csv } from './lib/outline.js';

const TAG_H = 2.5;   // tag text height, drawing units

export function activate(api) {
  const isOutline = (e) => api.objects.is(e, 'outline');

  api.objects.define('outline', {
    version: 1,
    name: api.t('outline.name'),
    // data: { tag: string, pts: [{x, y}] } in the outline's own frame (the first corner at 0, 0)
    draw(d) {
      const m = middle(d.pts);
      const out = [{ type: 'poly', pts: d.pts.map((p) => ({ x: p.x, y: p.y, b: 0 })), closed: true }];
      if (d.tag) out.push({ type: 'text', x: m.x, y: m.y, h: TAG_H, rot: 0, s: d.tag, ha: 'center', va: 'middle' });
      return out;
    },
    grips: (d) => d.pts.map((p, i) => ({ x: p.x, y: p.y, key: 'v' + i })),
    gripMove(d, key, to) {
      const i = Number(String(key).slice(1));
      if (Number.isInteger(i) && d.pts[i]) d.pts[i] = { x: to.x, y: to.y };
      return d;
    },
  });

  const add = (c, points, tag) => {
    const { origin, pts } = toLocal(points);
    const e = api.objects.create('outline', { tag, pts }, {});
    c.doc.change('OUTLINE', () => c.doc.add({ ...e, x: origin.x, y: origin.y }));
    c.print(api.t('outline.placed', { tag: tag || api.t('outline.untagged'), area: area(pts).toFixed(2) }));
  };

  api.commands.add('OUTLINE', [], async (c) => {
    const first = await c.point(api.t('outline.cmd.first'));
    if (!first) return;
    const pts = [first];
    for (;;) {
      const p = await c.point(pts.length < 3 ? api.t('outline.cmd.next') : api.t('outline.cmd.next_or_enter'), { base: pts[pts.length - 1], none: pts.length >= 3 });
      if (!p) break;
      pts.push(p);
    }
    const tag = String(await c.string(api.t('outline.cmd.tag')) ?? '').trim();
    add(c, pts, tag);
  }, { help: () => api.t('outline.cmd.help') });

  api.commands.add('OUTLINEFROM', [], async (c) => {
    const pick = await c.entity(api.t('outline.from.pick'));
    const e = pick && c.doc.get(pick.id);
    if (!e || e.type !== 'poly' || !e.closed || e.pts.length < 3 || e.pts.some((p) => p.b)) { c.print(api.t('outline.from.not_closed')); return; }
    const tag = String(await c.string(api.t('outline.cmd.tag')) ?? '').trim();
    const { origin, pts } = toLocal(e.pts);
    const o = api.objects.create('outline', { tag, pts }, { layer: e.layer, color: e.color });
    c.doc.change('OUTLINEFROM', () => { c.doc.remove(e.id); c.doc.add({ ...o, x: origin.x, y: origin.y }); });
    c.print(api.t('outline.placed', { tag: tag || api.t('outline.untagged'), area: area(pts).toFixed(2) }));
  }, { help: () => api.t('outline.from.help') });

  api.toolbar.group({ id: 'outline', label: api.t('outline.group'), tools: [
    { id: 'outline', label: api.t('outline.name'), icon: 'bi-bounding-box', title: api.t('outline.cmd.help'), command: 'OUTLINE' },
    { id: 'from', label: api.t('outline.from.label'), icon: 'bi-bounding-box-circles', title: api.t('outline.from.help'), command: 'OUTLINEFROM' },
  ] });

  api.props.section({
    key: api.addon.id,
    label: api.t('outline.section'),
    types: ['insert'],
    defs: (ents) => (ents.length && ents.every(isOutline) ? [
      { key: 'tag', kind: 'text', label: api.t('outline.field.tag'), get: (e) => api.objects.dataOf(e).tag, set: (e, v) => api.objects.update(e, { ...api.objects.dataOf(e), tag: String(v).trim() }) },
      ...(ents.length === 1 ? [
        { key: 'area', kind: 'ro', label: api.t('outline.field.area'), get: (e) => area(worldPoints(e, api.objects.dataOf(e).pts)).toFixed(2) },
        { key: 'perimeter', kind: 'ro', label: api.t('outline.field.perimeter'), get: (e) => perimeter(worldPoints(e, api.objects.dataOf(e).pts)).toFixed(2) },
      ] : []),
    ] : []),
  });

  api.files.exporter({
    id: 'outlines-csv',
    label: api.t('outline.export.label'),
    extension: 'csv',
    mime: 'text/csv',
    write(doc) {
      const rows = [[api.t('outline.export.tag'), api.t('outline.export.area'), api.t('outline.export.perimeter'), api.t('outline.export.corners'), api.t('outline.export.layer')]];
      for (const e of doc.all ? doc.all() : []) {
        if (!isOutline(e)) continue;
        const w = worldPoints(e, api.objects.dataOf(e).pts);
        rows.push([api.objects.dataOf(e).tag, area(w).toFixed(4), perimeter(w).toFixed(4), w.length, e.layer ?? '0']);
      }
      return csv(rows);
    },
  });
}

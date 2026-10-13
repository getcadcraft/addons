/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Notes — a template CadCraft add-on (API 1.0). Copy this folder, change addon.json's id, name and author, and build on it.
 *
 * What it shows:
 *   - an object kind of its own ("note": a numbered bubble with a line of text), drawn from its data, with a grip;
 *   - a command (NOTE) that asks for a point and a text, and adds a note as one undo step;
 *   - a toolbar group with one button, and a Properties section that edits the number and the text;
 *   - every string from lang/en.json through api.t().
 * Everything registered through `api` is removed again when someone switches the add-on off.
 */

const R = 2.5;   // bubble radius, drawing units

export function activate(api) {
  api.objects.define('note', {
    version: 1,
    name: api.t('note.name'),
    // data: { n: number, text: string, tx: x of the text, ty: y } in the note's own frame; the bubble is at (0, 0)
    draw(d) {
      return [
        { type: 'circle', cx: 0, cy: 0, r: R },
        { type: 'text', x: -R * 0.35, y: -R * 0.4, h: R, rot: 0, s: String(d.n) },
        { type: 'line', x1: R, y1: 0, x2: d.tx - 0.5, y2: d.ty + R * 0.3 },
        { type: 'text', x: d.tx, y: d.ty, h: R * 0.8, rot: 0, s: d.text },
      ];
    },
    grips: (d) => [{ x: d.tx, y: d.ty, key: 'text' }],
    gripMove(d, key, to) { if (key === 'text') { d.tx = to.x; d.ty = to.y; } return d; },
  });

  const nextNumber = (doc) => 1 + Math.max(0, ...doc.all().filter((e) => api.objects.is(e, 'note')).map((e) => api.objects.dataOf(e).n));

  api.commands.add('NOTE', ['NT'], async (c) => {
    const p = await c.point(api.t('note.cmd.where'));
    const text = String(await c.string(api.t('note.cmd.text'))).trim();
    const n = nextNumber(c.doc);
    const e = api.objects.create('note', { n, text, tx: R * 3, ty: R }, {});
    c.doc.change('NOTE', () => c.doc.add({ ...e, x: p.x, y: p.y }));
    c.print(api.t('note.placed', { n }));
  }, { help: () => api.t('note.cmd.help') });

  api.toolbar.group({ id: 'notes', label: api.t('note.group'), tools: [{ id: 'note', label: api.t('note.name'), icon: 'bi-chat-square-text', title: api.t('note.cmd.help'), command: 'NOTE' }] });

  api.props.section({
    key: api.addon.id,
    label: api.t('note.section'),
    types: ['insert'],
    defs: (ents) => (ents.every((e) => api.objects.is(e, 'note')) ? [
      { key: 'n', kind: 'int', label: api.t('note.field.n'), min: 1, get: (e) => api.objects.dataOf(e).n, set: (e, v) => api.objects.update(e, { ...api.objects.dataOf(e), n: v }) },
      { key: 'text', kind: 'text', label: api.t('note.field.text'), get: (e) => api.objects.dataOf(e).text, set: (e, v) => api.objects.update(e, { ...api.objects.dataOf(e), text: v }) },
    ] : []),
  });
}

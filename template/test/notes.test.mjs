/* SPDX-License-Identifier: Apache-2.0 */
// Run with `npm test`. Each test file exports a default async function given the harness `t` (tools/addon-test.mjs).
export default async function (t) {
  t.ok(t.registered.commands.includes('NOTE'), 'NOTE is a command');
  t.ok(t.registered.objects.includes('note'), 'it defines the note object');
  const ents = await t.command('NOTE', [{ x: 10, y: 5 }, 'Check the clearance']);
  t.ok(ents.length === 1, 'NOTE adds one object');
  const d = t.api.objects.dataOf(ents[0]);
  t.ok(d.n === 1 && d.text === 'Check the clearance', 'numbered 1, with its text');
  const second = await t.command('NOTE', [{ x: 30, y: 5 }, 'Second']);
  t.ok(t.api.objects.dataOf(second[0]).n === 2, 'the next one is 2');
  const drawn = t.draw(ents[0]);
  t.ok(drawn.some((e) => e.type === 'circle') && drawn.some((e) => e.s === 'Check the clearance'), 'it draws a bubble and its text');
  const moved = t.gripMove(ents[0], 'text', { x: 12, y: 9 });
  t.ok(moved.tx === 12 && moved.ty === 9, 'the text grip moves the text');
  const fields = t.props(ents[0]);
  t.ok(fields.map((f) => f.key).join() === 'n,text', 'the Properties section has number and text');
  t.ok(t.text('note.placed', { n: 3 }) === 'Note 3 placed.', 'strings come from lang/en.json');
}

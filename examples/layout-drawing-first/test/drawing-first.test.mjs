/* SPDX-License-Identifier: Apache-2.0 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as F from '../tools/workspace-format.js';

const text = fs.readFileSync(new URL('../workspace/drawing-first.ccworkspace.json', import.meta.url), 'utf8');
const caps = JSON.parse(fs.readFileSync(new URL('../tools/apps.json', import.meta.url), 'utf8')).bimcraft;

test('Drawing first is a layout with nothing left out', () => {
  const r = F.importLayout(text);
  assert.ok(r.ok, r.error);
  assert.deepEqual(r.dropped, []);
});
test('the ribbon starts folded to its tabs and can be pinned open or torn off', () => {
  const ribbon = F.importLayout(text).layout.blocks.find((b) => b.block === 'ribbon');
  assert.equal(ribbon.collapse, true); assert.equal(ribbon.collapsed, true); assert.equal(ribbon.tearOff, true);
});
test('the palettes sit in the right panel; no title bar, so the app bar stays', () => {
  const blocks = F.importLayout(text).layout.blocks;
  assert.equal(blocks.find((b) => b.block === 'palettes').place, 'right-panel');
  assert.ok(!blocks.some((b) => b.block === 'titlebar'));
});
test('BimCraft fills every block (nothing left out there)', () => {
  const r = F.resolveLayout(F.importLayout(text).layout, caps);
  assert.ok(r.ok); assert.deepEqual(r.notes, []);
});

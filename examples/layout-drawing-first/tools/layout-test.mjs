#!/usr/bin/env node
/* SPDX-License-Identifier: Apache-2.0 */
/**
 * layout-test.mjs — check the layouts in workspace/ the way the apps read them (`npm test`). No dependencies; Node 20 or newer.
 *
 *   node tools/layout-test.mjs [folder]
 *
 * workspace/index.json must be a `cadcraft-workspace-addons` v1 index; every file it lists must be a `cadcraft-workspace` v1 layout
 * that the apps' own validator (tools/workspace-format.js, a byte-identical copy of the apps' app-workspace-format.js) reads with
 * nothing left out; names and descriptions must not name another product (name a layout for a way of working). Each layout is then
 * resolved against what every app with an adapter offers (tools/apps.json) and the notes are printed: a block an app cannot fill is
 * dropped there, never an error. The full check in a running app is the conformance test the review runs (docs/LAYOUTS.md § Review).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as F from './workspace-format.js';

const DIR = path.resolve(process.argv[2] || '.');
const W = path.join(DIR, 'workspace');
const PRODUCTS = /\b(autocad|revit|civil ?3d|fusion|sketchup|bluebeam|planswift|tekla|solidworks|archicad|vectorworks|microstation|rhino|bricscad|navisworks|inventor|catia|onshape|blender|freecad|qcad|librecad|draftsight)\b/i;
let fail = 0;
const ok = (c, m, d = '') => { console.log((c ? '  ok   ' : '  FAIL ') + m + (!c && d ? ' (' + d + ')' : '')); if (!c) fail++; };
const ix = JSON.parse(fs.readFileSync(path.join(W, 'index.json'), 'utf8'));
ok(ix.format === F.INDEX_FORMAT && ix.version === 1 && Array.isArray(ix.addons) && ix.addons.length > 0, 'workspace/index.json is a ' + F.INDEX_FORMAT + ' v1 index with at least one layout');
const apps = JSON.parse(fs.readFileSync(new URL('./apps.json', import.meta.url), 'utf8'));
for (const a of ix.addons || []) {
  console.log('== ' + a.file);
  ok(/^(?!.*(?:\.\.|--))[a-z][a-z0-9.-]{0,62}[a-z0-9]$/.test(a.id || '') && /^[a-z0-9][a-z0-9.-]{0,80}\.ccworkspace\.json$/.test(a.file || ''), 'its id and file name are well formed');
  const text = fs.readFileSync(path.join(W, a.file), 'utf8');
  const r = F.importLayout(text);
  ok(r.ok, 'the apps read it as a layout', r.error);
  if (!r.ok) continue;
  ok(!r.dropped.length, 'nothing in it is left out', r.dropped.join(', '));
  ok(!PRODUCTS.test([a.name, a.description, r.layout.name, r.layout.description].join(' ')), 'its name and description name no other product');
  ok(/^[A-Za-z0-9.+-]{1,40}$/.test(a.license || '') && r.layout.license === a.license, 'one license, the same in the index and the file');
  for (const [app, caps] of Object.entries(apps)) {
    if (app.startsWith('@')) continue;
    const res = F.resolveLayout(r.layout, caps);
    ok(res.ok, app + ': at least one block placed');
    if (res.notes.length) console.log('       ' + app + ' leaves out: ' + res.notes.join('; '));
  }
}
console.log(fail ? fail + ' failed' : 'all good');
process.exit(fail ? 1 : 0);

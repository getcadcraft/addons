#!/usr/bin/env node
/* SPDX-License-Identifier: Apache-2.0 */
/**
 * addon-test.mjs — test a CadCraft add-on without the app (`npm test`). No dependencies; Node 20 or newer.
 *
 *   node tools/addon-test.mjs [folder] [--verbose]
 *
 * 1. Checks the package the way the apps and the directory do: addon.json (id, name, version, apps, api, license, entry,
 *    permissions, lang, help), a LICENSE file, only relative imports that stay inside the folder, lang/en.json, and every
 *    api.t('key') used in the code present in lang/en.json.
 * 2. Activates the add-on against a stand-in for CadCraft's add-on API 1.0 that records what it registers (commands,
 *    toolbar groups and menu items, panel and settings sections, Properties sections, object kinds, importers, exporters,
 *    change hooks) and keeps a small drawing (add, update, remove, change = one step).
 * 3. Runs test/*.test.mjs: each exports `default async function (t)` and gets
 *      t.ok(cond, name) · t.api (what the add-on got) · t.registered {commands, objects, toolbar, menu, props, importers, exporters}
 *      t.command(name, inputs) → the entities it added (inputs answer c.point / string / number / … in order)
 *      t.draw(e) · t.gripMove(e, key, to) → data · t.props(e) → Properties fields · t.text(key, vars) · t.doc
 * 4. Switches it off and checks everything it registered was taken away.
 * The stand-in is not CadCraft: test in the app too (load the folder in developer mode, docs/GUIDE.md § Try it in the app).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const DIR = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const VERBOSE = args.includes('--verbose');
let pass = 0, fail = 0;
const ok = (c, m, extra = '') => { if (c) { pass++; if (VERBOSE) console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? ' — ' + extra : '')); } };
const section = (s) => console.log('\n' + s);

const APPS = ['cadcraft', 'bimcraft', 'modelcraft', 'markupcraft', 'takeoffcraft', 'civilcraft', 'detailcraft', 'partcraft'];
const APP_API = { cadcraft: '1.0' };
const LICENSES = ['Apache-2.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense', 'Zlib', 'CC0-1.0'];
const PERMISSIONS = ['commands', 'toolbar', 'panel', 'settings', 'objects', 'files', 'storage', 'network'];

// ------------------------------------------------------------------------------------------------ 1. the package
section('Package');
const read = (p) => fs.readFileSync(path.join(DIR, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(DIR, p));
let m;
try { m = JSON.parse(read('addon.json')); } catch (e) { console.log('  FAIL addon.json: ' + e.message); process.exit(1); }
const apiParts = (v) => { const x = /^(\d{1,3})(?:\.(\d{1,3}))?(?:\.\d{1,3})?$/.exec(String(v ?? '')); return x ? [+x[1], +(x[2] || 0)] : null; };
ok(typeof m.id === 'string' && /^[a-z][a-z0-9.-]{1,63}$/.test(m.id) && !/\.\.|--|[.-]$/.test(m.id), 'id: lower-case letters, digits, "." and "-"', m.id);
ok(typeof m.name === 'string' && m.name.trim() && m.name.length <= 60 && !/[<>\u0000-\u001f]/.test(m.name), 'name: 1–60 characters');
ok(typeof m.version === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,6}(-[0-9A-Za-z.-]{1,40})?$/.test(m.version), 'version: semver (1.2.3)', m.version);
ok(Array.isArray(m.apps) && m.apps.length && m.apps.every((a) => APPS.includes(a)), 'apps: some of ' + APPS.join(', '), JSON.stringify(m.apps));
const need = apiParts(m.api);
ok(need && (m.apps || []).every((a) => { const have = apiParts(APP_API[a] || '1.0'); return need[0] === have[0] && need[1] <= have[1]; }), 'api: one the apps have (CadCraft 1.0, the others 1.0)', String(m.api));
ok(LICENSES.includes(m.license), 'license: one the directory can sign (' + LICENSES.join(', ') + ')', String(m.license));
ok(typeof m.entry === 'string' && /^(\.\/)?[A-Za-z0-9_][A-Za-z0-9_./-]*\.m?js$/.test(m.entry) && !m.entry.includes('..') && exists(m.entry), 'entry: a .js file in the folder', String(m.entry));
ok(Array.isArray(m.permissions ?? []) && (m.permissions ?? []).every((p) => /^[a-z][a-z0-9-]{0,31}$/.test(p)), 'permissions: lower-case words');
for (const p of m.permissions || []) if (!PERMISSIONS.includes(p)) console.log('  note "' + p + '" is not a permission the directory knows; it is shown as it is');
ok(['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'].some(exists), 'a LICENSE file with the license text');
if (m.lang) ok(exists(path.join(m.lang, 'en.json')), 'lang: ' + m.lang + 'en.json');
if (m.homepage !== undefined) ok(/^https:\/\/[^\s"'<>]+$/.test(m.homepage), 'homepage: https://…');

const files = [];
const walk = (d) => { for (const n of fs.readdirSync(path.join(DIR, d))) { if (n.startsWith('.') || ['node_modules', 'test', 'tools'].includes(n)) continue; const p = d ? d + '/' + n : n; if (fs.statSync(path.join(DIR, p)).isDirectory()) walk(p); else files.push(p); } };
walk('');
const IMPORT_RE = /(?:\bimport\s*\(\s*|\bimport\s+(?:[\w*{}\s,]+\s+from\s+)?|\bexport\s+(?:[\w*{}\s,]+\s+)?from\s+)(['"])([^'"\n]+)\1/g;
const used = new Set();
for (const f of files.filter((x) => /\.m?js$/.test(x))) {
  const src = read(f);
  for (const mm of src.matchAll(IMPORT_RE)) {
    const spec = mm[2];
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), spec));
    ok(/^\.{1,2}\//.test(spec) && !target.startsWith('..') && exists(target), f + ': imports ' + spec + ' (its own file)');
  }
  for (const mm of src.matchAll(/\bapi\.t\(\s*(['"])([^'"]+)\1/g)) used.add(mm[2]);
  if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|new\s+(WebSocket|EventSource)\b/.test(src) && !(m.permissions || []).includes('network')) console.log('  note ' + f + ' talks to the network: add "network" to permissions, or review will ask');
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(src)) console.log('  note ' + f + ' runs code from text (eval / new Function): review will ask why');
}
let strings = {};
if (m.lang) { try { strings = JSON.parse(read(path.join(m.lang, 'en.json'))); } catch (e) { ok(false, 'lang/en.json is JSON', e.message); } }
const missing = [...used].filter((k) => !(k in strings));
ok(!missing.length, 'every api.t() key is in lang/en.json', missing.join(', '));
for (const f of files.filter((x) => x.startsWith('help/') && x.endsWith('.md'))) ok(/^---\n[\s\S]*?\btitle:\s*\S[\s\S]*?\n---\n/.test(read(f)), f + ': front matter with a title');

// ------------------------------------------------------------------------------------------------ 2. a stand-in for the API
const fill = (s, v = {}) => String(s).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (all, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : all));
const tr = (key, vars = {}) => { const s = strings[key]; if (s === undefined) return key; if (typeof s === 'string') return fill(s, vars); const n = vars.n; return fill(n === 1 && s.one ? s.one : s.other ?? key, vars); };
const appid = 'CC_' + m.id.toUpperCase().replace(/\./g, '_');
const encode = (kind, version, data) => {
  const json = JSON.stringify(data).replace(/[\u007f-￿]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
  if (json.length > 12000) throw new Error('add-on data is ' + json.length + ' characters as JSON; the limit is 12000');
  const items = [[1000, 'CCOBJ'], [1000, kind], [1070, version], [1070, json.length]];
  for (let i = 0; i < json.length; i += 250) items.push([1000, json.slice(i, i + 250)]);
  return items;
};
const decode = (items) => { try { if (!Array.isArray(items) || items[0][1] !== 'CCOBJ') return null; return { kind: items[1][1], version: items[2][1], data: JSON.parse(items.slice(4).map((x) => x[1]).join('')) }; } catch { return null; } };

const reg = { commands: [], objects: [], toolbar: [], menu: [], panel: [], settings: [], props: [], importers: [], exporters: [], hooks: [] };
const kinds = new Map(), commands = new Map(), propsDefs = new Map();
const cleanups = [];
let nextId = 1;
const doc = {
  map: new Map(), steps: [], pending: null,
  all() { return [...this.map.values()]; }, get(id) { return this.map.get(id); }, count() { return this.map.size; },
  change(label, fn) { if (this.pending) return fn(); this.pending = { label, ops: [] }; try { const r = fn(); for (const h of reg.hooks) h(this, this.pending.ops); this.steps.push(this.pending); return r; } finally { this.pending = null; } },
  add(e) { if (!this.pending) throw new Error('Edits go through doc.change()'); const x = { color: null, layer: '0', ...e, id: nextId++ }; this.map.set(x.id, x); this.pending.ops.push({ map: this.map, id: x.id, before: null, after: x }); return x; },
  update(id, e) { if (!this.pending) throw new Error('Edits go through doc.change()'); const before = this.map.get(id); const x = { ...e, id }; this.map.set(id, x); this.pending.ops.push({ map: this.map, id, before, after: x }); return x; },
  remove(id) { if (!this.pending) throw new Error('Edits go through doc.change()'); const before = this.map.get(id); this.map.delete(id); this.pending.ops.push({ map: this.map, id, before, after: null }); },
  meta: { name: 'Drawing1' }, layers: new Map([['0', { name: '0', color: 7 }]]), blocks: new Map(),
};
const track = (fn) => cleanups.push(fn);
const listed = (list, item) => { list.push(item); track(() => { const i = list.indexOf(item); if (i >= 0) list.splice(i, 1); }); };
const api = {
  version: '1.0', app: { slug: m.apps[0], name: m.apps[0] }, addon: { id: m.id, name: m.name, version: m.version },
  t: tr, url: (p) => pathToFileURL(path.join(DIR, p)).href, log: (...a) => { if (VERBOSE) console.log('  [log]', ...a); },
  storage: (() => { const s = new Map(); return { get: (k) => (s.has(k) ? JSON.parse(s.get(k)) : null), set: (k, v) => { s.set(k, JSON.stringify(v)); return true; }, remove: (k) => s.delete(k) }; })(),
  onDeactivate: (fn) => track(fn), help: () => {},
  ui: {
    toolbarGroup: (o) => { listed(reg.toolbar, o.id); return null; },
    panelSection: (o) => { listed(reg.panel, o.id); return null; },
    settingsSection: (o) => { listed(reg.settings, o.id); return null; },
  },
  files: {
    importer: (o) => { if (typeof o.read !== 'function') throw new Error('importer: read()'); listed(reg.importers, o.id); return o; },
    exporter: (o) => { if (typeof o.write !== 'function') throw new Error('exporter: write()'); listed(reg.exporters, o.id); return o; },
  },
  commands: {
    add(name, aliases, fn, extra = {}) {
      const n = String(name).toUpperCase();
      if (!/^[-_]?[A-Z][A-Z0-9_]{0,30}$/.test(n)) throw new Error('commands.add: "' + name + '" is not a command name');
      if (['LINE', 'CIRCLE', 'MOVE', 'COPY', 'ERASE', 'TEXT', 'INSERT', 'IMPORT', 'EXPORT', 'HELP', 'UNDO'].includes(n)) throw new Error('commands.add: ' + n + ' is already a command');
      commands.set(n, { fn, aliases, extra });
      listed(reg.commands, n);
      const remove = () => commands.delete(n);
      track(remove);
      return remove;
    },
    option: (key, label) => ({ key, label }), has: (n) => commands.has(String(n).toUpperCase()), run: async () => {},
  },
  toolbar: { group: (o) => { listed(reg.toolbar, o.id); return null; }, menuItem: (o) => { listed(reg.menu, o.command); return null; } },
  props: {
    section(spec) {
      const key = String(spec.key ?? m.id);
      if (key !== m.id && !key.startsWith(m.id + '.')) throw new Error('props.section: the key must be "' + m.id + '" or start with "' + m.id + '."');
      propsDefs.set(key, spec);
      listed(reg.props, key);
      const remove = () => propsDefs.delete(key);
      track(remove);
      return remove;
    },
  },
  drawing: { afterChange: (fn) => { listed(reg.hooks, fn); return () => {}; } },
  data: { get: () => null, set: (e) => e },
  objects: {
    define(kind, spec) {
      if (!/^[a-z][a-z0-9-]{0,40}$/.test(kind)) throw new Error('objects.define: kind "' + kind + '"');
      if (typeof spec.draw !== 'function') throw new Error('objects.define: ' + kind + ' needs draw(data)');
      if (spec.frame === 'world' && typeof spec.transform !== 'function') throw new Error('objects.define: a world-frame kind needs transform(data, m)');
      kinds.set(kind, spec);
      listed(reg.objects, kind);
      track(() => kinds.delete(kind));
      return () => kinds.delete(kind);
    },
    create(kind, data, opts = {}) { const s = kinds.get(kind); if (!s) throw new Error('objects: ' + kind + ' is not defined'); return { type: 'insert', block: '*U', x: 0, y: 0, rot: 0, sx: 1, sy: 1, ...opts, xd: { [appid]: encode(kind, s.version || 1, data) } }; },
    update(e, data) { const d = decode(e?.xd?.[appid]); if (!d) throw new Error('objects.update: not one of this add-on\'s objects'); return { ...e, xd: { ...e.xd, [appid]: encode(d.kind, kinds.get(d.kind)?.version || 1, data) } }; },
    is: (e, kind = null) => { const d = decode(e?.xd?.[appid]); return !!d && kinds.has(d.kind) && (!kind || d.kind === kind); },
    kindOf: (e) => decode(e?.xd?.[appid])?.kind ?? null,
    dataOf: (e) => { const d = decode(e?.xd?.[appid]); return d ? structuredClone(d.data) : null; },
    refresh: () => 0,
  },
  get doc() { return doc; }, engine: null, print: (s) => { if (VERBOSE) console.log('  [print] ' + s); }, selection: () => [], select: () => {}, redraw: () => {},
};

// ------------------------------------------------------------------------------------------------ 3. activate, the add-on's tests
section('Activate');
let mod, ret;
try {
  mod = await import(pathToFileURL(path.join(DIR, m.entry)).href);
  ok(typeof mod.activate === 'function', 'the entry exports activate(api)');
  ret = await mod.activate(api);
  ok(true, 'activate(api) ran');
} catch (e) {
  ok(false, 'activate(api) ran', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e));
}
if (VERBOSE) console.log('  registered: ' + JSON.stringify(Object.fromEntries(Object.entries(reg).map(([k, v]) => [k, k === 'hooks' ? v.length : v]))));

const t = {
  ok, api, doc, text: tr,
  registered: new Proxy({}, { get: (o, k) => (k === 'hooks' ? reg.hooks.length : [...(reg[k] || [])]) }),
  async command(name, inputs = []) {
    const cmd = commands.get(String(name).toUpperCase()) || [...commands.values()].find((x) => (x.aliases || []).includes(String(name).toUpperCase()));
    if (!cmd) throw new Error('no command ' + name);
    const queue = [...inputs];
    const take = async () => { if (!queue.length) throw Object.assign(new Error('Cancel'), { cancel: true }); return queue.shift(); };
    const before = new Set(doc.map.keys());
    const c = { doc, host: {}, engine: null, print: api.print, preview: () => {}, point: take, distance: take, angle: take, number: take, string: take, keyword: take, entity: take, select: take };
    try { await cmd.fn(c, null); } catch (e) { if (!e.cancel) throw e; }
    return [...doc.map.values()].filter((e) => !before.has(e.id));
  },
  draw(e) { const d = decode(e?.xd?.[appid]); return kinds.get(d.kind).draw(structuredClone(d.data), { kind: d.kind }); },
  gripMove(e, key, to) { const d = decode(e?.xd?.[appid]); return kinds.get(d.kind).gripMove(structuredClone(d.data), key, to); },
  props(e) { const out = []; for (const s of propsDefs.values()) if (!s.types || s.types.includes(e.type)) out.push(...(s.defs([e], {}) || [])); return out; },
};
const testDir = path.join(DIR, 'test');
const tests = fs.existsSync(testDir) ? fs.readdirSync(testDir).filter((f) => /\.test\.m?js$/.test(f)).sort() : [];
for (const f of tests) {
  section('test/' + f);
  try { const tm = await import(pathToFileURL(path.join(testDir, f)).href); await tm.default(t); }
  catch (e) { ok(false, f + ' ran to the end', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)); }
}
if (!tests.length) console.log('\n(no test/*.test.mjs: add some — see docs/GUIDE.md § Testing)');

// ------------------------------------------------------------------------------------------------ 4. switch it off
section('Switch off');
try { if (mod && typeof mod.deactivate === 'function') await mod.deactivate(api); if (typeof ret === 'function') await ret(); } catch (e) { ok(false, 'deactivate ran', e.message); }
for (const fn of cleanups.splice(0).reverse()) { try { fn(); } catch (e) { ok(false, 'a cleanup ran', e.message); } }
ok(!commands.size && !kinds.size && !propsDefs.size && Object.entries(reg).every(([, v]) => !v.length), 'everything it registered is gone', JSON.stringify(Object.fromEntries(Object.entries(reg).filter(([, v]) => v.length))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

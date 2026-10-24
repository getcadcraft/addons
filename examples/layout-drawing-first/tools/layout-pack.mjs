#!/usr/bin/env node
/* SPDX-License-Identifier: Apache-2.0 */
/**
 * layout-pack.mjs — make the zip of a layout add-on (`npm run pack`): the workspace/ folder (index.json + the .ccworkspace.json files).
 * No dependencies; Node 20 or newer. From the add-on template's addon-pack.mjs.
 *
 *   node tools/layout-pack.mjs [folder]     → <id>-layout.zip in the folder
 *
 * Takes workspace/ only; refuses more than 200 files or
 * 5 MB (the directory's limits). Run `npm test` first.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIR = path.resolve(process.argv[2] || '.');
const ix = JSON.parse(fs.readFileSync(path.join(DIR, 'workspace', 'index.json'), 'utf8'));
const m = { id: ix.addons[0].id, version: 'layout' };
const out = path.join(DIR, `${m.id}-${m.version}.zip`);
const skip = (n) => n.startsWith('.') || ['test', 'tools', 'node_modules', 'package.json', 'package-lock.json'].includes(n) || n.endsWith('.zip');
const files = [];
const walk = (d) => { for (const n of fs.readdirSync(path.join(DIR, d)).sort()) { if (skip(n)) continue; const p = d ? d + '/' + n : n; if (fs.statSync(path.join(DIR, p)).isDirectory()) walk(p); else files.push(p); } };
walk('workspace');
const total = files.reduce((s, f) => s + fs.statSync(path.join(DIR, f)).size, 0);
if (files.length > 200 || total > 5 * 1024 * 1024) { console.error('Too big for the directory: ' + files.length + ' files, ' + total + ' bytes (at most 200 files, 5 MB).'); process.exit(1); }

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const parts = [], central = [];
let offset = 0;
for (const f of files) {
  const data = fs.readFileSync(path.join(DIR, f));
  const comp = zlib.deflateRawSync(data, { level: 9 });
  const name = Buffer.from(f, 'utf8');
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
  head.writeUInt32LE(0, 10); head.writeUInt32LE(crc, 14); head.writeUInt32LE(comp.length, 18); head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28);
  parts.push(head, name, comp);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
  central.push(cen, name);
  offset += 30 + name.length + comp.length;
}
const cenBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
fs.writeFileSync(out, Buffer.concat([...parts, cenBuf, end]));
console.log('Wrote ' + path.relative(process.cwd(), out) + ' (' + files.length + ' files). Send it for review (docs/LAYOUTS.md § Review), or share the .ccworkspace.json itself: anyone can import it');

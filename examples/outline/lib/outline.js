/* SPDX-License-Identifier: Apache-2.0 */
/**
 * outline.js — the Outline example's geometry and its export, with no app in sight (so `npm test` can check it directly).
 *
 *   toLocal(points)            drawing points → {origin, pts}: the outline's own points, the first one at (0, 0)
 *   worldPoints(ref, pts)      the outline's points where the block reference puts them (move, rotate, scale, mirror)
 *   area(pts) · perimeter(pts) a closed outline (straight sides)
 *   csvCell(v) · csv(rows)     CSV text; a cell starting = + - @ gets a leading ' so a spreadsheet never runs it as a formula
 */

export function toLocal(points) {
  const o = points[0];
  return { origin: { x: o.x, y: o.y }, pts: points.map((p) => ({ x: p.x - o.x, y: p.y - o.y })) };
}

/** A block reference = translate(x, y) · rotate(rot, radians) · scale(sx, sy). */
export function worldPoints(ref, pts) {
  const c = Math.cos(ref.rot || 0), s = Math.sin(ref.rot || 0);
  const sx = ref.sx ?? 1, sy = ref.sy ?? 1;
  return pts.map((p) => {
    const x = p.x * sx, y = p.y * sy;
    return { x: (ref.x || 0) + x * c - y * s, y: (ref.y || 0) + x * s + y * c };
  });
}

export function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

export function perimeter(pts) {
  let l = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; l += Math.hypot(q.x - p.x, q.y - p.y); }
  return l;
}

/** The middle of the outline's box: where the tag goes. */
export function middle(pts) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function csv(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

# Writing a CadCraft add-on

An add-on is a folder: a manifest, a JavaScript module the app imports, its own language files and help. The app calls the
module's `activate(api)` when it starts, and everything the add-on registers through `api` goes away again when someone
switches it off in the app's Settings (General, Add-ons).

## The folder

```
my-addon/
  addon.json        the manifest
  main.js           export function activate(api) { … }   (optional: export function deactivate(api))
  lib/…             more modules, imported with relative paths ("./lib/x.js")
  lang/en.json      every word a person reads, through api.t('key', {vars})
  help/*.md         help topics
  LICENSE           the license text
  test/*.test.mjs   your tests (not packed)
```

Modules import only each other, with relative paths, and never in a circle: an installed add-on is linked from
`blob:` URLs, so nothing outside the folder can be reached.

## addon.json

| Key | |
|---|---|
| `id` | `com.example.thing`: lower-case letters, digits, `.` and `-`, 2–64 characters, starting with a letter. It never changes. |
| `name` | up to 60 characters |
| `version` | semver `1.2.3`; every upload needs a new, higher one |
| `apps` | `["cadcraft"]`, any of the eight app slugs |
| `api` | the add-on API it needs, `"1.0"`. An app refuses an add-on that needs a newer major or minor than it has. |
| `license` | an SPDX id the directory can sign (see the README) |
| `entry` | `"./main.js"` |
| `permissions` | what it does, shown before anyone installs it: `commands`, `toolbar`, `panel`, `settings`, `objects`, `files`, `storage`, `network` |
| `description`, `author`, `homepage` (https), `lang` (`"./lang/"`), `help` (a compiled help module) | optional |

Say `network` if your code talks to any server; review checks where to.

## The API

### Every app

| Call | |
|---|---|
| `api.version`, `api.app {slug, name}`, `api.addon {id, name, version}` | |
| `api.t(key, vars)` | your strings, in the person's language when you have it, else English |
| `api.url(path)` | a URL for one of your files |
| `api.storage.get / set / remove(key)` | small JSON values kept in this browser |
| `api.onDeactivate(fn)` | anything else to undo when switched off |
| `api.ui.toolbarGroup({id, label, tools: [{id, label, icon: 'bi-…', title, run}]})` | a toolbar group |
| `api.ui.panelSection({id, title, side, render(el)})` | a section in a side panel |
| `api.ui.settingsSection({id, title, render(fieldset), reset()})` | a fieldset in the app's Settings |
| `api.files.importer({id, label, extensions, read(file)})`, `api.files.exporter({id, label, extension, mime, write(doc)})` | file types |

### CadCraft 1.0

| Call | |
|---|---|
| `api.commands.add(NAME, [ALIASES], async (c) => {…}, {help})` | a command exactly like CadCraft's own: ask with `c.point / distance / angle / number / string / keyword / select / entity`, edit with `c.doc.change(label, () => { c.doc.add(…); c.doc.update(…); })`. One command = one undo step. A name that is already taken is refused: an add-on never replaces a command. |
| `api.commands.option(key, label)`, `api.commands.has(name)`, `api.commands.run('ZOOM E')` | |
| `api.toolbar.group({id, label, tools: [{id, label, icon, title, command: 'NAME'}]})` | a group in CadCraft's look |
| `api.toolbar.menuItem({group, command, label, key})` | an item in a More menu (`Annotate`, `Blocks`, `Modify`, `View`, `Edit`, or your own group's id) |
| `api.props.section({key, label, types, defs(ents) → fields})` | a Properties panel section; `key` is your id (or starts with `<id>.`); fields `{key, kind, label, get(e), set(e, v) → changed entity}`, kind `len ang num int text textarea bool choice color ro` |
| `api.doc`, `api.engine`, `api.print(text)`, `api.selection()`, `api.select(ids)`, `api.redraw()` | |
| `api.drawing.afterChange((doc, ops) => …)` | follow-up edits inside the same undo step (keep things connected) |
| `api.data.get(e)`, `api.data.set(e, value)` | your own JSON on any object, kept in DWG and DXF |
| `api.objects.define(kind, spec)` and `create`, `update`, `is`, `kindOf`, `dataOf`, `refresh` | objects of your own (below) |

### MarkupCraft 1.0

| Call | |
|---|---|
| `api.markups.list({sheet})`, `api.markups.get(id)` | copies of the markups |
| `api.markups.change(label, (tx) => { tx.add({kind, rect / pts, data}); tx.update(id, patch); tx.remove(id); })` | one undo step; markups read from the file as read-only are never changed |
| `api.markups.defineType(kind, {name, base, style, subject, version})` | a markup type of your own on one of MarkupCraft's (`cloudrect`, `rect`, `polyline`, `stamp`, …) |
| `api.tools.start(kind, data)` | MarkupCraft's own tool for the base type; everything drawn with it is your type, carrying `data` |
| `api.markups.is / kindOf / dataOf / data.get / data.set(m, value)` (→ the patch for `tx.update`), `api.markups.onChange(fn)` | |
| `api.columns.add({id, label, value(m)})` | a column in the markups CSV and the summary workbook |
| `api.ui.panelTab({id, title, render(el)})`, `api.sheets.current()`, `api.selection()`, `api.select(ids)`, `api.status(text)` | |

Your types are saved as their base type's PDF annotation, so every PDF viewer shows them; your data rides in MarkupCraft's
own data in the PDF. Opened without your add-on they are ordinary markups, and the data is saved back untouched.

### TakeoffCraft 1.0

| Call | |
|---|---|
| `api.items.defineType(kind, {name, type: 'linear' \| 'area' \| 'count', defaults: {unit, waste, heightFt, components: [{name, unit, formula}], conds}, data})` | an item type with its assembly; it is offered in the new-item form while your add-on is on |
| `api.items.add(fields)`, `api.items.create(kind, over)`, `is / kindOf / dataOf / data.get / data.set(item, value)` | items, one undo step each call |
| `api.export.column({id, label, value(row, item)})` | a column in the estimate CSV and XLSX |
| `api.takeoff.state()`, `quantities()`, `estimate()`, `onChange(fn)`, `api.takeoff.model` | |
| `api.ui.panelTab({id, title, render(el)})` | a section of your own in the right panel |

Add-on file types appear in CadCraft's **IMPORT** and **EXPORT** commands. An importer's `read(file)` returns
`{entities, blocks?, layers?}` (added to the drawing as one step) or `{drawing}` (opened as a new drawing).

## Objects of your own

`template/` places numbered notes; `examples/outline/` is a fuller one for 2D work (corner grips, a Properties field, read-only
values, a command that converts an existing polyline in one undo step, an exporter). The add-ons CadCraft itself ships,
such as Electrical, are built on the same API and are in the CadCraft app's own repository under `app/addons/`.

```js
api.objects.define('note', {
  version: 1,                       // your data's version
  name: api.t('note.name'),         // what Properties and LIST call it
  draw(data) { return [ { type: 'circle', cx: 0, cy: 0, r: 2 }, { type: 'text', … } ]; },
  grips(data) { return [{ x, y, key: 'text' }]; },
  gripMove(data, key, to) { …; return data; },
  // frame: 'world' + transform(data, m) for data kept in drawing coordinates (a wire whose ends sit on terminals)
  // read(data, version) to upgrade data an older version wrote
});
c.doc.change('NOTE', () => c.doc.add({ ...api.objects.create('note', data), x, y }));
```

CadCraft keeps each object as a block reference: the block holds what `draw` returned, and your data rides along in the
reference's xdata under your own application name (`CC_` + your id in capitals). Everything that works for block
references works for your objects: picking, snaps, move, rotate, scale, mirror, copy and paste, plots, DWG and DXF.

**Without your add-on** the object is just a block reference. It still shows, can be moved or erased, and its data is
written back unchanged when the drawing is saved, so nothing is lost when someone without your add-on edits the drawing.
Other CAD programs see the same. Keep your data under 12 000 characters of JSON per object.

## Testing

`npm test` checks the package the way the directory does, activates your add-on against a stand-in for CadCraft's API, runs
`test/*.test.mjs` and checks that switching it off removes everything. A test file:

```js
export default async function (t) {
  const [note] = await t.command('NOTE', [{ x: 10, y: 5 }, 'Check the clearance']);   // answers to c.point, c.string …
  t.ok(t.api.objects.dataOf(note).text === 'Check the clearance', 'the note keeps its text');
  t.ok(t.draw(note).some((e) => e.type === 'circle'), 'it draws a bubble');
}
```

An add-on whose first app is MarkupCraft or TakeoffCraft gets that app's stand-in instead of CadCraft's: `t.records()` (the
markups or items it made), `t.column(id)` and `t.lastTool` (what `tools.start` picked).

`t.exporter(id)` and `t.importer(id)` give you what you registered, so a test can call `write(t.doc)` or `read(file)` itself
(`examples/outline/test/outline.test.mjs` checks its CSV that way).

The stand-in is not CadCraft. Try your add-on in the app before you upload it, in developer mode: in the browser's console on
CadCraft's page run `localStorage.setItem('cc-addons-dev', '1')`, then install your files with
`await ccAddons.installPackage({ manifest, files: { 'addon.json': '…', 'main.js': '…', … } })` and reload. An unsigned package
then loads, marked "unsigned" in Settings (General, Add-ons). `localStorage.removeItem('cc-addons-dev')` turns it off again.
There is no button for this yet.

## Packing, review and signing

`npm run pack` writes `<id>-<version>.zip` (no `test/`, `tools/`, `node_modules/`). Upload it at
getcadcraft.com/addons/upload, signed in with a verified CadCraft account, and confirm that you wrote it or may publish it
under its license. The directory checks it (the manifest, the license, the files, imports outside the add-on) and the CadCraft
team reads the code: what review checks and how long it takes is at getcadcraft.com/addons/review. You get an email when a
version is decided; a version that is not approved comes with a note saying why. An approved version is signed with
getcadcraft.com's key and listed under your account's name, with an author page of its own. The apps install and load only
signed packages, and check the signature again every time they start, so a changed file is refused.

Add-ons in the directory are free. Your id is yours once your first upload is in: nobody else can upload under it.

A published version never changes: a fix is a new version.

## Not built yet

- Uploads from outside the CadCraft team: built, and switched on when the directory opens to the public.
- Installing from the directory into the desktop app.
- A help compiler you can run yourself: put your topics in `help/*.md`; review compiles them for now.
- Scripts (CraftScript, Lua) as add-ons, and add-on commands as tools for AI assistants.

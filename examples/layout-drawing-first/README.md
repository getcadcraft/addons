<!-- SPDX-License-Identifier: Apache-2.0 -->
# Drawing first: an example workspace layout

A layout (add-on kind `workspace`) that gives the drawing as much room as the screen allows: the ribbon starts folded to its tabs, the
palettes sit in the right panel, the view tabs run along the bottom. How layouts work, the format and the rules: [docs/LAYOUTS.md](../../docs/LAYOUTS.md).

```sh
npm test        # the file read the way the apps read it (tools/workspace-format.js is the apps' own validator), then test/
npm run pack    # → drawing-first-layout.zip (the workspace/ folder)
```

To try it: in a CadCraft app that has layouts, Settings › Global › Layout › Import a layout… and pick
`workspace/drawing-first.ccworkspace.json`, then pick Drawing first in the list.

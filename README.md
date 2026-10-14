# CadCraft add-ons

Add-ons are features you can switch on or off in the [CadCraft](https://getcadcraft.com) apps. An add-on extends an app
(CadCraft, BimCraft, ModelCraft and the rest of the eight); it is never an app of its own.

> **Status:** the add-on API (CadCraft 1.0, the shared API 1.0 in the other apps) and the directory exist in the CadCraft
> lab. The directory at getcadcraft.com/addons is not open to the public yet, and uploads are open to the CadCraft team
> only for now.

## What is in this repo

- `docs/GUIDE.md`: how to write one: the folder, `addon.json`, the API, objects of your own, data in DWG and DXF,
  testing, packing, review and signing.
- `template/`: a small working add-on (numbered note bubbles in CadCraft) to copy, with its own tests,
  `npm test` (a stand-in for the app, no dependencies) and `npm run pack` (the zip you upload).
- `examples/outline/`: a small, complete example for 2D work: a closed outline that carries a tag, with a grip on every
  corner, the tag in the Properties panel, area and perimeter, and an exporter (CSV). It saves in DWG and DXF with nothing
  extra to write. Start here for cutting, sign-making or space-planning add-ons. Same `npm test` and `npm run pack`.

`tools/` is the same in the template and in each example.

## Start

```sh
cp -r template my-addon && cd my-addon
# change addon.json: id, name, author
npm test
npm run pack
```

## License

Apache-2.0 (`LICENSE`). Your own add-on may use any license the directory can sign: Apache-2.0, MIT, BSD-2-Clause,
BSD-3-Clause, ISC, 0BSD, Unlicense, Zlib or CC0-1.0.

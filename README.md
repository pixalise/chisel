# Chisel for Roblox

Chisel is an Electron desktop workspace for authoring Roblox game data. It manages typed tables, assets with published Roblox IDs, localization, keyboard/mouse input definitions, and project tasks. Roblox Luau is the sole export target.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

Run `bun run check` for policy checks, formatting, lint, tests, and TypeScript. Run `bun run build` for the production renderer and Electron code.

With the [Luau CLI tools](https://github.com/luau-lang/luau/releases) installed together, run `bun run test:roblox` (or `bun run test:roblox /path/to/luau`) to compile generated modules, typecheck standalone modules, and execute runtime checks with Roblox API doubles.

## Roblox workflow

1. Create or open a project pointing at your Roblox source workspace.
2. Author tables, localization, and input actions. Import source assets and enter their published Roblox asset IDs in the asset editor.
3. In Settings, **Commit Draft**, then **Export Roblox Luau**.
4. Map the generated `ChiselData` folder into your Rojo project's `ReplicatedStorage`, or recreate its folder/ModuleScript hierarchy in Studio.

See [EXPORTS.md](./EXPORTS.md) for the output layout, Rojo mapping, asset IDs, runtime APIs, and validation rules.

Project formats are current-only. Schema changes rewrite checked-in project data directly; Chisel does not carry runtime upgrades or compatibility branches.

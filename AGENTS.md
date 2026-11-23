# Mrak Editor Instructions

The `mrak` branch is the maintained direction of Chisel. The user authorized
restoring texture packing, then replacing GPPT with the Zora PBR (`.zpbr`) format.
Read `TEXTURE_FORMAT.md` for the current channel and file contract. Mrak owns imports/authored
data; game settings remain game-owned. Zora is the only runtime target; Roblox support was explicitly retired by the user.

Read [agent.md](./agent.md) before changing frontend code. Its supplied React frontend review policy is mandatory and supersedes conflicting legacy conventions. Chisel is an Electron desktop application with a DOM-based React frontend; web rules apply to its renderer, while Electron main/preload and shared runtime-generation code keep their platform ownership.

- Do not add custom CSS class selectors to `src/renderer/styles.css`; it may only contain Tailwind directives, design tokens, and base element rules.
- Style editor UI with Tailwind utility classes and compose variants with `cn(...)`.
- Do not add semantic/BEM-style renderer class names such as `.screen-card` or `.editor__row`; create React components or Tailwind utility constants instead.
- Declare renderer components as `const Name: FC<Props> = (props) =>` and destructure props inside the component body, never in its parameter list.
- In JSX, use `condition && <Element />` for conditional rendering. Do not use `condition ? <Element /> : null`.
- Keep hand-authored Chisel feature components to one React component per file. Split sub-editors into separate kebab-case files instead of nesting multiple components in one file.
- Chisel and exported game code are explicitly fail-fast: do not silently fall back when required generated data, assets, translations, input bindings, or project config are missing or invalid. Surface the error close to the source with an assertion, thrown error, or validation failure.
- When changing localization, exported schemas, schema validation, or generated runtime output contracts, update every affected side in the same change: Chisel schemas/tests, editor UI, export generator/tests, and checked-in generated consumer files.
- Project formats are current-only. When a schema or managed layout changes, directly rewrite every checked-in project and snapshot in the same change. Never add runtime upgrade hooks, migration functions, legacy schema preprocessors/unions, or compatibility branches.
- `UI` is the canonical category for interface imagery. Checked-in project metadata and managed source paths must use it while preserving stable asset slugs.
- Chisel table data is saved as one full table JSON document per table. User tables live under `.chisel/tables/user/<table_id>.json`; system tables live under `.chisel/tables/system/...`, for example `.chisel/tables/system/materials.json`.
- Keep immutable authored definitions in Chisel and mutable gameplay instances in the consumer. Do not export save-state containers, installed-upgrade instances, enabled deck state, hands, or encounter state as content tables.
- Export enough stable definition identity and references for the runtime to retain source traces. Runtime definition identity and references remain string slugs; never project them to numeric IDs.
- Export Zora content under `ZoraData`, with generated D accessors and standard Lua 5.5 data/annotations. Models preserve Blender object names/hierarchy. Do not restore WFC terrain authoring.
- Runtime asset paths are package-relative. Commit fingerprints cover the exact source bytes used by export; fail on missing/changed inputs.
- Read `EXPORTS.md` before changing a generated runtime contract. Keep generated definitions immutable and retain stable string source slugs and typed values.

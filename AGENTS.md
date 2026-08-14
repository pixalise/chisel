# Chisel Editor Instructions

- Do not add custom CSS class selectors to `src/renderer/styles.css`; it may only contain Tailwind directives, design tokens, and base element rules.
- Style editor UI with Tailwind utility classes and compose variants with `cn(...)`.
- Do not add semantic/BEM-style renderer class names such as `.screen-card` or `.editor__row`; create React components or Tailwind utility constants instead.
- Declare renderer components as `const Name: FC<Props> = (props) =>` and destructure props inside the component body, never in its parameter list.
- In JSX, use `condition && <Element />` for conditional rendering. Do not use `condition ? <Element /> : null`.
- Keep hand-authored Chisel feature components to one React component per file. Split sub-editors into separate kebab-case files instead of nesting multiple components in one file.
- Chisel and exported game code are explicitly fail-fast: do not silently fall back when required generated data, assets, translations, input bindings, or project config are missing or invalid. Surface the error close to the source with an assertion, thrown error, or validation failure.
- When changing localization, exported schemas, schema validation, or generated runtime output contracts, update every affected side in the same change: Chisel schemas/tests, editor UI, export generator/tests, and checked-in generated consumer files.
- The LÖVE and Teal targets own the complete `gamedata` directory. Every generated module and copied or unpacked asset must remain under that root; do not place LÖVE-facing export artifacts in `source`, `assets/chisel`, or another sibling directory.
- LÖVE runtime consumers load assets through generated `gamedata.asset_manager` category IDs. Keep its loaders lazy, category-validated, and self-contained; never require consumers to reconstruct paths or maintain a parallel cache.
- `UI` is the canonical category for interface imagery and replaces legacy `UI_ICON`. Project upgrades must migrate both metadata and managed source paths without changing stable asset slugs.
- Chisel table data is saved as one full table JSON document per table. User tables live under `.chisel/tables/user/<table_id>.json`; system tables live under `.chisel/tables/system/...`, for example `.chisel/tables/system/inputs.json`.
- Read `EXPORTS.md` before changing a generated runtime contract. For FARBOUND-facing content work, also read `FARBOUND_INTEGRATION.md` and the authoritative product specifications in the sibling `farbound` repository.
- Keep immutable authored definitions in Chisel and mutable gameplay instances in the consumer. Do not export save-state containers, installed-upgrade instances, enabled deck state, hands, or encounter state as content tables.
- Preserve FARBOUND's card taxonomy in schemas: upgrade cards, combat cards, physical consumables, and contextual requirements are distinct. Never model all four through one ambiguous generic card table.
- Model variable equipment-native and upgrade-granted combat actions through reference rows or another normalized relation, not numbered fields such as `card_1`, `card_2`, and `card_3`.
- Export enough stable definition identity and references for the runtime to retain source traces. Generated dense numeric IDs are runtime projections and must not be treated as durable save identity.

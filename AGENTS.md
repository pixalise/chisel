# Chisel Editor Instructions

- Do not add custom CSS class selectors to `src/renderer/styles.css`; it may only contain Tailwind directives, design tokens, and base element rules.
- Style editor UI with Tailwind utility classes and compose variants with `cn(...)`.
- Do not add semantic/BEM-style renderer class names such as `.screen-card` or `.editor__row`; create React components or Tailwind utility constants instead.
- Declare renderer components as `const Name: FC<Props> = (props) =>` and destructure props inside the component body, never in its parameter list.
- In JSX, use `condition && <Element />` for conditional rendering. Do not use `condition ? <Element /> : null`.
- Keep hand-authored Chisel feature components to one React component per file. Split sub-editors into separate kebab-case files instead of nesting multiple components in one file.
- Chisel table data is saved as one full table JSON document per table. User tables live under `.chisel/tables/user/<table_id>.json`; system tables live under `.chisel/tables/system/...`, for example `.chisel/tables/system/inputs.json`.

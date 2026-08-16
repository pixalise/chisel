import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";

const sourceRoot = join(process.cwd(), "src", "renderer");
const violations = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(path);
      continue;
    }
    if (extname(path) !== ".tsx") continue;

    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/key=\{[^}]*\bslug\b[^}]*\}/gi)) {
      const line = source.slice(0, match.index).split("\n").length;
      violations.push(`${relative(process.cwd(), path)}:${line}: ${match[0]}`);
    }
  }
}

visit(sourceRoot);

if (violations.length > 0) {
  console.error("React keys must use positional identity, never an editable slug:\n");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("React keys do not depend on editable slugs.");

import fs from "node:fs/promises";
import path from "node:path";

const editorRoot = path.resolve(import.meta.dirname, "..");
const checkedRoots = ["src", "scripts"];
const kebabFilePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*$/;
const ignoredDirs = new Set(["node_modules", "dist", "dist-electron", "generated"]);

async function walk(dir, failures) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await walk(absolutePath, failures);
      }
      continue;
    }

    if (entry.isFile() && !kebabFilePattern.test(entry.name)) {
      failures.push(path.relative(editorRoot, absolutePath));
    }
  }
}

const failures = [];
for (const root of checkedRoots) {
  await walk(path.join(editorRoot, root), failures);
}

if (failures.length > 0) {
  console.error("Chisel source filenames must be kebab-case:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

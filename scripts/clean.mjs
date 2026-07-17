import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorRoot = path.resolve(__dirname, "..");

await Promise.all([
  fs.rm(path.join(editorRoot, "dist"), { recursive: true, force: true }),
  fs.rm(path.join(editorRoot, "dist-electron"), { recursive: true, force: true })
]);

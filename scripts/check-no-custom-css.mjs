import fs from "node:fs/promises";

const cssPath = new URL("../src/renderer/styles.css", import.meta.url);
const css = await fs.readFile(cssPath, "utf8");
const classSelector = /(^|[,{]\s*)\.[A-Za-z_-][A-Za-z0-9_-]*/m;

if (classSelector.test(css)) {
  console.error("src/renderer/styles.css must not contain custom class selectors. Use Tailwind utilities and cn(...) in React instead.");
  process.exit(1);
}

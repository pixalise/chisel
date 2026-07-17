import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const editorRoot = path.resolve(scriptDir, "..");
const eslintBin = path.join(editorRoot, "node_modules", "eslint", "bin", "eslint.js");

const result = spawnSync(process.execPath, [eslintBin, ".", "--max-warnings=0", "--format", "json"], {
  cwd: editorRoot,
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"]
});

if (result.stderr) {
  process.stderr.write(result.stderr);
}

let reports;
try {
  reports = JSON.parse(result.stdout || "[]");
} catch {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  process.exit(result.status ?? 1);
}

const messages = [];
for (const report of reports) {
  for (const message of report.messages) {
    const relativePath = path.relative(editorRoot, report.filePath);
    const rule = message.ruleId ? ` ${message.ruleId}` : "";
    messages.push(`${relativePath}:${message.line}:${message.column}: ${message.message}${rule}`);
  }
}

if (messages.length > 0) {
  console.error("ESLint issues:");
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exit(result.status || 1);
}

if (result.status !== 0) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  process.exit(result.status ?? 1);
}

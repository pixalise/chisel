import { spawnSync } from "node:child_process";

const checks = [
  {
    name: "filename check",
    command: ["bun", "run", "filenames:check"],
    hint: "Rename the listed Chisel files to kebab-case."
  },
  {
    name: "CSS policy check",
    command: ["bun", "run", "css:check"],
    hint: "Move custom styling into Tailwind utilities or cn(...) usage."
  },
  {
    name: "React key policy check",
    command: ["bun", "run", "react-keys:check"],
    hint: "Use an array index for editable rows instead of a user-entered slug."
  },
  {
    name: "format check",
    command: ["bun", "run", "format:check"],
    hint: "Run `bun run format` from editor/ to apply Prettier fixes.",
    diagnose: () => run(["bun", "run", "prettier", "--list-different", "."])
  },
  {
    name: "lint",
    command: ["bun", "run", "lint"],
    hint: "Fix the ESLint messages listed above."
  },
  {
    name: "tests",
    command: ["bun", "run", "test"],
    hint: "Fix the failing Vitest cases listed above."
  },
  {
    name: "typecheck",
    command: ["bun", "run", "typecheck"],
    hint: "Fix the TypeScript errors listed above."
  }
];

function formatCommand(command) {
  return command.join(" ");
}

function run(command) {
  return spawnSync(command[0], command.slice(1), {
    stdio: "inherit"
  });
}

for (const check of checks) {
  console.log(`\n==> ${check.name}: ${formatCommand(check.command)}`);
  const result = run(check.command);

  if (result.status !== 0) {
    console.error(`\nChisel check failed during: ${check.name}`);
    console.error(`Command: ${formatCommand(check.command)}`);

    if (check.diagnose) {
      console.error("\nIssue locations:");
      check.diagnose();
    }

    console.error(`\nNext step: ${check.hint}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nChisel checks passed.");

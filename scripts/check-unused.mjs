import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile)
if (config.error) {
  throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"))
}
const options = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, root).options

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return filesUnder(file)
    }
    return [file]
  })
}

const sources = filesUnder(path.join(root, "src")).filter((file) => /\.tsx?$/.test(file))
const roots = [
  "src/renderer/main.tsx",
  "src/renderer/vite-env.d.ts",
  "src/main/main.ts",
  "src/preload/preload.ts",
  // Registered by sharp-worker-client through Worker(path.join(__dirname, "sharp-worker.js")).
  "src/main/sharp-worker.ts",
].map((file) => path.join(root, file))
const entries = [
  ...roots,
  ...sources.filter((file) => /\.test\.tsx?$/.test(file)),
  ...filesUnder(path.join(root, "scripts")).filter((file) => file.endsWith(".mjs")),
]
const reached = new Set()
const packages = new Set()

function visit(file) {
  if (reached.has(file)) {
    return
  }
  reached.add(file)
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true
  )
  function inspect(node) {
    let specifier
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifier = node.moduleSpecifier.text
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === "require")
    ) {
      specifier = node.arguments[0].text
    }
    if (specifier) {
      if (
        !specifier.startsWith(".") &&
        !specifier.startsWith("@/") &&
        !specifier.startsWith("node:")
      ) {
        let name = specifier.split("/")[0]
        if (specifier.startsWith("@")) {
          name = specifier.split("/").slice(0, 2).join("/")
        }
        packages.add(name)
      }
      const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule
      if (resolved && !resolved.isExternalLibraryImport) {
        visit(resolved.resolvedFileName)
      }
    }
    ts.forEachChild(node, inspect)
  }
  inspect(source)
}

for (const entry of entries) {
  visit(entry)
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
const unusedFiles = sources.filter((file) => !reached.has(file))
const unusedPackages = Object.keys(manifest.dependencies).filter((name) => !packages.has(name))
if (unusedFiles.length > 0 || unusedPackages.length > 0) {
  for (const file of unusedFiles) {
    process.stderr.write(`Unreachable source file: ${path.relative(root, file)}\n`)
  }
  for (const name of unusedPackages) {
    process.stderr.write(`Unused production dependency: ${name}\n`)
  }
  process.exit(1)
}
process.stdout.write(
  "Source entries, tests, native workers, and production dependencies are connected.\n"
)

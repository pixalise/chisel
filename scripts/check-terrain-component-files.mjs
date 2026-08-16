import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

const terrainRoots = [
  join(process.cwd(), "src", "renderer", "screens", "main-stack", "terrain-annotations-screen"),
  join(process.cwd(), "src", "renderer", "screens", "main-stack", "terrain-generator-screen")
];
const violations = [];

function hasJsx(node) {
  let found = false;
  function visit(child) {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(child, visit);
  }
  visit(node);
  return found;
}

function isFeatureComponent(declaration) {
  if (!ts.isIdentifier(declaration.name) || !/^[A-Z]/.test(declaration.name.text)) return false;
  if (declaration.type && ts.isTypeReferenceNode(declaration.type)) {
    const typeName = declaration.type.typeName;
    if ((ts.isIdentifier(typeName) && typeName.text === "FC") || (ts.isQualifiedName(typeName) && typeName.right.text === "FC")) {
      return true;
    }
  }
  return Boolean(declaration.initializer && hasJsx(declaration.initializer));
}

function checkFile(path) {
  const source = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const components = [];

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (isFeatureComponent(declaration)) components.push(declaration.name.text);
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name && /^[A-Z]/.test(statement.name.text) && hasJsx(statement)) {
      components.push(statement.name.text);
    }
  }

  if (components.length > 1) {
    violations.push(`${relative(process.cwd(), path)}: ${components.join(", ")}`);
  }
}

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (extname(path) === ".tsx") checkFile(path);
  }
}

for (const root of terrainRoots) visit(root);

if (violations.length > 0) {
  console.error("Terrain and annotation feature files may declare only one React component:\n");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Terrain and annotation feature files contain at most one React component each.");

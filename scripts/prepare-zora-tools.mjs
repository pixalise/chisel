import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
let architecture = "x64"
if (process.arch === "arm64") {
  architecture = "arm64"
}
let platform = "linux"
if (process.platform === "darwin") {
  platform = "osx"
}
const source =
  process.env.MRAK_TEXTUREC ??
  path.join(
    root,
    "../vox_engine/vcpkg_installed",
    `${architecture}-${platform}`,
    "tools/bgfx/texturec"
  )
await fs.access(source)
await fs.mkdir(path.join(root, "resources"), { recursive: true })
await fs.copyFile(source, path.join(root, "resources/texturec"))
await fs.chmod(path.join(root, "resources/texturec"), 0o755)

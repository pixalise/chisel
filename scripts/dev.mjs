import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorRoot = path.resolve(__dirname, "..");
const rendererUrl = "http://127.0.0.1:5174";
const require = createRequire(import.meta.url);
const bunBin = process.execPath;
const tscScript = path.join(editorRoot, "node_modules", "typescript", "bin", "tsc");
const viteScript = path.join(editorRoot, "node_modules", "vite", "bin", "vite.js");
const electronBin = require("electron");

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: editorRoot,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

function waitForPort(port, host) {
  return new Promise((resolve) => {
    const check = () => {
      const socket = createServer();
      socket.once("error", () => {
        resolve();
      });
      socket.once("listening", () => {
        socket.close(() => setTimeout(check, 100));
      });
      socket.listen(port, host);
    };
    check();
  });
}

await fs.rm(path.join(editorRoot, "dist-electron"), { recursive: true, force: true });
await runOnce(bunBin, [tscScript, "-p", "tsconfig.electron.json"]);

const vite = spawn(bunBin, [viteScript, "--host", "127.0.0.1", "--port", "5174", "--strictPort"], {
  cwd: editorRoot,
  stdio: "inherit"
});

await waitForPort(5174, "127.0.0.1");

const electron = spawn(electronBin, ["."], {
  cwd: editorRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_RENDERER_URL: rendererUrl
  }
});

const shutdown = () => {
  vite.kill();
  electron.kill();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
electron.on("exit", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});

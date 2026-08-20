import { spawn } from "node:child_process";
import { watch } from "node:fs";
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

function forwardOutput(child) {
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
}

function waitForCompilerReady(child) {
  return new Promise((resolve, reject) => {
    let output = "";

    const cleanup = () => {
      child.stdout.off("data", onOutput);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`Electron TypeScript watcher exited before it was ready with code ${code ?? "unknown"}`));
    };
    const onOutput = (chunk) => {
      output = `${output}${chunk.toString()}`.slice(-8_192);
      const result = /Found (\d+) errors?\. Watching for file changes\./.exec(output);
      if (!result) {
        return;
      }

      cleanup();
      if (result[1] !== "0") {
        reject(new Error(`Electron TypeScript watcher started with ${result[1]} errors`));
        return;
      }
      resolve();
    };

    child.stdout.on("data", onOutput);
    child.on("error", onError);
    child.on("exit", onExit);
  });
}

await fs.rm(path.join(editorRoot, "dist-electron"), { recursive: true, force: true });
await runOnce(bunBin, [tscScript, "-p", "tsconfig.electron.json"]);

const compiler = spawn(bunBin, [tscScript, "-p", "tsconfig.electron.json", "--watch", "--preserveWatchOutput"], {
  cwd: editorRoot,
  stdio: ["inherit", "pipe", "pipe"]
});
forwardOutput(compiler);
const compilerReady = waitForCompilerReady(compiler);
const vite = spawn(bunBin, [viteScript, "--host", "127.0.0.1", "--port", "5174", "--strictPort"], {
  cwd: editorRoot,
  stdio: "inherit"
});

await Promise.all([compilerReady, waitForPort(5174, "127.0.0.1")]);

let electron = null;
let restartTimer = null;
let isRestarting = false;
let isShuttingDown = false;

function stopChildren(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  compiler.kill();
  vite.kill();
  electron?.kill();
  process.exit(exitCode);
}

function launchElectron() {
  const child = spawn(electronBin, ["."], {
    cwd: editorRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl
    }
  });
  electron = child;
  child.on("exit", (code) => {
    if (electron !== child) {
      return;
    }
    electron = null;
    if (isShuttingDown) {
      return;
    }
    if (isRestarting) {
      isRestarting = false;
      launchElectron();
      return;
    }
    stopChildren(code ?? 0);
  });
}

function restartElectron() {
  if (isShuttingDown) {
    return;
  }
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!electron) {
      launchElectron();
      return;
    }
    isRestarting = true;
    electron.kill();
  }, 200);
}

launchElectron();
const electronOutputWatcher = watch(path.join(editorRoot, "dist-electron"), { recursive: true }, restartElectron);

function shutdown() {
  electronOutputWatcher.close();
  stopChildren(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

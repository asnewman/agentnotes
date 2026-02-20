import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronBin = path.join(
  projectDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron',
);

let electronProcess = null;
let isBuilding = false;
let buildQueued = false;
let isShuttingDown = false;
let debounceTimer = null;

function normalizePath(inputPath) {
  return inputPath.replace(/\\/g, '/');
}

function isIgnoredPath(inputPath) {
  const absolutePath = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(projectDir, inputPath);
  const relative = normalizePath(path.relative(projectDir, absolutePath));

  return (
    relative === 'src/bundle.js' ||
    relative.endsWith('.log') ||
    relative.startsWith('dist/') ||
    relative.startsWith('node_modules/') ||
    relative.includes('/dist/') ||
    relative.includes('/node_modules/')
  );
}

function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });

    child.on('exit', (code) => {
      resolve(code === 0);
    });
  });
}

async function buildElectronApp() {
  console.log('[dev] rebuilding electron app...');
  const success = await runCommand(npmCmd, ['run', 'build'], projectDir);
  if (!success) {
    console.error('[dev] build failed');
    return false;
  }

  console.log('[dev] build complete');
  return true;
}

function startElectron() {
  console.log('[dev] starting electron app...');
  electronProcess = spawn(electronBin, ['.'], { cwd: projectDir, stdio: 'inherit' });

  electronProcess.on('exit', (code, signal) => {
    if (!isShuttingDown && code !== 0 && signal !== 'SIGTERM') {
      console.log(`[dev] electron exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    }
    electronProcess = null;
  });
}

function restartElectron() {
  if (!electronProcess) {
    startElectron();
    return;
  }

  const processToStop = electronProcess;
  processToStop.once('exit', () => {
    if (!isShuttingDown) {
      startElectron();
    }
  });
  processToStop.kill('SIGTERM');
}

async function buildAndRestart() {
  if (isBuilding) {
    buildQueued = true;
    return;
  }

  isBuilding = true;
  const success = await buildElectronApp();
  isBuilding = false;

  if (success) {
    restartElectron();
  }

  if (buildQueued) {
    buildQueued = false;
    await buildAndRestart();
  }
}

function scheduleBuild() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    void buildAndRestart();
  }, 150);
}

function setupSignalHandlers(watcher) {
  const shutdown = () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    void watcher.close();

    if (electronProcess) {
      electronProcess.kill('SIGTERM');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function main() {
  const watcher = fs.watch(
    projectDir,
    { recursive: true },
    (_eventType, fileName) => {
      if (!fileName) {
        return;
      }

      const normalizedName = normalizePath(String(fileName));
      if (isIgnoredPath(path.join(projectDir, normalizedName))) {
        return;
      }

      console.log(`[dev] change: ${normalizedName}`);
      scheduleBuild();
    },
  );

  setupSignalHandlers(watcher);

  await buildAndRestart();
}

void main();

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const isWindows = process.platform === "win32";

const pythonCandidates = [
  join(repoRoot, ".venv", isWindows ? "Scripts" : "bin", isWindows ? "python.exe" : "python"),
  join(repoRoot, "python-services", ".venv", isWindows ? "Scripts" : "bin", isWindows ? "python.exe" : "python"),
];

const pythonExecutable = pythonCandidates.find((candidate) => existsSync(candidate));

if (!pythonExecutable) {
  console.error(
    "Timeline backend could not find a project virtualenv interpreter. Expected one of:\n" +
      pythonCandidates.map((candidate) => `- ${candidate}`).join("\n"),
  );
  console.error(
    "Create the virtualenv and install python-services/timeline_swarm/requirements.txt before running this script.",
  );
  process.exit(1);
}

const args = [
  "-m",
  "uvicorn",
  "timeline_swarm.app.main:app",
  "--host",
  "127.0.0.1",
  "--port",
  "8001",
  "--app-dir",
  "python-services",
];

const child = spawn(pythonExecutable, args, {
  stdio: "inherit",
  cwd: repoRoot,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to start timeline backend:", error);
  process.exit(1);
});
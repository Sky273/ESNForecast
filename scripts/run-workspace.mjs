import { spawn } from "node:child_process";
import path from "node:path";

const npmCliPath = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

function run(workspace, script) {
  const child = spawn(process.execPath, [npmCliPath, "--workspace", workspace, "run", script], {
    stdio: "inherit",
    shell: false,
    env: process.env
  });
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const args = process.argv.slice(2);
if (args[0] === "--parallel") {
  const tasks = args.slice(1).map(parseTask);
  const codes = await Promise.all(tasks.map(([workspace, script]) => run(workspace, script)));
  process.exit(codes.find((code) => code !== 0) ?? 0);
}

if (args[0] === "--serial") {
  for (const task of args.slice(1)) {
    const [workspace, script] = parseTask(task);
    const code = await run(workspace, script);
    if (code !== 0) process.exit(code);
  }
  process.exit(0);
}

const [workspace, script] = args;
if (!workspace || !script) {
  console.error("Usage: node scripts/run-workspace.mjs <workspace> <script>");
  console.error("   or: node scripts/run-workspace.mjs --parallel apps/api:dev apps/web:dev");
  process.exit(1);
}

process.exit(await run(workspace, script));

function parseTask(task) {
  const separator = task.indexOf(":");
  if (separator === -1) return [task, ""];
  return [task.slice(0, separator), task.slice(separator + 1)];
}

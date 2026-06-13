/**
 * Dev launcher — runs the API and web dev servers together with no extra
 * dependencies. Replaces `concurrently` (which pulls a vulnerable shell-quote).
 */
import { spawn } from "node:child_process";

const targets = [
  { name: "api", color: "\x1b[34m" }, // blue
  { name: "web", color: "\x1b[35m" }, // magenta
];
const reset = "\x1b[0m";

const children = targets.map(({ name, color }) => {
  const child = spawn("npm", ["run", `dev:${name}`], { shell: true });
  const tag = `${color}[${name}]${reset} `;
  const pipe = (stream, out) => {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      for (const line of chunk.replace(/\n$/, "").split("\n")) out.write(`${tag}${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    shutdown();
    process.exit(code ?? 0);
  });
  return child;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) c.kill();
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", shutdown);

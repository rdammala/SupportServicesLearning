import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCommand(command) {
  const { spawn } = await import("child_process");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, command)], { stdio: "inherit", shell: false });
    child.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${command}`));
      }
    });
  });
}

async function post(url) {
  await fetch(url, { method: "POST" });
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("Step 1: baseline simulation");
  await runCommand("simulateTraffic.js");

  // eslint-disable-next-line no-console
  console.log("Step 2: trigger incident");
  await post("http://localhost:3001/admin/incident/start");
  await runCommand("simulateTraffic.js");

  // eslint-disable-next-line no-console
  console.log("Step 3: recover");
  await post("http://localhost:3001/admin/incident/stop");
  await runCommand("recover.js");
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err.message);
  process.exit(1);
});

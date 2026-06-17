import path from "path";
import net from "net";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runNodeScript(scriptName, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      stdio: "inherit",
      env: { ...process.env, ...env }
    });
    child.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scriptName} failed with code ${code}`));
      }
    });
  });
}

async function postIncident(baseUrl, action) {
  await fetch(`${baseUrl}/admin/incident/${action}`, { method: "POST" });
}

async function waitForHealth(baseUrl, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until healthy
    }
    await wait(250);
  }
  throw new Error("Server did not become healthy in time.");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to allocate a free port."));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function main() {
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const demoEnv = { BASE_URL: baseUrl };

  const server = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) }
  });

  try {
    await waitForHealth(baseUrl);

    // eslint-disable-next-line no-console
    console.log("Step 1: baseline simulation");
    await runNodeScript("simulateTraffic.js", demoEnv);

    // eslint-disable-next-line no-console
    console.log("Step 2: trigger incident");
    await postIncident(baseUrl, "start");
    await runNodeScript("simulateTraffic.js", demoEnv);

    // eslint-disable-next-line no-console
    console.log("Step 3: recover");
    await postIncident(baseUrl, "stop");
    await runNodeScript("recover.js", demoEnv);
  } finally {
    server.kill();
  }
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err.message);
  process.exit(1);
});

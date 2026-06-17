const checks = [
  { name: "Image pull", ok: true },
  { name: "Readiness probe", ok: true },
  { name: "CPU budget", ok: true },
  { name: "Error budget gate", ok: true }
];

// eslint-disable-next-line no-console
console.log("Starting rollout simulation...");

for (const check of checks) {
  await new Promise(resolve => setTimeout(resolve, 400));
  // eslint-disable-next-line no-console
  console.log(`${check.ok ? "PASS" : "FAIL"} - ${check.name}`);
}

const allPassed = checks.every(c => c.ok);
// eslint-disable-next-line no-console
console.log(allPassed ? "Rollout simulation succeeded." : "Rollout blocked.");
if (!allPassed) {
  process.exit(1);
}

const action = process.argv[2];
const baseUrl = process.env.BASE_URL || "http://localhost:3001";

if (!["start", "stop"].includes(action)) {
  // eslint-disable-next-line no-console
  console.error("Usage: node src/incidentControl.js <start|stop>");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/admin/incident/${action}`, { method: "POST" });
const body = await response.json();
// eslint-disable-next-line no-console
console.log(body);

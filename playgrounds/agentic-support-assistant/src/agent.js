import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const kb = JSON.parse(fs.readFileSync(path.join(__dirname, "kb.json"), "utf8"));
const tickets = JSON.parse(fs.readFileSync(path.join(__dirname, "tickets.json"), "utf8"));

function searchKb(query) {
  const q = query.toLowerCase();
  return kb.filter(item => item.title.toLowerCase().includes(q) || item.keywords.some(k => q.includes(k)));
}

function lookupTicket(ticketId) {
  return tickets.find(t => t.ticketId.toLowerCase() === ticketId.toLowerCase());
}

function respond(input) {
  const kbMatches = searchKb(input);
  const ticketMatch = input.match(/inc-\d+/i);
  const ticket = ticketMatch ? lookupTicket(ticketMatch[0]) : null;

  const lines = [];
  lines.push("Assistant Plan:");

  if (ticket) {
    lines.push(`- Ticket ${ticket.ticketId} (${ticket.severity}): ${ticket.summary}`);
    lines.push(`- Last action: ${ticket.lastAction}`);
  }

  if (kbMatches.length > 0) {
    lines.push("- Relevant KB:");
    kbMatches.slice(0, 2).forEach(item => {
      lines.push(`  - ${item.id}: ${item.title}`);
      lines.push(`    Resolution: ${item.resolution}`);
    });
  } else {
    lines.push("- No direct KB hit. Collect repro steps and dependency traces.");
  }

  lines.push("- Next step: draft customer update and set follow-up in 30 minutes.");
  return lines.join("\n");
}

if (process.argv.includes("--demo")) {
  const prompts = [
    "INC-9001 customer says controller sync still fails",
    "purchase missing in library for INC-9002",
    "chat timeout issue"
  ];

  prompts.forEach((p, i) => {
    // eslint-disable-next-line no-console
    console.log(`\nPrompt ${i + 1}: ${p}`);
    // eslint-disable-next-line no-console
    console.log(respond(p));
  });

  process.exit(0);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// eslint-disable-next-line no-console
console.log("Agentic Support Assistant (type 'exit' to quit)");

function ask() {
  rl.question("> ", answer => {
    if (answer.trim().toLowerCase() === "exit") {
      rl.close();
      return;
    }
    // eslint-disable-next-line no-console
    console.log(respond(answer));
    ask();
  });
}

ask();

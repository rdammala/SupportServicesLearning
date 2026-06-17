import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestDir = path.join(__dirname, "..", "manifests");

function load(fileName) {
  const full = path.join(manifestDir, fileName);
  return yaml.load(fs.readFileSync(full, "utf8"));
}

const deployment = load("deployment.yaml");
const service = load("service.yaml");
const hpa = load("hpa.yaml");

const errors = [];

if (service.spec.selector.app !== deployment.spec.selector.matchLabels.app) {
  errors.push("Service selector app does not match deployment label.");
}

const container = deployment.spec.template.spec.containers[0];
if (service.spec.ports[0].targetPort !== container.ports[0].containerPort) {
  errors.push("Service targetPort does not match containerPort.");
}

if (hpa.spec.scaleTargetRef.name !== deployment.metadata.name) {
  errors.push("HPA target deployment name mismatch.");
}

if (errors.length > 0) {
  // eslint-disable-next-line no-console
  console.error("Validation failed:");
  errors.forEach(e => {
    // eslint-disable-next-line no-console
    console.error(`- ${e}`);
  });
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("Manifest validation passed.");

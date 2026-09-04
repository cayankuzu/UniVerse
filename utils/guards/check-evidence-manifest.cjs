const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, "quality", "evidence-manifest.schema.json");
const MANIFEST_PATH = path.join(ROOT, "artifacts", "docker", "evidence-manifest.json");

function fail(message) {
  console.error(`[evidence-manifest] FAIL: ${message}`);
  process.exit(1);
}

/**
 * Minimal validator for the subset of JSON Schema the manifest schema uses. A dependency is not
 * worth adding for one internal document, and hand-rolling the checks keeps the failure messages
 * pointed at the actual field.
 */
function validate(value, schema, pointer, errors) {
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(
      `${pointer} must equal ${JSON.stringify(schema.const)} (got ${JSON.stringify(value)})`,
    );
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${pointer} must be one of ${schema.enum.join(", ")}`);
    return;
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual =
      value === null
        ? "null"
        : Array.isArray(value)
          ? "array"
          : typeof value === "number"
            ? Number.isInteger(value)
              ? "integer"
              : "number"
            : typeof value;
    const matches = types.some(
      (type) => type === actual || (type === "number" && actual === "integer"),
    );
    if (!matches) {
      errors.push(`${pointer} must be ${types.join(" or ")} (got ${actual})`);
      return;
    }
  }

  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${pointer} must match ${schema.pattern}`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${pointer} must be at least ${schema.minLength} characters`);
    }
  }

  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${pointer} must be >= ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${pointer} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, index) => validate(item, schema.items, `${pointer}[${index}]`, errors));
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${pointer}.${key} is required`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!schema.properties || !(key in schema.properties)) {
          errors.push(`${pointer}.${key} is not an allowed property`);
        }
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      if (key in value) validate(value[key], childSchema, `${pointer}.${key}`, errors);
    }
  }
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

if (!fs.existsSync(MANIFEST_PATH)) {
  // The manifest is a generated artifact, not a committed file. Absent means "not produced for
  // this checkout yet", which the release gate reports separately; it is not a schema failure.
  console.log(
    "[evidence-manifest] OK: schema is valid; no artifacts/docker/evidence-manifest.json in this " +
      "checkout, so there is nothing to validate. Run npm run docker:evidence to produce one.",
  );
  process.exit(0);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
} catch (error) {
  fail(`artifacts/docker/evidence-manifest.json is not valid JSON: ${error.message}`);
}

const errors = [];
validate(manifest, schema, "manifest", errors);
if (errors.length > 0) {
  fail(`Evidence manifest does not match the schema:\n- ${errors.join("\n- ")}`);
}

// A manifest that lists checksums nobody re-checks is decoration, so verify them.
const mismatched = [];
for (const artifact of manifest.artifacts) {
  const artifactPath = path.join(path.dirname(MANIFEST_PATH), artifact.file);
  if (!fs.existsSync(artifactPath)) {
    mismatched.push(`${artifact.file} is listed but missing from the evidence directory`);
    continue;
  }
  const contents = fs.readFileSync(artifactPath);
  const digest = crypto.createHash("sha256").update(contents).digest("hex");
  if (digest !== artifact.sha256) {
    mismatched.push(
      `${artifact.file} checksum is ${digest.slice(0, 12)}, manifest says ${artifact.sha256.slice(0, 12)}`,
    );
  } else if (contents.byteLength !== artifact.bytes) {
    mismatched.push(
      `${artifact.file} is ${contents.byteLength} bytes, manifest says ${artifact.bytes}`,
    );
  }
}

if (mismatched.length > 0) {
  fail(`Evidence artifacts do not match the manifest:\n- ${mismatched.join("\n- ")}`);
}

console.log(
  `[evidence-manifest] OK: ${manifest.artifacts.length} artifacts match their checksums and are ` +
    `bound to ${manifest.git.sha.slice(0, 12)} on a clean tree.`,
);

// Integrity is not freshness. Say so plainly rather than letting an older bundle be read as
// evidence for the current candidate.
const headCommit = require("child_process")
  .execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" })
  .trim();
if (manifest.git.sha !== headCommit) {
  console.log(
    `[evidence-manifest] NOTE: this bundle covers ${manifest.git.sha.slice(0, 12)}, not HEAD ` +
      `${headCommit.slice(0, 12)}. Re-run npm run docker:test and npm run docker:evidence before ` +
      "citing it for the current candidate.",
  );
}

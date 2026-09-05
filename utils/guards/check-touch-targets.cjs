#!/usr/bin/env node
/* eslint-disable no-console */

// Fitts's law in product terms: Android asks for a 48dp effective target and iOS
// for ~44pt. A control may *render* smaller than that — density is a deliberate
// choice here — but it must then buy the missing area back with hitSlop, and it
// must tell assistive tech what it is. This guard reads the JSX rather than the
// rendered tree, so it only judges targets whose size is written down literally.

const fs = require("node:fs");
const path = require("node:path");
const parser = require("@typescript-eslint/parser");

const ROOT = process.cwd();
const MOBILE_ROOT = path.join(ROOT, "src", "mobile", "app");
const MIN_EFFECTIVE_TARGET = 44;
const PRESSABLE_NAMES = new Set([
  "InstantPressable",
  "Pressable",
  "TouchableHighlight",
  "TouchableOpacity",
  "TouchableWithoutFeedback",
]);
const SIZE_KEYS = new Set(["height", "minHeight", "minWidth", "width"]);
// InstantPressable forwards every accessibility prop it is handed, so the base
// component itself is not the place a role can be missing.
const ROLE_EXEMPT_FILES = new Set([path.join("shared", "components", "InstantPressable.tsx")]);

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value.type === "string") walk(value, visit);
  }
}

function attributeByName(attributes, name) {
  return attributes.find(
    (attribute) => attribute.type === "JSXAttribute" && attribute.name?.name === name,
  );
}

// Only the style object's own keys describe the target. Nested values such as
// `shadowOffset: { height: 6 }` or `transform: [{ scale }]` are not sizes.
function styleObjects(node, collected = []) {
  if (!node || typeof node !== "object") return collected;
  switch (node.type) {
    case "JSXAttribute":
    case "JSXExpressionContainer":
      return styleObjects(node.value ?? node.expression, collected);
    case "ObjectExpression":
      collected.push(node);
      return collected;
    case "ArrayExpression":
      node.elements.forEach((element) => styleObjects(element, collected));
      return collected;
    case "ConditionalExpression":
      styleObjects(node.consequent, collected);
      styleObjects(node.alternate, collected);
      return collected;
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return styleObjects(node.body, collected);
    case "BlockStatement": {
      const returned = node.body.find((statement) => statement.type === "ReturnStatement");
      return styleObjects(returned?.argument, collected);
    }
    case "LogicalExpression":
      return styleObjects(node.right, collected);
    default:
      return collected;
  }
}

function declaredSizes(styleAttribute) {
  const sizes = [];
  for (const object of styleObjects(styleAttribute)) {
    for (const property of object.properties) {
      if (property.type !== "Property" || property.key?.type !== "Identifier") continue;
      if (!SIZE_KEYS.has(property.key.name)) continue;
      if (property.value?.type === "Literal" && typeof property.value.value === "number") {
        sizes.push(property.value.value);
      }
    }
  }
  return sizes;
}

function run() {
  const failures = [];

  for (const file of collectFiles(MOBILE_ROOT)) {
    const relative = path.relative(MOBILE_ROOT, file);
    const source = fs.readFileSync(file, "utf8");
    let ast;
    try {
      ast = parser.parse(source, { jsx: true, loc: true, sourceType: "module" });
    } catch (error) {
      failures.push(`${relative}: could not be parsed (${error.message}).`);
      continue;
    }

    walk(ast, (node) => {
      if (node.type !== "JSXOpeningElement" || node.name?.type !== "JSXIdentifier") return;
      if (!PRESSABLE_NAMES.has(node.name.name)) return;

      const attributes = node.attributes.filter((attribute) => attribute.type === "JSXAttribute");
      const names = attributes.map((attribute) => attribute.name?.name);
      const location = `${relative.split(path.sep).join("/")}:${node.loc.start.line}`;
      const hidden =
        names.includes("accessibilityElementsHidden") ||
        names.includes("importantForAccessibility") ||
        attributes.some(
          (attribute) =>
            attribute.name?.name === "accessible" && attribute.value?.expression?.value === false,
        );

      if (!hidden && !names.includes("accessibilityRole") && !ROLE_EXEMPT_FILES.has(relative)) {
        failures.push(`${location} ${node.name.name} has no accessibilityRole.`);
      }

      const styleAttribute = attributeByName(attributes, "style");
      if (!styleAttribute) return;
      const undersized = declaredSizes(styleAttribute).filter(
        (value) => value > 0 && value < MIN_EFFECTIVE_TARGET,
      );
      if (undersized.length > 0 && !names.includes("hitSlop")) {
        failures.push(
          `${location} ${node.name.name} renders at ${Math.min(...undersized)}dp ` +
            `without hitSlop (needs ${MIN_EFFECTIVE_TARGET}dp effective).`,
        );
      }
    });
  }

  if (failures.length > 0) {
    console.error("[touch-targets] FAIL:");
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("[touch-targets] OK: every sized pressable has a role and a 44dp effective target.");
}

run();

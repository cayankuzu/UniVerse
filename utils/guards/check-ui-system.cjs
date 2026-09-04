const fs = require("node:fs");
const path = require("node:path");
const parser = require("@typescript-eslint/parser");

const ROOT = process.cwd();
const MOBILE_ROOT = path.join(ROOT, "src", "mobile", "app");
const PRODUCTION_TSX = /\.tsx$/;
const PRODUCTION_TS_OR_TSX = /\.tsx?$/;
const TEST_FILE = /\.(?:smoke\.)?test\.tsx?$/;

const sourceViolations = [
  {
    label: "raw React Native Text import instead of AppText",
    pattern: /import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*["']react-native(?:-paper)?["']/,
  },
  {
    label: "raw hex color",
    pattern: /["']#[0-9a-f]{3,8}["']/i,
  },
  {
    label: "raw rgba color",
    pattern: /["']rgba\s*\(/i,
  },
  {
    label: "raw standard font size",
    pattern: /fontSize:\s*(?:8|9|10|11|12|13|14|15|16|17|18|20|22|24|28|30|32)\b(?!\.)/,
  },
  {
    label: "raw standard spacing",
    pattern:
      /(?:padding|paddingHorizontal|paddingVertical|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginHorizontal|marginVertical|marginTop|marginBottom|marginLeft|marginRight|gap|rowGap|columnGap):\s*(?:1|2|3|4|5|6|7|8|9|10|11|12|14|16|18|20|22|24|28|32)\b(?!\.)/,
  },
  {
    label: "raw standard line height",
    pattern: /lineHeight:\s*(?:12|13|14|15|16|17|18|19|20|21|24|28)\b(?!\.)/,
  },
  {
    label: "raw standard letter spacing",
    pattern: /letterSpacing:\s*(?:-0\.5|-0\.2|0(?:\.1|\.2|\.4|\.6)?)\b/,
  },
];

const turkishCopyPatterns = [
  /\b(?:Yukleme|Yukleniyor|Gonderi|Fotograf|Katildin|Okunmamis|Erisim|Aciklama|Sikayet|Islem)\b/i,
  /\b(?:profilini ac|Lutfen tekrar|Etkinligi Sil|Paylasiliyor)\b/i,
  /\b(?:Vazgec|sirasinda|olustu|oncesi|onizleme)\b/i,
  /\b(?:On Izleme|sira aliniyor)\b/i,
  /\bIptal Et\b/,
];

function walk(directory, matcher, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matcher, files);
    } else if (entry.isFile() && matcher.test(entry.name) && !TEST_FILE.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function walkAst(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent" || key === "tokens" || key === "comments") continue;
    if (Array.isArray(value)) {
      value.forEach((child) => walkAst(child, visit));
    } else if (value && typeof value.type === "string") {
      walkAst(value, visit);
    }
  }
}

function hasAccessibleFalse(attributes) {
  return attributes.some(
    (attribute) =>
      attribute.type === "JSXAttribute" &&
      attribute.name.name === "accessible" &&
      attribute.value?.type === "JSXExpressionContainer" &&
      attribute.value.expression?.value === false,
  );
}

function requireText(relativePath, pattern, message, failures) {
  if (!pattern.test(read(relativePath))) failures.push(message);
}

const failures = [];
for (const filePath of walk(MOBILE_ROOT, PRODUCTION_TSX)) {
  const source = fs.readFileSync(filePath, "utf8");
  for (const rule of sourceViolations) {
    if (filePath.endsWith(`${path.sep}AppText.tsx`) && rule.label.includes("Text import")) continue;
    if (rule.pattern.test(source)) {
      failures.push(`${path.relative(ROOT, filePath)} contains a ${rule.label}.`);
    }
  }
  if (!filePath.endsWith(`${path.sep}InstantPressable.tsx`)) {
    const ast = parser.parse(source, { jsx: true, loc: true, sourceType: "module" });
    walkAst(ast, (node) => {
      if (
        node.type !== "JSXOpeningElement" ||
        node.name?.type !== "JSXIdentifier" ||
        !["Pressable", "TouchableOpacity"].includes(node.name.name)
      ) {
        return;
      }
      const attributes = node.attributes.filter((attribute) => attribute.type === "JSXAttribute");
      const names = attributes.map((attribute) => attribute.name.name);
      const hidden =
        hasAccessibleFalse(attributes) ||
        names.includes("accessibilityElementsHidden") ||
        names.includes("importantForAccessibility");
      if (
        !hidden &&
        !names.includes("accessibilityLabel") &&
        !names.includes("accessibilityLabelledBy")
      ) {
        failures.push(
          `${path.relative(ROOT, filePath)}:${node.loc.start.line} contains an unlabeled ${node.name.name}.`,
        );
      }
    });
  }
}

for (const filePath of walk(MOBILE_ROOT, PRODUCTION_TS_OR_TSX)) {
  const themeRoot = `${path.sep}shared${path.sep}theme${path.sep}`;
  if (!filePath.includes(themeRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    if (/["']#[0-9a-f]{3,8}["']/i.test(source) || /["']rgba\s*\(/i.test(source)) {
      failures.push(`${path.relative(ROOT, filePath)} contains a raw UI color outside the theme.`);
    }
  }
  if (
    filePath.endsWith(`${path.sep}data${path.sep}queues${path.sep}uploadQueue.ts`) ||
    filePath.endsWith(`${path.sep}data${path.sep}queues${path.sep}queueErrorPolicy.ts`)
  ) {
    continue;
  }
  const source = fs.readFileSync(filePath, "utf8");
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (line.includes(".includes(")) continue;
    if (turkishCopyPatterns.some((pattern) => pattern.test(line))) {
      failures.push(
        `${path.relative(ROOT, filePath)}:${index + 1} contains unaccented Turkish UI copy.`,
      );
    }
  }
}

requireText(
  "src/mobile/app/App.tsx",
  /<AppFontGate>/,
  "The app root must retain the shared Inter font loader.",
  failures,
);
requireText(
  "src/mobile/app/shared/components/AppFontGate.tsx",
  /useFonts\(APP_FONTS\);[\s\S]*return children;/,
  "Font loading must keep the first frame non-blocking while Inter loads.",
  failures,
);
requireText(
  "src/mobile/app/shared/theme/tokens.ts",
  /fontFamily:[\s\S]*Inter_400Regular[\s\S]*Inter_700Bold/,
  "Typography tokens must retain the shared Inter family mapping.",
  failures,
);

requireText(
  "src/mobile/app/shared/theme/tokens.ts",
  /touchTarget:\s*48/,
  "The shared minimum touch target must remain 48dp.",
  failures,
);
requireText(
  "src/mobile/app/shared/components/InstantPressable.tsx",
  /triggerHapticFeedback/,
  "InstantPressable must retain optional haptic feedback.",
  failures,
);
requireText(
  "src/mobile/app/features/home/ui/HomeFeedList.tsx",
  /AppFlatList[\s\S]*getItemType=/,
  "The home feed must retain typed FlashList recycling.",
  failures,
);
requireText(
  "src/mobile/app/shared/components/AppImage.tsx",
  /cachePolicy=\{cachePolicy\}/,
  "Images must retain the native memory/disk cache policy.",
  failures,
);
requireText(
  "src/mobile/app/shared/media/MediaVideo.tsx",
  /useCaching:\s*Boolean\(cacheEnabled/,
  "Video playback must retain bounded native caching.",
  failures,
);
requireText(
  "src/mobile/app/shared/media/MediaVideo.tsx",
  /AppState\.addEventListener[\s\S]*setAppActive/,
  "Video playback must pause and detach when the app is inactive.",
  failures,
);
requireText(
  "src/mobile/app/data/projections/prefetch/useViewportPrefetch.ts",
  /cancelQueries/,
  "Obsolete viewport prefetch queries must remain cancellable.",
  failures,
);
requireText(
  "src/mobile/app/shared/components/AppModalHost.tsx",
  /useReducedMotion\(\)[\s\S]*animationType=\{reducedMotion\s*\?\s*"none"/,
  "Shared modal transitions must honor the operating system reduced-motion preference.",
  failures,
);
requireText(
  "src/mobile/app/shared/components/AppFlatList.tsx",
  /onRetry\?:[\s\S]*onRetry:\s*onRetry\s*\?\?\s*\(onRefresh/,
  "List error states must expose a retry path when refresh is available.",
  failures,
);

// The raw-font-size rule above pushes every screen through the token scale,
// but nothing checked the scale itself: five tiers once sat between 8px and
// 10px and shipped to ~300 call sites. 11 is the floor both platforms treat as
// the smallest legible size.
const MIN_FONT_SIZE = 11;
const tokensSource = fs.readFileSync(
  path.join(MOBILE_ROOT, "shared", "theme", "tokens.ts"),
  "utf8",
);
const typographyBlock = tokensSource.match(/typography:\s*\{([\s\S]*?)\n  \},/);
if (!typographyBlock) {
  failures.push("Could not read the typography scale out of tokens.ts.");
} else {
  for (const [, name, size] of typographyBlock[1].matchAll(/^\s*(\w+):\s*(\d+),/gm)) {
    if (Number(size) < MIN_FONT_SIZE) {
      failures.push(
        `typography.${name} is ${size}px, below the ${MIN_FONT_SIZE}px legibility floor.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(`[ui-system] FAIL: ${failures.length} violation(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "[ui-system] OK: semantic styles, touch targets, typed lists, and media feedback contracts are intact.",
);

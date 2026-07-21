const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const MOBILE_ROOT = path.join(ROOT, "src", "mobile", "app");
const PRODUCTION_TSX = /\.tsx$/;
const TEST_FILE = /\.(?:smoke\.)?test\.tsx$/;

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
  /\b(?:profilini ac|Lutfen tekrar|Iptal Et|Etkinligi Sil|Paylasiliyor)\b/i,
];

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && PRODUCTION_TSX.test(entry.name) && !TEST_FILE.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function requireText(relativePath, pattern, message, failures) {
  if (!pattern.test(read(relativePath))) failures.push(message);
}

const failures = [];
for (const filePath of walk(MOBILE_ROOT)) {
  const source = fs.readFileSync(filePath, "utf8");
  for (const rule of sourceViolations) {
    if (filePath.endsWith(`${path.sep}AppText.tsx`) && rule.label.includes("Text import")) continue;
    if (rule.pattern.test(source)) {
      failures.push(`${path.relative(ROOT, filePath)} contains a ${rule.label}.`);
    }
  }
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
  "The app root must wait for the shared Inter font gate.",
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
  /getCachePathAsync/,
  "Images must verify cache hits before suppressing their transition.",
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

if (failures.length > 0) {
  console.error(`[ui-system] FAIL: ${failures.length} violation(s).`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "[ui-system] OK: semantic styles, touch targets, typed lists, and media feedback contracts are intact.",
);

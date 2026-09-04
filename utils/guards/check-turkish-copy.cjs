const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const SCAN_ROOTS = [path.join("src", "mobile", "app")];
const SOURCE_EXTENSION = /\.tsx?$/;
const TEST_FILE = /\.(test|spec)\./;
const SKIPPED_DIRECTORIES = new Set([".git", "artifacts", "coverage", "node_modules"]);

/**
 * Attributes whose value is rendered to the user. Restricting the scan to these keeps deliberate
 * ASCII-folded backend error matchers (`message.includes("fotograf boyutu cok buyuk")`) out of
 * scope while still covering every string a person actually reads.
 */
const DISPLAY_ATTRIBUTES = [
  "accessibilityHint",
  "accessibilityLabel",
  "description",
  "helperText",
  "hint",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "text",
  "title",
];

/**
 * ASCII-folded spellings whose correct Turkish form requires a diacritic. Words that are already
 * correct without one (temizle, kaydet, yenile, uygun, gizli) are deliberately absent.
 */
const REQUIRES_DIACRITIC = new Set([
  "aciklama",
  "acik",
  "adin",
  "adiniz",
  "album",
  "asagi",
  "baglanti",
  "baslik",
  "basarili",
  "basarisiz",
  "begeni",
  "bulunamadi",
  "buyuk",
  "cikis",
  "cok",
  "degistir",
  "duzenle",
  "fotograf",
  "gecersiz",
  "gonder",
  "gonderi",
  "goruntu",
  "goster",
  "guncelle",
  "guvenlik",
  "kapali",
  "kucuk",
  "kulup",
  "kullanici",
  "ogrenci",
  "olustur",
  "sifre",
  "sifreni",
  "sifreniz",
  "soyadin",
  "soyadiniz",
  "takipci",
  "universite",
  "yukari",
  "yukle",
  "yukleniyor",
]);

function fail(message) {
  console.error(`[turkish-copy] FAIL: ${message}`);
  process.exit(1);
}

function collectSourceFiles(directory, collected = []) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries) {
    if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, collected);
    } else if (SOURCE_EXTENSION.test(entry.name) && !TEST_FILE.test(entry.name)) {
      collected.push(fullPath);
    }
  }
  return collected;
}

const DISPLAY_STRING = new RegExp(
  `\\b(${DISPLAY_ATTRIBUTES.join("|")})\\s*=\\s*"([^"]{2,200})"`,
  "g",
);

const files = SCAN_ROOTS.flatMap((root) => collectSourceFiles(path.join(ROOT, root)));
if (files.length === 0) {
  fail("No source files were scanned; the guard would pass vacuously.");
}

const findings = [];
for (const file of files) {
  const relativePath = path.relative(ROOT, file).replaceAll("\\", "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(DISPLAY_STRING)) {
      const [, attribute, value] = match;
      // Example emails, usernames, and hosts are deliberately ASCII; they are identifiers, not prose.
      if (/[@_]|\/\/|\.[a-z]{2,}(\s|$)/i.test(value)) continue;
      for (const word of value.split(/[^A-Za-zÇĞİÖŞÜçğıöşü]+/)) {
        if (!word || /[ÇĞİÖŞÜçğıöşü]/.test(word)) continue;
        if (!REQUIRES_DIACRITIC.has(word.toLowerCase())) continue;
        findings.push(`${relativePath}:${index + 1} ${attribute}="${value}" (word: ${word})`);
        break;
      }
    }
  });
}

if (findings.length > 0) {
  fail(
    `Turkish copy is missing its diacritics:\n- ${findings.join("\n- ")}\n` +
      "Fix the spelling; do not ASCII-fold text a person reads.",
  );
}

console.log(
  `[turkish-copy] OK: display copy across ${files.length} modules keeps its Turkish diacritics.`,
);

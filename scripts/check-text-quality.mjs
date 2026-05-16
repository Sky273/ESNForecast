import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["apps/api/src", "apps/web/src", "packages/shared/src", "scripts"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".md"]);
const forbidden = [
  "�",
  "Ã",
  "Â",
  "â€",
  "configuréd",
  "complètedAt",
  "opérational",
  "Renégociér",
  "fréelance",
  "calculér",
  "l?Écart"
];

function extensionOf(file) {
  const index = file.lastIndexOf(".");
  return index === -1 ? "" : file.slice(index);
}

function listFiles(root) {
  const entries = readdirSync(root);
  return entries.flatMap((entry) => {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) return listFiles(path);
    return extensions.has(extensionOf(path)) ? [path] : [];
  });
}

const findings = [];
for (const root of roots) {
  for (const file of listFiles(root)) {
    if (file.endsWith("check-text-quality.mjs")) continue;
    const buffer = readFileSync(file);
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      findings.push(`${file}: contains UTF-8 BOM`);
      continue;
    }
    const content = buffer.toString("utf8");
    for (const pattern of forbidden) {
      if (content.includes(pattern)) findings.push(`${file}: contains ${JSON.stringify(pattern)}`);
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("Text quality check passed.");

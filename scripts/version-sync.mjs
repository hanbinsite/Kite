import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/version-sync.mjs <version>");
  process.exit(1);
}

function replaceVersion(filePath, pattern, replacement) {
  const content = readFileSync(filePath, "utf8");
  const updated = content.replace(pattern, replacement);
  writeFileSync(filePath, updated);
  console.log(`Updated ${filePath}: ${version}`);
}

// Root package.json
replaceVersion(
  resolve(root, "package.json"),
  /"version": "[^"]+"/,
  `"version": "${version}"`,
);

// Tauri config
replaceVersion(
  resolve(root, "apps/desktop/src-tauri/tauri.conf.json"),
  /"version": "[^"]+"/,
  `"version": "${version}"`,
);

// Cargo.toml
replaceVersion(
  resolve(root, "apps/desktop/src-tauri/Cargo.toml"),
  /^version = "[^"]+"/m,
  `version = "${version}"`,
);

// Desktop package.json
replaceVersion(
  resolve(root, "apps/desktop/package.json"),
  /"version": "[^"]+"/,
  `"version": "${version}"`,
);

// Core package.json
replaceVersion(
  resolve(root, "packages/core/package.json"),
  /"version": "[^"]+"/,
  `"version": "${version}"`,
);

// Types package.json
replaceVersion(
  resolve(root, "packages/types/package.json"),
  /"version": "[^"]+"/,
  `"version": "${version}"`,
);

// UI package.json
replaceVersion(
  resolve(root, "packages/ui/package.json"),
  /"version": "[^"]+"/,
  `"version": "${version}"`,
);

console.log(`Version synced to ${version} across all manifests.`);

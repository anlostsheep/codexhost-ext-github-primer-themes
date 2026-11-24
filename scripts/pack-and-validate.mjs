#!/usr/bin/env node
/**
 * Validate the github-primer-themes extension against codexhost manifestVersion: 2 rules,
 * run syntax & runtime smoke tests, and package dist/github-primer-themes-<version>.zip
 * with manifest.json at the ZIP root.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Exact limits from packages/shared-contracts/src/desktop-extensions.ts
const LIMITS = {
  manifest: 128 * 1024,
  script: 2 * 1024 * 1024,
  style: 256 * 1024,
  icon: 128 * 1024,
  screenshot: 512 * 1024,
  screenshotsTotal: 2 * 1024 * 1024,
  zip: 64 * 1024 * 1024,
};

const VALID_CATEGORIES = new Set([
  "appearance",
  "interface",
  "workflow",
  "analytics",
  "integrations",
  "tools",
]);
const VALID_SLOTS = new Set([
  "sidebar.thread-layout",
  "sidebar.thread-badge",
  "appearance.theme",
]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FORBIDDEN_PATTERNS = [
  ["eval()", /\beval\s*\(/u],
  ["new Function", /\bnew\s+Function\b/u],
  ["child_process", /\bchild_process\b/u],
];

const PACKAGE_FILES = [
  "manifest.json",
  "shared/primer-themes.mjs",
  "page/index.mjs",
  "page/style.css",
  "widget/index.mjs",
  "widget/style.css",
  "desktop/index.js",
  "desktop/style.css",
  "web/index.mjs",
  "web/style.css",
  "assets/icon.png",
  "assets/preview-dark.png",
  "assets/preview-light.png",
  "assets/preview-widget.png",
];

function checkSize(relPath, maxBytes) {
  const full = path.join(ROOT, relPath);
  const size = statSync(full).size;
  assert.ok(size > 0, `${relPath} must not be empty`);
  assert.ok(size <= maxBytes, `${relPath} (${size} B) exceeds limit (${maxBytes} B)`);
  return size;
}

function checkPng(relPath, maxBytes) {
  const size = checkSize(relPath, maxBytes);
  const buf = readFileSync(path.join(ROOT, relPath));
  assert.ok(buf.subarray(0, 8).equals(PNG_MAGIC), `${relPath} does not have valid PNG signature`);
  return size;
}

function checkSecurity(relPath) {
  const src = readFileSync(path.join(ROOT, relPath), "utf8");
  for (const [label, regex] of FORBIDDEN_PATTERNS) {
    assert.ok(!regex.test(src), `Forbidden pattern ${label} found in ${relPath}`);
  }
}

async function validateManifestAndAssets() {
  checkSize("manifest.json", LIMITS.manifest);
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "manifest.json"), "utf8"));

  assert.equal(manifest.manifestVersion, 2, "manifestVersion must be 2");
  assert.match(
    manifest.id,
    /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u,
    "Invalid manifest id format",
  );
  assert.ok(manifest.name?.en?.trim() && manifest.name?.["zh-CN"]?.trim(), "Bilingual name required");
  assert.ok(
    manifest.description?.en?.trim() && manifest.description?.["zh-CN"]?.trim(),
    "Bilingual description required",
  );
  assert.ok(
    manifest.details?.en?.trim() && manifest.details?.["zh-CN"]?.trim(),
    "Bilingual details required",
  );
  assert.ok(Array.isArray(manifest.categories) && manifest.categories.length > 0);
  for (const cat of manifest.categories) {
    assert.ok(VALID_CATEGORIES.has(cat), `Invalid category: ${cat}`);
  }
  for (const slot of manifest.slots ?? []) {
    assert.ok(VALID_SLOTS.has(slot), `Invalid slot: ${slot}`);
  }

  // Validate settingsSchema keys & defaults
  const seenKeys = new Set();
  for (const field of manifest.settingsSchema ?? []) {
    assert.match(field.key, /^[A-Za-z_][A-Za-z0-9_]*$/u, `Invalid setting key: ${field.key}`);
    assert.ok(!seenKeys.has(field.key), `Duplicate setting key: ${field.key}`);
    seenKeys.add(field.key);
    assert.ok(field.label?.en && field.label?.["zh-CN"], `Bilingual label required for ${field.key}`);
    if (field.type === "select") {
      const vals = new Set(field.options.map((o) => o.value));
      assert.equal(vals.size, field.options.length, `Duplicate options in ${field.key}`);
      if (field.default !== undefined) {
        assert.ok(vals.has(field.default), `Invalid default for ${field.key}`);
      }
    }
  }

  // Check declared entries & sizes
  for (const entryFile of [
    manifest.page?.entry,
    manifest.widget?.entry,
    manifest.desktop?.script,
    manifest.web?.entry,
    "shared/primer-themes.mjs",
  ].filter(Boolean)) {
    checkSize(entryFile, LIMITS.script);
    checkSecurity(entryFile);
  }
  for (const styleFile of [
    manifest.page?.style,
    manifest.widget?.style,
    manifest.desktop?.style,
    manifest.web?.style,
  ].filter(Boolean)) {
    checkSize(styleFile, LIMITS.style);
  }

  // Check images
  if (manifest.icon) checkPng(manifest.icon, LIMITS.icon);
  let totalScreenshots = 0;
  assert.ok((manifest.screenshots ?? []).length <= 4, "At most 4 screenshots allowed");
  for (const shot of manifest.screenshots ?? []) {
    totalScreenshots += checkPng(shot, LIMITS.screenshot);
  }
  assert.ok(totalScreenshots <= LIMITS.screenshotsTotal, "Total screenshot size exceeds 2 MiB");

  return manifest;
}

async function runRuntimeSmokeTests() {
  // 1. Validate desktop/index.js identically to codexhost renderer-desktop-extensions.ts
  const desktopSrc = readFileSync(path.join(ROOT, "desktop/index.js"), "utf8");
  const factory = `(function (define) { "use strict";\n${desktopSrc}\n})`;
  new vm.Script(`({defineScript: ${factory}})`, {
    filename: "codexhost-extension://github-primer-themes/desktop.js",
  });

  // 2. Test desktop/index.js execution with mock Desktop API
  const markedDesktop = new Set();
  const fakeHtml = {
    getAttribute: () => "dark",
    classList: { contains: () => false },
  };
  const prevDoc = globalThis.document;
  globalThis.document = { documentElement: fakeHtml, defaultView: null };
  let capturedDef = null;
  vm.runInThisContext(factory)((def) => {
    capturedDef = def;
  });
  assert.equal(typeof capturedDef?.activate, "function", "desktop/index.js must call define({ activate })");
  const desktopAc = new AbortController();
  let desktopStorageCb = null;
  const desktopDispose = capturedDef.activate({
    signal: desktopAc.signal,
    dom: {
      mark(_el, name) {
        assert.match(name, /^[a-z][a-z0-9-]{0,31}$/u, `Invalid desktop marker: ${name}`);
        markedDesktop.add(name);
      },
      unmark(_el, name) {
        markedDesktop.delete(name);
      },
    },
    storage: {
      async get() {
        return { themeMode: "single", singleTheme: "light_tritanopia", increaseContrast: true };
      },
      onChange(cb) {
        desktopStorageCb = cb;
        return () => {};
      },
    },
    track() {},
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(markedDesktop.has("gh-active"), "Desktop must mark gh-active");
  assert.ok(markedDesktop.has("gh-light-trit-hc"), "Desktop must mark gh-light-trit-hc");
  assert.ok(markedDesktop.has("gh-scheme-light"), "Desktop must mark gh-scheme-light");
  desktopStorageCb({ themeMode: "single", singleTheme: "dark_dimmed", increaseContrast: false });
  assert.ok(markedDesktop.has("gh-soft-dark"), "Desktop must switch live to gh-soft-dark");
  assert.ok(!markedDesktop.has("gh-light-trit-hc"), "Desktop must unmark previous theme");
  desktopDispose?.();

  // 3. Test shared/primer-themes.mjs & web/index.mjs
  const shared = await import(pathToFileURL(path.join(ROOT, "shared/primer-themes.mjs")).href);
  assert.equal(shared.LIGHT_BASE_THEMES.length, 3, "Must have 3 light themes");
  assert.equal(shared.DARK_BASE_THEMES.length, 4, "Must have 4 dark themes (including Soft dark)");
  assert.equal(Object.keys(shared.THEME_VARIANTS).length, 14, "Must have 14 official Primer variants");

  const webMod = await import(pathToFileURL(path.join(ROOT, "web/index.mjs")).href);
  assert.equal(typeof webMod.activate, "function", "web/index.mjs must export activate");
  const markedWeb = new Set();
  globalThis.document = {
    documentElement: { getAttribute: () => null },
    body: { hasAttribute: () => true },
    defaultView: null,
  };
  const webAc = new AbortController();
  const webDispose = await webMod.activate({
    signal: webAc.signal,
    dom: {
      mark(_el, name) {
        assert.match(name, /^[a-z0-9][a-z0-9-]{0,63}$/u, `Invalid web marker: ${name}`);
        markedWeb.add(name);
      },
      unmark(_el, name) {
        markedWeb.delete(name);
      },
    },
    storage: {
      async get() {
        return { themeMode: "auto", lightTheme: "light_colorblind", darkTheme: "dark_colorblind", increaseContrast: false };
      },
      onChange() {
        return () => {};
      },
    },
    track() {},
  });
  assert.ok(markedWeb.has("gh-active"), "Web must mark gh-active");
  assert.ok(markedWeb.has("gh-dark-cb"), "Web auto dark mode must resolve to dark_colorblind");
  webDispose?.();
  assert.equal(markedWeb.size, 0, "Web cleanup must remove all markers");

  // 4. Verify page/index.mjs and widget/index.mjs export mount(root, api)
  const pageMod = await import(pathToFileURL(path.join(ROOT, "page/index.mjs")).href);
  const widgetMod = await import(pathToFileURL(path.join(ROOT, "widget/index.mjs")).href);
  assert.equal(typeof pageMod.mount, "function", "page/index.mjs must export mount");
  assert.equal(typeof widgetMod.mount, "function", "widget/index.mjs must export mount");

  globalThis.document = prevDoc;
}

function buildZip(manifest) {
  const distDir = path.join(ROOT, "dist");
  mkdirSync(distDir, { recursive: true });
  const zipName = `${manifest.id}-${manifest.version}.zip`;
  const zipPath = path.join(distDir, zipName);
  rmSync(zipPath, { force: true });

  execFileSync("zip", ["-q", "-X", zipPath, ...PACKAGE_FILES], { cwd: ROOT });

  const zipBytes = readFileSync(zipPath);
  assert.ok(zipBytes.length <= LIMITS.zip, "ZIP exceeds 64 MiB limit");
  const sha256 = createHash("sha256").update(zipBytes).digest("hex");

  // Verify manifest.json is at ZIP root
  const listing = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
    .trim()
    .split("\n");
  assert.ok(listing.includes("manifest.json"), "manifest.json must be at ZIP root");
  assert.equal(listing.length, PACKAGE_FILES.length, "ZIP entry count must match runtime file list");

  return { zipPath, size: zipBytes.length, sha256, entries: listing };
}

const manifest = await validateManifestAndAssets();
await runRuntimeSmokeTests();
const pkg = buildZip(manifest);

console.log("Validation PASSED:");
console.log(`  Extension : ${manifest.id}@${manifest.version} (manifestVersion: ${manifest.manifestVersion})`);
console.log(`  ZIP       : ${path.relative(ROOT, pkg.zipPath)} (${(pkg.size / 1024).toFixed(1)} KiB)`);
console.log(`  SHA-256   : ${pkg.sha256}`);
console.log(`  Files (${pkg.entries.length}): ${pkg.entries.join(", ")}`);

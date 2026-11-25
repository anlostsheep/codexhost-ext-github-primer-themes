#!/usr/bin/env node
/**
 * Sync official GitHub Primer Primitives CSS themes from github.com/primer/primitives
 * (@primer/primitives) and generate:
 *   - shared/primer-themes.mjs
 *   - web/style.css
 *   - desktop/style.css
 *
 * Every color token is extracted verbatim from GitHub's official @primer/primitives CSS.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PRIMER_VERSION = "11.10.0";
const PRIMER_REPO = "https://github.com/primer/primitives";
const PRIMER_CDN_BASE = `https://unpkg.com/@primer/primitives@${PRIMER_VERSION}/dist/css/functional/themes`;
const CACHE_DIR = process.env.PRIMER_CACHE_DIR || "/tmp/primer-themes";

const EXTENSION_ID = "github-primer-themes";
const WEB_ATTR_PREFIX = `data-cx-ext-${EXTENSION_ID}-`;
const DESKTOP_ATTR_PREFIX = `data-cx-${EXTENSION_ID}-`;

/**
 * The 7 base GitHub Appearance themes (matching GitHub Settings -> Appearance)
 * plus their 7 official High Contrast counterparts = 14 official Primer CSS files.
 */
const BASE_THEMES = [
  {
    id: "light",
    file: "light",
    hcFile: "light-high-contrast",
    marker: "gh-light",
    hcMarker: "gh-light-hc",
    scheme: "light",
    beta: false,
    name: { en: "Light default", "zh-CN": "默认浅色 (Light default)" },
    shortName: { en: "Light", "zh-CN": "默认浅色" },
    description: {
      en: "GitHub's standard light theme with full color contrast and brightness.",
      "zh-CN": "GitHub 标准浅色主题，具备完整色彩对比度与明亮界面。",
    },
  },
  {
    id: "light_colorblind",
    file: "light-colorblind",
    hcFile: "light-colorblind-high-contrast",
    marker: "gh-light-cb",
    hcMarker: "gh-light-cb-hc",
    scheme: "light",
    beta: true,
    name: {
      en: "Light protanopia and deuteranopia",
      "zh-CN": "浅色红绿色盲友好 (Protanopia & Deuteranopia)",
    },
    shortName: { en: "Light CB", "zh-CN": "浅色红绿友好" },
    description: {
      en: "For people who may find it difficult to distinguish between reds and greens.",
      "zh-CN": "专为较难区分红色与绿色的用户优化的浅色主题。",
    },
  },
  {
    id: "light_tritanopia",
    file: "light-tritanopia",
    hcFile: "light-tritanopia-high-contrast",
    marker: "gh-light-trit",
    hcMarker: "gh-light-trit-hc",
    scheme: "light",
    beta: true,
    name: {
      en: "Light tritanopia",
      "zh-CN": "浅色蓝黄色盲友好 (Light tritanopia)",
    },
    shortName: { en: "Light Trit", "zh-CN": "浅色蓝黄友好" },
    description: {
      en: "For people who may find it difficult to distinguish between blues and greens, as well as yellows and purples.",
      "zh-CN": "专为较难区分蓝绿色及黄紫色的用户优化的浅色主题。",
    },
  },
  {
    id: "dark",
    file: "dark",
    hcFile: "dark-high-contrast",
    marker: "gh-dark",
    hcMarker: "gh-dark-hc",
    scheme: "dark",
    beta: false,
    name: { en: "Dark default", "zh-CN": "默认深色 (Dark default)" },
    shortName: { en: "Dark", "zh-CN": "默认深色" },
    description: {
      en: "GitHub's standard dark theme with full color contrast and brightness on a dark background.",
      "zh-CN": "GitHub 标准深色主题，在深色画布上呈现清晰的高对比视觉层次。",
    },
  },
  {
    id: "dark_colorblind",
    file: "dark-colorblind",
    hcFile: "dark-colorblind-high-contrast",
    marker: "gh-dark-cb",
    hcMarker: "gh-dark-cb-hc",
    scheme: "dark",
    beta: true,
    name: {
      en: "Dark protanopia and deuteranopia",
      "zh-CN": "深色红绿色盲友好 (Protanopia & Deuteranopia)",
    },
    shortName: { en: "Dark CB", "zh-CN": "深色红绿友好" },
    description: {
      en: "For people who may find it difficult to distinguish between reds and greens, with a dark background.",
      "zh-CN": "深色背景下专为较难区分红色与绿色的用户优化的主题。",
    },
  },
  {
    id: "dark_tritanopia",
    file: "dark-tritanopia",
    hcFile: "dark-tritanopia-high-contrast",
    marker: "gh-dark-trit",
    hcMarker: "gh-dark-trit-hc",
    scheme: "dark",
    beta: true,
    name: {
      en: "Dark tritanopia",
      "zh-CN": "深色蓝黄色盲友好 (Dark tritanopia)",
    },
    shortName: { en: "Dark Trit", "zh-CN": "深色蓝黄友好" },
    description: {
      en: "For people who may find it difficult to distinguish between blues and greens, as well as yellows and purples, with a dark background.",
      "zh-CN": "深色背景下专为较难区分蓝绿色及黄紫色的用户优化的主题。",
    },
  },
  {
    id: "dark_dimmed",
    file: "dark-dimmed",
    hcFile: "dark-dimmed-high-contrast",
    marker: "gh-soft-dark",
    hcMarker: "gh-soft-dark-hc",
    scheme: "dark",
    beta: false,
    name: { en: "Soft dark", "zh-CN": "柔和深色 (Soft dark)" },
    shortName: { en: "Soft dark", "zh-CN": "柔和深色" },
    description: {
      en: "A dark theme with reduced contrast for comfortable viewing in low-light environments.",
      "zh-CN": "降低对比度的柔和深色主题（GitHub Dark Dimmed），适合弱光环境长时间阅读。",
    },
  },
];

/**
 * Official Primer Primitives CSS custom properties extracted verbatim from each
 * official theme stylesheet. Kept concise so both web/style.css and desktop/style.css
 * stay well under codexhost's 256 KiB stylesheet limit while preserving complete fidelity.
 */
const EXTRACTED_TOKENS = [
  // Backgrounds
  "--bgColor-default",
  "--bgColor-muted",
  "--bgColor-inset",
  "--bgColor-emphasis",
  "--bgColor-inverse",
  "--bgColor-disabled",
  "--bgColor-transparent",
  "--bgColor-neutral-muted",
  "--bgColor-neutral-emphasis",
  "--bgColor-accent-muted",
  "--bgColor-accent-emphasis",
  "--bgColor-success-muted",
  "--bgColor-success-emphasis",
  "--bgColor-open-muted",
  "--bgColor-open-emphasis",
  "--bgColor-attention-muted",
  "--bgColor-attention-emphasis",
  "--bgColor-severe-muted",
  "--bgColor-severe-emphasis",
  "--bgColor-danger-muted",
  "--bgColor-danger-emphasis",
  "--bgColor-closed-muted",
  "--bgColor-closed-emphasis",
  "--bgColor-done-muted",
  "--bgColor-done-emphasis",
  // Foregrounds
  "--fgColor-default",
  "--fgColor-muted",
  "--fgColor-onEmphasis",
  "--fgColor-onInverse",
  "--fgColor-disabled",
  "--fgColor-link",
  "--fgColor-neutral",
  "--fgColor-accent",
  "--fgColor-success",
  "--fgColor-open",
  "--fgColor-attention",
  "--fgColor-severe",
  "--fgColor-danger",
  "--fgColor-closed",
  "--fgColor-done",
  // Borders
  "--borderColor-default",
  "--borderColor-muted",
  "--borderColor-emphasis",
  "--borderColor-disabled",
  "--borderColor-transparent",
  "--borderColor-translucent",
  "--borderColor-neutral-muted",
  "--borderColor-neutral-emphasis",
  "--borderColor-accent-muted",
  "--borderColor-accent-emphasis",
  "--borderColor-success-muted",
  "--borderColor-success-emphasis",
  "--borderColor-open-muted",
  "--borderColor-open-emphasis",
  "--borderColor-attention-muted",
  "--borderColor-attention-emphasis",
  "--borderColor-danger-muted",
  "--borderColor-danger-emphasis",
  "--borderColor-done-muted",
  "--borderColor-done-emphasis",
  // Buttons & controls
  "--button-primary-bgColor-rest",
  "--button-primary-bgColor-hover",
  "--button-primary-bgColor-active",
  "--button-primary-bgColor-disabled",
  "--button-primary-fgColor-rest",
  "--button-primary-borderColor-rest",
  "--button-default-bgColor-rest",
  "--button-default-bgColor-hover",
  "--button-default-bgColor-active",
  "--button-default-fgColor-rest",
  "--button-default-borderColor-rest",
  "--button-danger-fgColor-rest",
  "--button-danger-bgColor-hover",
  "--control-bgColor-rest",
  "--control-bgColor-hover",
  "--control-bgColor-active",
  "--control-bgColor-disabled",
  "--control-fgColor-rest",
  "--control-fgColor-placeholder",
  "--control-borderColor-rest",
  "--control-borderColor-emphasis",
  "--control-checked-bgColor-rest",
  "--control-checked-bgColor-hover",
  "--control-checked-fgColor-rest",
  "--control-transparent-bgColor-hover",
  "--control-transparent-bgColor-active",
  "--control-transparent-bgColor-selected",
  // Focus, overlay, tooltip, shadow, header
  "--focus-outlineColor",
  "--overlay-bgColor",
  "--overlay-borderColor",
  "--overlay-backdrop-bgColor",
  "--tooltip-bgColor",
  "--tooltip-fgColor",
  "--header-bgColor",
  "--header-fgColor-default",
  "--header-borderColor-divider",
  "--shadow-floating-small",
  "--shadow-floating-medium",
  "--shadow-floating-large",
  "--shadow-resting-xsmall",
  "--shadow-resting-small",
  "--shadow-inset",
  "--selection-bgColor",
  // Diff blobs (GitHub official diff colors)
  "--diffBlob-additionLine-bgColor",
  "--diffBlob-additionNum-bgColor",
  "--diffBlob-additionNum-fgColor",
  "--diffBlob-additionWord-bgColor",
  "--diffBlob-deletionLine-bgColor",
  "--diffBlob-deletionNum-bgColor",
  "--diffBlob-deletionNum-fgColor",
  "--diffBlob-deletionWord-bgColor",
  "--diffBlob-hunkLine-bgColor",
  "--diffBlob-hunkNum-bgColor-rest",
  // Code syntax highlighting (GitHub PrettyLights)
  "--prettylights-syntax-comment",
  "--prettylights-syntax-constant",
  "--prettylights-syntax-entity",
  "--prettylights-syntax-entity-tag",
  "--prettylights-syntax-keyword",
  "--prettylights-syntax-string",
  "--prettylights-syntax-variable",
  "--prettylights-syntax-storage-modifier-import",
  "--prettylights-syntax-markup-heading",
  "--prettylights-syntax-sublimelinter-gutter-mark",
];

async function readOfficialPrimerCss(fileStem) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${fileStem}.css`);
  if (existsSync(cachePath) && !process.env.PRIMER_REFRESH) {
    return readFileSync(cachePath, "utf8");
  }
  const url = `${PRIMER_CDN_BASE}/${fileStem}.css`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch official Primer CSS ${url}: HTTP ${res.status}`);
  }
  const text = await res.text();
  writeFileSync(cachePath, text, "utf8");
  return text;
}

function parsePrimerTokens(cssText) {
  // Take the primary rule block before @media (prefers-color-scheme: dark) auto duplicate
  const primary = cssText.split("@media")[0];
  const raw = new Map();
  for (const [, name, value] of primary.matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g)) {
    raw.set(name, value.trim());
  }

  const resolve = (name, depth = 0) => {
    const val = raw.get(name);
    if (!val) return undefined;
    if (depth > 8) return val;
    const ref = val.match(/^var\((--[a-zA-Z0-9_-]+)\)$/);
    if (ref) {
      const target = resolve(ref[1], depth + 1);
      if (target) return target;
    }
    // Resolve var(...) inside compound values (like shadows)
    return val.replace(/var\((--[a-zA-Z0-9_-]+)\)/g, (full, inner) => {
      const target = resolve(inner, depth + 1);
      return target ?? full;
    });
  };

  const tokens = {};
  for (const key of EXTRACTED_TOKENS) {
    const resolved = resolve(key);
    if (resolved !== undefined) {
      tokens[key] = resolved;
    }
  }
  return tokens;
}

function buildVariantRecords(variantMap) {
  const variants = {};
  for (const base of BASE_THEMES) {
    for (const isHc of [false, true]) {
      const fileStem = isHc ? base.hcFile : base.file;
      const variantId = isHc ? `${base.id}_high_contrast` : base.id;
      const marker = isHc ? base.hcMarker : base.marker;
      const { tokens, sha256 } = variantMap.get(fileStem);

      // Authentic GitHub Appearance card preview palette (100% from official Primer tokens)
      const preview = {
        canvas: tokens["--bgColor-default"],
        muted: tokens["--bgColor-muted"],
        inset: tokens["--bgColor-inset"] || tokens["--bgColor-muted"],
        border: tokens["--borderColor-default"],
        borderMuted: tokens["--borderColor-muted"],
        text: tokens["--fgColor-default"],
        textMuted: tokens["--fgColor-muted"],
        accent: tokens["--fgColor-accent"],
        accentBg: tokens["--bgColor-accent-emphasis"],
        // Matches GitHub's Appearance preview card dots & diff bar:
        // default: green/red, protanopia/deuteranopia: blue/amber, tritanopia: blue/red
        barFill:
          base.id === "dark_colorblind"
            ? tokens["--fgColor-open"]
            : base.id === "dark_tritanopia"
              ? tokens["--fgColor-open"]
              : tokens["--bgColor-success-emphasis"],
        barBg:
          base.id === "dark_colorblind"
            ? tokens["--bgColor-attention-muted"]
            : base.id === "dark_tritanopia"
              ? tokens["--bgColor-danger-muted"]
              : tokens["--bgColor-success-muted"],
        dotA: tokens["--bgColor-success-emphasis"],
        dotB:
          base.id.includes("colorblind")
            ? tokens["--fgColor-open"]
            : tokens["--bgColor-danger-emphasis"],
        btnPrimaryBg: tokens["--button-primary-bgColor-rest"],
        btnPrimaryFg: tokens["--button-primary-fgColor-rest"],
        btnDefaultBg: tokens["--button-default-bgColor-rest"],
        btnDefaultFg: tokens["--button-default-fgColor-rest"],
        btnDefaultBorder: tokens["--button-default-borderColor-rest"],
        doneBg: tokens["--bgColor-done-emphasis"],
        dangerFg: tokens["--fgColor-danger"],
        diffAddBg: tokens["--diffBlob-additionLine-bgColor"],
        diffAddNumBg: tokens["--diffBlob-additionNum-bgColor"],
        diffDelBg: tokens["--diffBlob-deletionLine-bgColor"],
        diffDelNumBg: tokens["--diffBlob-deletionNum-bgColor"],
        syntaxKeyword: tokens["--prettylights-syntax-keyword"],
        syntaxString: tokens["--prettylights-syntax-string"],
        syntaxEntity: tokens["--prettylights-syntax-entity"],
        syntaxComment: tokens["--prettylights-syntax-comment"],
        syntaxConstant: tokens["--prettylights-syntax-constant"],
      };

      variants[variantId] = {
        id: variantId,
        baseId: base.id,
        highContrast: isHc,
        scheme: base.scheme,
        marker,
        cssFile: `dist/css/functional/themes/${fileStem}.css`,
        sourceUrl: `${PRIMER_CDN_BASE}/${fileStem}.css`,
        sha256,
        preview,
        tokens,
      };
    }
  }
  return variants;
}

function renderTokenDecls(tokens) {
  return Object.entries(tokens)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

function buildWebCss(variants) {
  const header = `/*
 * Generated from GitHub's official @primer/primitives@${PRIMER_VERSION}
 * Repository: ${PRIMER_REPO}
 * Every Primer token below is extracted verbatim from dist/css/functional/themes/*.css.
 * Do not hand-edit; run \`node scripts/sync-primer-themes.mjs\` to refresh from upstream.
 */
`;

  const themeBlocks = Object.values(variants)
    .map((v) => {
      const sel = `html[${WEB_ATTR_PREFIX}${v.marker}]`;
      // Exact GitHub Dashboard / Primer layer hierarchy (verified against live GitHub Dashboard):
      //   - Main canvas & top global header bar : --bgColor-inset  (Soft dark #151b23, Dark #010409, Light #f6f8fa)
      //   - Left sidebar, composer & cards      : --bgColor-default (Soft dark #212830, Dark #0d1117, Light #ffffff)
      //   - Active sidebar nav row              : --bgColor-neutral-muted (gives #283038 over #212830, soft tint over #ffffff)
      return `${sel} {\n  color-scheme: ${v.scheme};\n  --gh-canvas-bg: var(--bgColor-inset);\n  --gh-topbar-bg: var(--bgColor-inset);\n  --gh-sidebar-bg: var(--bgColor-default);\n  --gh-card-bg: var(--bgColor-default);\n  --gh-input-bg: var(--bgColor-default);\n  --gh-sidebar-active-bg: var(--bgColor-neutral-muted);\n${renderTokenDecls(v.tokens)}\n}`;
    })
    .join("\n\n");

  const active = `html[${WEB_ATTR_PREFIX}gh-active]`;
  const bodyTargets = [
    `${active} body`,
    `${active} body[data-ds-dark-theme]`,
    `${active}[data-platform="darwin"]:not([data-tauri-shell]) body`,
    `${active}[data-platform="darwin"]:not([data-tauri-shell]) body[data-ds-dark-theme]`,
  ].join(",\n");

  const mapping = `
/* Map official GitHub Primer tokens onto CH Web (--dsw-*, --shiki-*, --cx-page-*) */
${active} {
  --dsw-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Helvetica, Arial, sans-serif;
  --ds-font-family-code: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "PingFang SC", "Microsoft YaHei", monospace;
  /* Official @primer/primitives radius.css scale: crisp 3px/6px GitHub geometry (no DeepSeek 28px pills/squircles) */
  --dsw-corner-shape: round;
  --dsw-radius-xs: 3px;
  --dsw-radius-sm: 6px;
  --dsw-radius-md: 6px;
  --dsw-radius-lg: 6px;
  --dsw-radius-xl: 6px;
  --dsw-radius-panel: 6px;
  --dsw-focus-ring-color: var(--focus-outlineColor);
  --shiki-foreground: var(--fgColor-default);
  --shiki-background: var(--bgColor-muted);
  --shiki-token-constant: var(--prettylights-syntax-constant);
  --shiki-token-string: var(--prettylights-syntax-string);
  --shiki-token-comment: var(--prettylights-syntax-comment);
  --shiki-token-keyword: var(--prettylights-syntax-keyword);
  --shiki-token-parameter: var(--prettylights-syntax-variable);
  --shiki-token-function: var(--prettylights-syntax-entity);
  --shiki-token-string-expression: var(--prettylights-syntax-entity-tag);
  --shiki-token-punctuation: var(--fgColor-default);
  --shiki-token-link: var(--fgColor-link);
}

${bodyTargets} {
  /* Rebind static brand/semantic scales so DeepSeek blue/green/red never leaks */
  --dsw-static-deepseek-50: var(--bgColor-accent-muted);
  --dsw-static-deepseek-100: var(--bgColor-accent-muted);
  --dsw-static-deepseek-200: var(--borderColor-accent-muted);
  --dsw-static-deepseek-300: var(--fgColor-accent);
  --dsw-static-deepseek-400: var(--fgColor-accent);
  --dsw-static-deepseek-450: var(--bgColor-accent-emphasis);
  --dsw-static-deepseek-500: var(--bgColor-accent-emphasis);
  --dsw-static-deepseek-600: var(--bgColor-accent-emphasis);
  --dsw-static-deepseek-800: var(--bgColor-accent-muted);
  --dsw-static-deepseek-900: var(--bgColor-inset);
  --dsw-static-blue-400: var(--fgColor-accent);
  --dsw-static-blue-450: var(--fgColor-accent);
  --dsw-static-blue-500: var(--bgColor-accent-emphasis);
  --dsw-static-blue-600: var(--bgColor-accent-emphasis);
  --dsw-static-green-400: var(--fgColor-success);
  --dsw-static-green-500: var(--bgColor-success-emphasis);
  --dsw-static-green-900: var(--bgColor-success-muted);
  --dsw-static-red-400: var(--fgColor-danger);
  --dsw-static-red-500: var(--bgColor-danger-emphasis);
  --dsw-static-red-600: var(--bgColor-danger-emphasis);
  --dsw-static-red-900: var(--bgColor-danger-muted);
  --dsw-static-amber-400: var(--fgColor-attention);
  --dsw-static-amber-500: var(--bgColor-attention-emphasis);
  --dsw-static-amber-600: var(--fgColor-attention);
  --dsw-static-amber-900: var(--bgColor-attention-muted);

  --dsw-alias-bg-base: var(--gh-canvas-bg);
  --dsw-alias-bg-secondary: var(--bgColor-muted);
  --dsw-alias-bg-layer-1: var(--gh-card-bg);
  --dsw-alias-bg-layer-2: var(--bgColor-muted);
  --dsw-alias-bg-layer-3: var(--control-bgColor-rest);
  --dsw-alias-bg-document-preview: var(--gh-canvas-bg);
  --dsw-alias-bg-document-selection: var(--selection-bgColor);
  --dsw-alias-bg-module-platform: var(--gh-card-bg);
  --dsw-alias-bg-multi-select: var(--bgColor-accent-muted);
  --dsw-alias-bg-overlay: var(--overlay-bgColor);
  --dsw-alias-bg-skeleton: var(--bgColor-neutral-muted);
  --dsw-alias-bg-mask-1: var(--overlay-backdrop-bgColor);
  --dsw-alias-bg-mask-2: var(--overlay-backdrop-bgColor);
  --dsw-alias-settings-card-fill: var(--gh-card-bg);
  --dsw-alias-settings-card-stroke: var(--borderColor-default);

  --dsw-alias-border-inverted: var(--borderColor-muted);
  --dsw-alias-border-inverted2: var(--borderColor-default);
  --dsw-alias-border-l1: var(--borderColor-muted);
  --dsw-alias-border-l2: var(--borderColor-default);
  --dsw-alias-border-l2-darkmode-thin: var(--borderColor-muted);
  --dsw-alias-border-l3: var(--borderColor-default);
  --dsw-alias-border-l4: var(--borderColor-emphasis);

  --dsw-alias-brand-primary: var(--button-primary-bgColor-rest);
  --dsw-alias-brand-primary-invert: var(--fgColor-default);
  --dsw-alias-brand-primary-new-colorprimary-new-color: var(--bgColor-accent-emphasis);
  --dsw-alias-brand-text: var(--fgColor-default);

  --dsw-alias-button-primary-fill: var(--button-primary-bgColor-rest);
  --dsw-alias-button-primary-hover: var(--button-primary-bgColor-hover);
  --dsw-alias-button-primary-dimmed: var(--button-primary-bgColor-disabled);
  --dsw-alias-button-contrast-fill: var(--button-default-bgColor-rest);
  --dsw-alias-button-elevated-fill: var(--button-default-bgColor-rest);
  --dsw-alias-button-floating-fill: var(--button-default-bgColor-rest);
  --dsw-alias-button-floating-hover: var(--button-default-bgColor-hover);
  --dsw-alias-button-ghost-active-border: var(--borderColor-accent-emphasis);
  --dsw-alias-button-ghost-active-fill: var(--bgColor-accent-muted);
  --dsw-alias-button-ghost-active-hover: var(--control-bgColor-hover);
  --dsw-alias-button-info-fill: var(--bgColor-accent-emphasis);
  --dsw-alias-button-info-hover: var(--control-checked-bgColor-hover);

  --dsw-alias-interactive-bg-hover: var(--control-transparent-bgColor-hover);
  --dsw-alias-interactive-bg-hover-solid: var(--control-bgColor-hover);
  --dsw-alias-interactive-bg-hover-accent: var(--bgColor-accent-muted);
  --dsw-alias-interactive-bg-hover-danger: var(--bgColor-danger-muted);
  --dsw-alias-interactive-bg-active: var(--control-transparent-bgColor-active);

  --dsw-alias-label-primary: var(--fgColor-default);
  --dsw-alias-label-primary-bluish: var(--fgColor-default);
  --dsw-alias-label-primary-dimmed: var(--fgColor-default);
  --dsw-alias-label-primary-foreground: var(--button-primary-fgColor-rest);
  --dsw-alias-label-primary-inverted: var(--fgColor-onEmphasis);
  --dsw-alias-label-secondary: var(--fgColor-muted);
  --dsw-alias-label-tertiary: var(--fgColor-muted);
  --dsw-alias-label-caption: var(--fgColor-muted);
  --dsw-alias-label-dimmed: var(--fgColor-disabled);
  --dsw-alias-label-document-preview: var(--fgColor-muted);
  --dsw-alias-label-deep-diving: var(--fgColor-accent);
  --dsw-alias-label-deep-diving-shimmer: var(--fgColor-done);
  --dsw-alias-menu-icon: var(--fgColor-muted);
  --dsw-alias-link: var(--fgColor-link);

  --dsw-alias-markdown-citation: var(--bgColor-neutral-muted);
  --dsw-alias-markdown-code-block: var(--bgColor-muted);
  --dsw-alias-markdown-code-block-banner: var(--bgColor-inset);
  --dsw-alias-markdown-code-segment-selected: var(--bgColor-default);
  --dsw-alias-markdown-code-segment-unselected: var(--bgColor-muted);
  --dsw-alias-markdown-inline-code: var(--bgColor-neutral-muted);
  --dsw-alias-markdown-placeholder: var(--bgColor-muted);
  --dsw-alias-markdown-tag: var(--bgColor-neutral-muted);

  --dsw-alias-scrollbar-bg-l1: var(--borderColor-default);
  --dsw-alias-scrollbar-bg-l2: var(--borderColor-emphasis);
  --dsw-alias-scrollbar-hover-l1: var(--fgColor-muted);
  --dsw-alias-scrollbar-hover-l2: var(--fgColor-muted);

  --dsw-alias-state-business-primary: var(--bgColor-accent-emphasis);
  --dsw-alias-state-business-tertiary: var(--bgColor-accent-muted);
  --dsw-alias-state-error-primary: var(--fgColor-danger);
  --dsw-alias-state-error-secondary: var(--bgColor-danger-emphasis);
  --dsw-alias-state-idle-primary: var(--fgColor-neutral);
  --dsw-alias-state-success-primary: var(--bgColor-success-emphasis);
  --dsw-alias-state-success-secondary: var(--fgColor-success);
  --dsw-alias-state-success-tertiary: var(--bgColor-success-muted);
  --dsw-alias-state-warn-label: var(--fgColor-attention);
  --dsw-alias-state-warn-primary: var(--bgColor-attention-emphasis);
  --dsw-alias-state-warn-secondary: var(--fgColor-attention);
  --dsw-alias-state-warn-tertiary: var(--bgColor-attention-muted);

  --dsw-alias-code-diff-added: var(--diffBlob-additionLine-bgColor);
  --dsw-alias-code-diff-deleted: var(--diffBlob-deletionLine-bgColor);
  --dsw-alias-file-diff-added-bg: var(--diffBlob-additionLine-bgColor);
  --dsw-alias-file-diff-added-gutter: var(--diffBlob-additionNum-bgColor);
  --dsw-alias-file-diff-added-marker: var(--fgColor-success);
  --dsw-alias-file-diff-deleted-bg: var(--diffBlob-deletionLine-bgColor);
  --dsw-alias-file-diff-deleted-gutter: var(--diffBlob-deletionNum-bgColor);
  --dsw-alias-file-diff-deleted-marker: var(--fgColor-danger);

  --dsw-alias-switch-thumb: var(--fgColor-onEmphasis);
  --dsw-alias-toast-bg: var(--tooltip-bgColor);
  --dsw-alias-toast-label: var(--tooltip-fgColor);
  --dsw-alias-tooltip-bg: var(--tooltip-bgColor);
  --dsw-alias-turn-trigger-bg: var(--bgColor-muted);
  --dsw-alias-turn-trigger-bg-hover: var(--control-bgColor-hover);

  --dsw-specific-bubble: var(--bgColor-accent-muted);
  --dsw-specific-bubble-highlight: var(--borderColor-accent-muted);
  --dsw-specific-input-major: var(--gh-input-bg);
  --dsw-specific-login-input: var(--gh-input-bg);
  --dsw-menu-surface-fill: var(--overlay-bgColor);
  --dsw-alias-menu-group-header-fill: var(--bgColor-muted);
  --dsw-specific-menu: var(--overlay-bgColor);
  --dsw-specific-selector: var(--control-bgColor-rest);
  --dsw-specific-sidebar-fill: var(--gh-sidebar-bg);
  --dsw-specific-sidebar-nav-item-active: var(--gh-sidebar-active-bg);
  --dsw-specific-sidebar-nav-item-active-accent: var(--bgColor-accent-muted);
  --dsw-specific-sidebar-nav-item-hover: var(--control-transparent-bgColor-hover);
  --dsw-specific-tip: var(--gh-card-bg);

  --shiki-foreground: var(--fgColor-default);
  --shiki-background: var(--gh-card-bg);
  --shiki-token-constant: var(--prettylights-syntax-constant);
  --shiki-token-string: var(--prettylights-syntax-string);
  --shiki-token-comment: var(--prettylights-syntax-comment);
  --shiki-token-keyword: var(--prettylights-syntax-keyword);
  --shiki-token-parameter: var(--prettylights-syntax-variable);
  --shiki-token-function: var(--prettylights-syntax-entity);
  --shiki-token-string-expression: var(--prettylights-syntax-entity-tag);
  --shiki-token-punctuation: var(--fgColor-default);
  --shiki-token-link: var(--fgColor-link);

  --cx-page-bg: var(--gh-canvas-bg);
  --cx-page-surface: var(--gh-card-bg);
  --cx-page-text: var(--fgColor-default);
  --cx-page-text-muted: var(--fgColor-muted);
  --cx-page-border: var(--borderColor-default);
  --cx-page-accent: var(--fgColor-accent);
  --cx-page-danger: var(--fgColor-danger);
  --cx-page-radius: 6px;

  background-color: var(--gh-canvas-bg);
  color: var(--fgColor-default);
}

/* ==========================================================================
 * High-Fidelity GitHub Primer Chrome Surfaces (matches GitHub Dashboard layout)
 *   - Top header bar & Main center canvas : --bgColor-inset  (e.g. #151b23 Soft dark / #010409 Dark / #f6f8fa Light)
 *   - Left sidebar, Composer & Cards      : --bgColor-default (e.g. #212830 Soft dark / #0d1117 Dark / #ffffff Light)
 * ========================================================================== */

/* 1. App frame & Sidebar: solid GitHub sidebar (--bgColor-default) + darker main canvas (--bgColor-inset) */
${active}[data-platform="darwin"],
${active}[data-platform="darwin"] body,
${active} [data-cx-region="app"] {
  background: var(--gh-canvas-bg) !important;
}

${active} [data-cx-region="app"] > div:has(> [data-cx-region="sidebar"]) {
  background: var(--gh-sidebar-bg) !important;
  border-right: 1px solid var(--borderColor-default) !important;
}

${active} [data-cx-region="app"] > div:has([data-cx-region="topbar"]) {
  background: var(--gh-canvas-bg) !important;
  border-left: none !important;
  box-shadow: none !important;
}

${active} [data-cx-region="sidebar"] {
  --ch-sidebar-text-primary: var(--fgColor-default) !important;
  --ch-sidebar-text-muted: var(--fgColor-muted) !important;
  --dsw-alias-label-primary: var(--fgColor-default) !important;
  --dsw-alias-label-secondary: var(--fgColor-muted) !important;
  --dsw-alias-label-tertiary: var(--fgColor-muted) !important;
  --dsw-alias-label-caption: var(--fgColor-muted) !important;
  background: var(--gh-sidebar-bg) !important;
  color: var(--fgColor-default) !important;
}

/* Override Rows.module.css local --ch-sidebar-text-primary (#ffffff under body[data-ds-dark-theme])
   so thread titles stay legible in Light GitHub themes even when CH Web native mode is Dark */
${active} [data-cx-region="sidebar"] [data-row-key],
${active} [data-cx-region="sidebar"] [class*="sessionRow"],
${active} [data-cx-region="sidebar"] [class*="searchResultRow"],
${active} [data-cx-region="sidebar"] [class*="projectRow"] {
  --ch-sidebar-text-primary: var(--fgColor-default) !important;
  --ch-sidebar-text-muted: var(--fgColor-muted) !important;
  --dsh-row-surface: var(--gh-sidebar-bg);
  color: var(--fgColor-default) !important;
}

/* Brand HOST badge & otter darkPlate: follow active GitHub scheme instead of host body[data-ds-dark-theme] */
${active} [class*="hostBadge"] {
  fill: var(--bgColor-emphasis) !important;
}

${active} [class*="hostBadgeText"] {
  fill: var(--fgColor-onEmphasis) !important;
}

html[${WEB_ATTR_PREFIX}gh-scheme-light] [class*="darkPlate"] {
  display: none !important;
}

html[${WEB_ATTR_PREFIX}gh-scheme-dark] [class*="darkPlate"] {
  display: inline !important;
}

/* Sidebar "New Session" button: authentic GitHub Primer default button (replaces macOS translucent white slab) */
${active} [data-cx-region="sidebar"] button[class*="newSession"] {
  background: var(--button-default-bgColor-rest) !important;
  color: var(--button-default-fgColor-rest) !important;
  border: 1px solid var(--button-default-borderColor-rest) !important;
  border-radius: 6px !important;
  box-shadow: var(--shadow-resting-xsmall) !important;
  transition: background-color 0.12s ease, border-color 0.12s ease;
}

${active} [data-cx-region="sidebar"] button[class*="newSession"]:hover {
  background: var(--button-default-bgColor-hover) !important;
  border-color: var(--borderColor-emphasis) !important;
}

${active} [data-cx-region="sidebar"] button[class*="newSession"]:active {
  background: var(--button-default-bgColor-active) !important;
}

/* Sidebar active thread row: GitHub Primer ActionList active highlight + 3px left accent indicator */
${active} [data-cx-region="sidebar"] [data-row-key][class*="selected"] {
  position: relative;
  --dsh-row-surface: var(--gh-sidebar-active-bg) !important;
  background: var(--gh-sidebar-active-bg) !important;
  border-radius: 6px !important;
  color: var(--fgColor-default) !important;
}

${active} [data-cx-region="sidebar"] [data-row-key][class*="selected"]::before {
  content: "";
  position: absolute;
  left: -4px;
  top: 5px;
  bottom: 5px;
  width: 3px;
  border-radius: 999px;
  background: var(--bgColor-accent-emphasis);
}

/* 2. Conversation Topbar Header: GitHub global header bar (--bgColor-inset) with crisp 1px bottom divider */
${active} [data-cx-region="topbar"] {
  background: var(--gh-topbar-bg) !important;
  border-bottom: 1px solid var(--borderColor-default) !important;
}

/* 3. Composer Input Card: authentic GitHub Copilot / Dashboard prompt box (--bgColor-default floating on --bgColor-inset) */
${active} [data-composer-card] {
  background: var(--gh-input-bg) !important;
  border: 1px solid var(--borderColor-default) !important;
  border-radius: 10px !important;
  box-shadow: var(--shadow-resting-small) !important;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

${active} [data-composer-card]:focus-within {
  border-color: var(--focus-outlineColor) !important;
  box-shadow: 0 0 0 1px var(--focus-outlineColor) !important;
}

${active} [data-composer-card] [data-composer-toolbar] {
  background: transparent;
  border-top: 1px solid var(--borderColor-muted);
  border-radius: 0 0 9px 9px;
  padding-top: 6px;
  padding-bottom: 6px;
}

${active} [data-composer-card] [data-toolbar-fixed="end"] button {
  background: var(--button-primary-bgColor-rest) !important;
  color: var(--button-primary-fgColor-rest) !important;
  border: 1px solid var(--button-primary-borderColor-rest) !important;
  border-radius: 6px !important;
}

${active} [data-composer-card] [data-toolbar-fixed="end"] button:hover:not(:disabled) {
  background: var(--button-primary-bgColor-hover) !important;
}

${active} [data-composer-card] [data-toolbar-fixed="end"] button:disabled {
  background: var(--button-primary-bgColor-disabled) !important;
  border-color: var(--button-primary-bgColor-disabled) !important;
  opacity: 0.7;
}

/* Streaming stop button (<svg><rect /></svg>) uses GitHub danger emphasis instead of green submit */
${active} [data-composer-card] [data-toolbar-fixed="end"] button:has(svg rect) {
  background: var(--bgColor-danger-emphasis) !important;
  border-color: var(--borderColor-danger-emphasis) !important;
  color: var(--fgColor-onEmphasis) !important;
}

${active} [data-composer-card] [data-toolbar-fixed="end"] button:has(svg rect):hover:not(:disabled) {
  background: var(--button-danger-bgColor-hover) !important;
}

${active} [data-composer-top-bar] {
  background: var(--gh-card-bg) !important;
  border: 1px solid var(--borderColor-default);
  border-bottom: 0;
  border-radius: 8px 8px 0 0 !important;
}

/* 4. Turn Changes Card ("已编辑 ...") & Review Button: GitHub Dashboard card (--bgColor-default on --bgColor-inset) */
${active} [data-turn-changes] {
  background: var(--gh-card-bg) !important;
  border: 1px solid var(--borderColor-default) !important;
  border-radius: 6px !important;
}

${active} [data-turn-changes] button[class*="review"] {
  background: var(--button-default-bgColor-rest) !important;
  color: var(--button-default-fgColor-rest) !important;
  border: 1px solid var(--button-default-borderColor-rest) !important;
  border-radius: 6px !important;
  padding: 5px 12px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  box-shadow: var(--shadow-resting-xsmall);
}

${active} [data-turn-changes] button[class*="review"]:hover {
  background: var(--button-default-bgColor-hover) !important;
  border-color: var(--borderColor-emphasis) !important;
}

/* 5. GitHub Primer Markdown: inline code, code blocks, blockquotes, headings, tables */
${active} :not(pre) > code {
  background-color: var(--bgColor-neutral-muted) !important;
  border: 0 !important;
  border-radius: 6px !important;
  padding: 0.16em 0.42em !important;
  color: var(--fgColor-default);
}

${active} .md-code-block,
${active} [class*="CodeBlock"][class*="block"] {
  background: var(--gh-card-bg) !important;
  border: 1px solid var(--borderColor-default) !important;
  border-radius: 6px !important;
}

${active} [data-code-block-banner] {
  background: var(--bgColor-muted) !important;
  border-bottom: 1px solid var(--borderColor-default) !important;
  border-radius: 5px 5px 0 0 !important;
}

${active} blockquote {
  border-left: 3px solid var(--borderColor-default) !important;
  color: var(--fgColor-muted) !important;
}

/* GitHub Primer Markdown tables: 1px cell grid + muted header & subtle zebra rows */
${active} table {
  border-collapse: collapse;
}

${active} table th,
${active} table td {
  border: 1px solid var(--borderColor-default) !important;
  padding: 6px 13px !important;
}

${active} table thead th {
  background: var(--bgColor-muted);
  font-weight: 600;
}

${active} table tbody tr:nth-child(2n) {
  background: var(--bgColor-muted);
}

/* 6. GitHub ActionMenu / Popover Overlays: solid Primer overlay surface + floating shadow */
${active} [data-menu-material] {
  background: var(--overlay-bgColor) !important;
  border: 1px solid var(--overlay-borderColor) !important;
  border-radius: 6px !important;
  box-shadow: var(--shadow-floating-medium) !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}

/* 7. CodexHost Selection Actions & Annotation Comment Card (overrides hardcoded #000000 island) */
${active} [data-selection-actions] {
  background: var(--overlay-bgColor) !important;
  border: 1px solid var(--overlay-borderColor) !important;
  box-shadow: var(--shadow-floating-medium) !important;
  color: var(--fgColor-default) !important;
  font-family: var(--dsw-font-family) !important;
}

/* Floating selection toolbar ("Add to chat | Comment") */
${active} [data-selection-actions]:not(:has(textarea)) {
  border-radius: 6px !important;
}

${active} [data-selection-actions]:not(:has(textarea)) button {
  color: var(--fgColor-default) !important;
  border-radius: 0 !important;
  font-family: var(--dsw-font-family) !important;
}

${active} [data-selection-actions]:not(:has(textarea)) button + button {
  border-left: 1px solid var(--borderColor-default) !important;
}

${active} [data-selection-actions]:not(:has(textarea)) button svg {
  color: var(--fgColor-muted) !important;
}

${active} [data-selection-actions]:not(:has(textarea)) button:hover {
  background: var(--control-transparent-bgColor-hover) !important;
}

${active} [data-selection-actions]:not(:has(textarea)) button:hover svg {
  color: var(--fgColor-default) !important;
}

/* Inline annotation comment card ("添加批注") */
${active} [data-selection-actions]:has(textarea) {
  border-radius: 8px !important;
  padding: 10px !important;
  gap: 8px !important;
}

${active} [data-selection-actions]:has(textarea) > div:first-child {
  color: var(--fgColor-muted) !important;
  border-left: 2px solid var(--borderColor-accent-emphasis);
  padding: 0 2px 0 7px !important;
}

${active} [data-selection-actions]:has(textarea) textarea {
  background: var(--gh-canvas-bg) !important;
  border: 1px solid var(--control-borderColor-rest) !important;
  border-radius: 6px !important;
  color: var(--fgColor-default) !important;
  box-shadow: var(--shadow-inset);
}

${active} [data-selection-actions]:has(textarea) textarea::placeholder {
  color: var(--control-fgColor-placeholder) !important;
}

${active} [data-selection-actions]:has(textarea) textarea:focus {
  border-color: var(--focus-outlineColor) !important;
  box-shadow: 0 0 0 1px var(--focus-outlineColor) !important;
}

${active} [data-selection-actions]:has(textarea) button[class*="cancel"] {
  background: var(--button-default-bgColor-rest) !important;
  color: var(--button-default-fgColor-rest) !important;
  border: 1px solid var(--button-default-borderColor-rest) !important;
  border-radius: 6px !important;
  height: 28px !important;
}

${active} [data-selection-actions]:has(textarea) button[class*="cancel"]:hover {
  background: var(--button-default-bgColor-hover) !important;
  border-color: var(--borderColor-emphasis) !important;
}

${active} [data-selection-actions]:has(textarea) button[class*="submit"] {
  background: var(--button-primary-bgColor-rest) !important;
  color: var(--button-primary-fgColor-rest) !important;
  border: 1px solid var(--button-primary-borderColor-rest) !important;
  border-radius: 6px !important;
  height: 28px !important;
}

${active} [data-selection-actions]:has(textarea) button[class*="submit"]:hover:not(:disabled) {
  background: var(--button-primary-bgColor-hover) !important;
}

${active} [data-selection-actions]:has(textarea) button[class*="submit"]:disabled {
  background: var(--button-primary-bgColor-disabled) !important;
  border-color: var(--button-primary-bgColor-disabled) !important;
  opacity: 0.7 !important;
}

${active} [data-selection-actions]:has(textarea) [class*="error"] {
  color: var(--fgColor-danger) !important;
}

/* Extension surface containers also inherit Primer page tokens immediately */
${active} [data-cx-host-widget],
${active} [class*="surface_theme"] {
  --cx-page-bg: var(--gh-canvas-bg);
  --cx-page-surface: var(--gh-card-bg);
  --cx-page-text: var(--fgColor-default);
  --cx-page-text-muted: var(--fgColor-muted);
  --cx-page-border: var(--borderColor-default);
  --cx-page-accent: var(--fgColor-accent);
  --cx-page-danger: var(--fgColor-danger);
  --cx-page-radius: 6px;
}

${active} ::selection {
  background: var(--selection-bgColor);
}

${active} a {
  color: var(--fgColor-link);
}
`;

  return `${header}\n${themeBlocks}\n${mapping}`;
}

function buildDesktopCss(variants) {
  const header = `/*
 * Generated from GitHub's official @primer/primitives@${PRIMER_VERSION}
 * Repository: ${PRIMER_REPO}
 * Every Primer token below is extracted verbatim from dist/css/functional/themes/*.css.
 * Do not hand-edit; run \`node scripts/sync-primer-themes.mjs\` to refresh from upstream.
 */
`;

  const themeBlocks = Object.values(variants)
    .map((v) => {
      const sel = `html[${DESKTOP_ATTR_PREFIX}${v.marker}]`;
      return `${sel} {\n  color-scheme: ${v.scheme};\n${renderTokenDecls(v.tokens)}\n}`;
    })
    .join("\n\n");

  const active = `html[${DESKTOP_ATTR_PREFIX}gh-active]`;
  const mapping = `
/* Map official GitHub Primer tokens onto Codex Desktop & codexhost settings surfaces */
${active},
${active} body,
${active}.dark,
${active}.light,
${active}[data-theme="dark"],
${active}[data-theme="light"] {
  /* Core Codex Desktop semantic color tokens (matches GitHub Dashboard hierarchy) */
  --color-background-default: var(--bgColor-inset);
  --color-background-primary: var(--bgColor-inset);
  --color-background-secondary: var(--bgColor-default);
  --color-background-surface: var(--bgColor-default);
  --color-background-surface-primary: var(--bgColor-default);
  --color-background-surface-secondary: var(--bgColor-muted);
  --color-background-surface-tertiary: var(--bgColor-inset);
  --color-background-elevated: var(--overlay-bgColor);
  --color-background-inset: var(--bgColor-inset);
  --color-background-hover: var(--control-transparent-bgColor-hover);
  --color-background-active: var(--control-transparent-bgColor-active);
  --color-background-selected: var(--bgColor-accent-muted);
  --color-background-accent: var(--bgColor-accent-emphasis);
  --color-background-danger: var(--bgColor-danger-muted);
  --color-background-success: var(--bgColor-success-muted);
  --color-background-warning: var(--bgColor-attention-muted);

  --color-text-primary: var(--fgColor-default);
  --color-text-secondary: var(--fgColor-muted);
  --color-text-tertiary: var(--fgColor-muted);
  --color-text-muted: var(--fgColor-muted);
  --color-text-disabled: var(--fgColor-disabled);
  --color-text-info: var(--fgColor-accent);
  --color-text-accent: var(--fgColor-accent);
  --color-text-link: var(--fgColor-link);
  --color-text-danger: var(--fgColor-danger);
  --color-text-success: var(--fgColor-success);
  --color-text-warning: var(--fgColor-attention);
  --color-text-on-emphasis: var(--fgColor-onEmphasis);

  --color-border-default: var(--borderColor-default);
  --color-border-subtle: var(--borderColor-muted);
  --color-border-muted: var(--borderColor-muted);
  --color-border-strong: var(--borderColor-emphasis);
  --color-border-accent: var(--borderColor-accent-emphasis);
  --color-border-danger: var(--borderColor-danger-emphasis);

  /* Codex Desktop --color-token-* variables */
  --color-token-bg-primary: var(--bgColor-inset);
  --color-token-bg-secondary: var(--bgColor-default);
  --color-token-bg-tertiary: var(--bgColor-muted);
  --color-token-bg-elevated: var(--overlay-bgColor);
  --color-token-side-bar-background: var(--bgColor-default);
  --color-token-editor-background: var(--bgColor-inset);
  --color-token-input-background: var(--bgColor-default);
  --color-token-dropdown-background: var(--overlay-bgColor);
  --color-token-list-hover-background: var(--control-transparent-bgColor-hover);
  --color-token-list-active-background: var(--control-transparent-bgColor-selected);
  --color-token-text-primary: var(--fgColor-default);
  --color-token-text-secondary: var(--fgColor-muted);
  --color-token-text-tertiary: var(--fgColor-muted);
  --color-token-border: var(--borderColor-default);
  --color-token-border-light: var(--borderColor-muted);
  --color-token-focus-border: var(--focus-outlineColor);
  --color-token-accent: var(--bgColor-accent-emphasis);
  --color-token-button-background: var(--button-primary-bgColor-rest);
  --color-token-button-hover-background: var(--button-primary-bgColor-hover);
  --color-token-button-foreground: var(--button-primary-fgColor-rest);
  --color-token-diff-added-background: var(--diffBlob-additionLine-bgColor);
  --color-token-diff-removed-background: var(--diffBlob-deletionLine-bgColor);

  /* codexhost Settings shell & extension page variables */
  --settings-bg: var(--bgColor-default);
  --settings-sidebar: var(--bgColor-inset);
  --settings-panel: var(--bgColor-default);
  --settings-surface: var(--bgColor-muted);
  --settings-surface-hover: var(--control-bgColor-hover);
  --settings-inset: var(--bgColor-inset);
  --settings-text: var(--fgColor-default);
  --settings-muted: var(--fgColor-muted);
  --settings-subtle: var(--fgColor-muted);
  --settings-border: var(--borderColor-default);
  --settings-divider: var(--borderColor-muted);
  --settings-hover: var(--control-transparent-bgColor-hover);
  --settings-active: var(--control-transparent-bgColor-active);
  --settings-focus: var(--focus-outlineColor);
  --settings-primary: var(--button-primary-bgColor-rest);
  --settings-primary-hover: var(--button-primary-bgColor-hover);
  --settings-primary-text: var(--button-primary-fgColor-rest);
  --settings-warning: var(--fgColor-attention);
  --settings-warning-bg: var(--bgColor-attention-muted);
  --settings-warning-border: var(--borderColor-attention-muted);
  --settings-danger: var(--fgColor-danger);
  --settings-danger-bg: var(--bgColor-danger-muted);
  --settings-danger-border: var(--borderColor-danger-muted);
  --settings-success: var(--fgColor-success);

  /* Standard codexhost extension surface variables */
  --cx-page-bg: var(--bgColor-default);
  --cx-page-surface: var(--bgColor-muted);
  --cx-page-text: var(--fgColor-default);
  --cx-page-text-muted: var(--fgColor-muted);
  --cx-page-border: var(--borderColor-default);
  --cx-page-accent: var(--fgColor-accent);
  --cx-page-danger: var(--fgColor-danger);
  --cx-page-radius: 6px;

  /* Syntax highlighting (Shiki / PrettyLights alignment) */
  --shiki-foreground: var(--fgColor-default);
  --shiki-background: var(--bgColor-muted);
  --shiki-token-constant: var(--prettylights-syntax-constant);
  --shiki-token-string: var(--prettylights-syntax-string);
  --shiki-token-comment: var(--prettylights-syntax-comment);
  --shiki-token-keyword: var(--prettylights-syntax-keyword);
  --shiki-token-parameter: var(--prettylights-syntax-variable);
  --shiki-token-function: var(--prettylights-syntax-entity);
  --shiki-token-string-expression: var(--prettylights-syntax-entity-tag);
  --shiki-token-punctuation: var(--fgColor-default);
  --shiki-token-link: var(--fgColor-link);

  background-color: var(--bgColor-default);
  color: var(--fgColor-default);
}

${active} ::selection {
  background: var(--selection-bgColor);
}

${active} ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

${active} ::-webkit-scrollbar-track {
  background: transparent;
}

${active} ::-webkit-scrollbar-thumb {
  background: var(--borderColor-default);
  border-radius: 999px;
}

${active} ::-webkit-scrollbar-thumb:hover {
  background: var(--fgColor-muted);
}
`;

  return `${header}\n${themeBlocks}\n${mapping}`;
}

function buildSharedModule(variants) {
  return `// Auto-generated from GitHub's official @primer/primitives@${PRIMER_VERSION} (${PRIMER_REPO})
// Run \`node scripts/sync-primer-themes.mjs\` to refresh from upstream.

export const EXTENSION_ID = ${JSON.stringify(EXTENSION_ID)};

export const PRIMER_SOURCE = Object.freeze({
  repository: ${JSON.stringify(PRIMER_REPO)},
  packageName: "@primer/primitives",
  version: ${JSON.stringify(PRIMER_VERSION)},
  cdnBase: ${JSON.stringify(PRIMER_CDN_BASE)},
  license: "MIT",
});

export const DEFAULT_SETTINGS = Object.freeze({
  themeMode: "single",
  singleTheme: "dark_dimmed",
  lightTheme: "light",
  darkTheme: "dark_dimmed",
  increaseContrast: false,
  showWidget: true,
});

export const BASE_THEMES = Object.freeze(${JSON.stringify(BASE_THEMES, null, 2)});

export const LIGHT_BASE_THEMES = Object.freeze(
  BASE_THEMES.filter((item) => item.scheme === "light"),
);

export const DARK_BASE_THEMES = Object.freeze(
  BASE_THEMES.filter((item) => item.scheme === "dark"),
);

export const THEME_VARIANTS = Object.freeze(${JSON.stringify(variants, null, 2)});

export const ALL_MARKERS = Object.freeze([
  "gh-active",
  "gh-scheme-light",
  "gh-scheme-dark",
  ...Object.values(THEME_VARIANTS).map((item) => item.marker),
]);

const BASE_THEME_IDS = new Set(BASE_THEMES.map((item) => item.id));
const LIGHT_THEME_IDS = new Set(LIGHT_BASE_THEMES.map((item) => item.id));
const DARK_THEME_IDS = new Set(DARK_BASE_THEMES.map((item) => item.id));

export function normalizeSettings(raw) {
  const input = raw && typeof raw === "object" ? raw : {};
  const themeMode = input.themeMode === "auto" ? "auto" : "single";
  const singleTheme = BASE_THEME_IDS.has(input.singleTheme)
    ? input.singleTheme
    : DEFAULT_SETTINGS.singleTheme;
  const lightTheme = LIGHT_THEME_IDS.has(input.lightTheme)
    ? input.lightTheme
    : DEFAULT_SETTINGS.lightTheme;
  const darkTheme = DARK_THEME_IDS.has(input.darkTheme)
    ? input.darkTheme
    : DEFAULT_SETTINGS.darkTheme;
  const increaseContrast = Boolean(input.increaseContrast);
  const showWidget = input.showWidget !== false;
  return {
    themeMode,
    singleTheme,
    lightTheme,
    darkTheme,
    increaseContrast,
    showWidget,
  };
}

export function getBaseTheme(baseId) {
  return BASE_THEMES.find((item) => item.id === baseId) ?? BASE_THEMES[0];
}

export function getThemeVariant(baseId, increaseContrast = false) {
  const key = increaseContrast ? \`\${baseId}_high_contrast\` : baseId;
  return THEME_VARIANTS[key] ?? THEME_VARIANTS.dark_dimmed;
}

export function resolveEffectiveTheme(rawSettings, hostColorScheme = "dark") {
  const settings = normalizeSettings(rawSettings);
  const scheme = hostColorScheme === "light" ? "light" : "dark";
  const baseId =
    settings.themeMode === "auto"
      ? scheme === "light"
        ? settings.lightTheme
        : settings.darkTheme
      : settings.singleTheme;
  const base = getBaseTheme(baseId);
  const variant = getThemeVariant(base.id, settings.increaseContrast);
  return { settings, base, variant };
}

export function pickText(localized, locale) {
  if (!localized) return "";
  if (typeof localized === "string") return localized;
  return String(locale || "").toLowerCase().startsWith("zh")
    ? localized["zh-CN"] || localized.en
    : localized.en || localized["zh-CN"];
}
`;
}

async function main() {
  const variantMap = new Map();
  for (const base of BASE_THEMES) {
    for (const fileStem of [base.file, base.hcFile]) {
      const cssText = await readOfficialPrimerCss(fileStem);
      const tokens = parsePrimerTokens(cssText);
      const sha256 = createHash("sha256").update(cssText).digest("hex");
      variantMap.set(fileStem, { tokens, sha256 });
    }
  }

  const variants = buildVariantRecords(variantMap);

  mkdirSync(path.join(ROOT, "shared"), { recursive: true });
  mkdirSync(path.join(ROOT, "web"), { recursive: true });
  mkdirSync(path.join(ROOT, "desktop"), { recursive: true });

  const sharedMjs = buildSharedModule(variants);
  const webCss = buildWebCss(variants);
  const desktopCss = buildDesktopCss(variants);

  writeFileSync(path.join(ROOT, "shared/primer-themes.mjs"), sharedMjs, "utf8");
  writeFileSync(path.join(ROOT, "web/style.css"), webCss, "utf8");
  writeFileSync(path.join(ROOT, "desktop/style.css"), desktopCss, "utf8");

  console.log(`Synced ${variantMap.size} official @primer/primitives@${PRIMER_VERSION} themes.`);
  console.log(`  shared/primer-themes.mjs : ${(Buffer.byteLength(sharedMjs) / 1024).toFixed(1)} KiB`);
  console.log(`  web/style.css            : ${(Buffer.byteLength(webCss) / 1024).toFixed(1)} KiB`);
  console.log(`  desktop/style.css        : ${(Buffer.byteLength(desktopCss) / 1024).toFixed(1)} KiB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

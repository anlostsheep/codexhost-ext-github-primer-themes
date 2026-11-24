#!/usr/bin/env node
/**
 * Generate crisp PNG assets for github-primer-themes:
 *   - assets/icon.png (256x256 via rsvg-convert)
 *   - assets/preview-dark.png, assets/preview-light.png, assets/preview-widget.png
 *     rendered directly from the real page/index.mjs, widget/index.mjs, and web/style.css
 *     in headless Chrome.
 */
import { execFile, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

function generateIcon() {
  mkdirSync(ASSETS_DIR, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <clipPath id="r"><rect x="12" y="12" width="232" height="232" rx="52"/></clipPath>
  </defs>
  <g clip-path="url(#r)">
    <!-- Split Soft Dark (#212830) and Light Default (#ffffff) -->
    <rect x="12" y="12" width="232" height="232" fill="#0d1117"/>
    <polygon points="12,12 244,12 12,244" fill="#212830"/>
    <polygon points="244,12 244,244 12,244" fill="#0d1117"/>
    <!-- Subtle diagonal divider -->
    <line x1="244" y1="12" x2="12" y2="244" stroke="#3d444d" stroke-width="3"/>
    <!-- Official Primer color dots at bottom right -->
    <circle cx="182" cy="196" r="11" fill="#1f883d"/>
    <circle cx="212" cy="196" r="11" fill="#4493f8"/>
    <circle cx="152" cy="196" r="11" fill="#d1d7e0"/>
    <!-- Octocat silhouette centered -->
    <g transform="translate(56, 46) scale(9)">
      <path fill="#f0f6fc" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
    </g>
  </g>
  <rect x="13" y="13" width="230" height="230" rx="51" fill="none" stroke="#3d444d" stroke-width="3"/>
</svg>`;
  const tmpSvg = path.join(ASSETS_DIR, ".icon.tmp.svg");
  const outPng = path.join(ASSETS_DIR, "icon.png");
  writeFileSync(tmpSvg, svg, "utf8");
  execFileSync("rsvg-convert", ["-w", "256", "-h", "256", tmpSvg, "-o", outPng]);
  unlinkSync(tmpSvg);
  console.log(`Generated assets/icon.png (${(statSync(outPng).size / 1024).toFixed(1)} KiB)`);
}

function makeHarnessHtml({ settings, locale = "en", openWidget = false, hostDark = true }) {
  const settingsJson = JSON.stringify(settings);
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="stylesheet" href="/web/style.css"/>
  <link rel="stylesheet" href="/page/style.css"/>
  <link rel="stylesheet" href="/widget/style.css"/>
  <style>
    html, body { margin: 0; padding: 0; min-height: 100vh; }
    body { background: var(--bgColor-default, #0d1117); color: var(--fgColor-default, #f0f6fc); }
    #page-host { width: 100%; }
  </style>
</head>
<body${hostDark ? ' data-ds-dark-theme=""' : ""}>
  <div id="page-host"></div>
  <div id="widget-host"></div>
  <script type="module">
    import { activate } from "/web/index.mjs";
    import { mount as mountPage } from "/page/index.mjs";
    import { mount as mountWidget } from "/widget/index.mjs";

    let state = ${settingsJson};
    const listeners = new Set();
    const ac = new AbortController();

    const storage = {
      async get() { return structuredClone(state); },
      async set(next) {
        state = structuredClone(next);
        for (const fn of listeners) fn(structuredClone(state));
        return structuredClone(state);
      },
      onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    };

    const webApi = {
      id: "github-primer-themes",
      apiVersion: 1,
      signal: ac.signal,
      dom: {
        mark(el, name) { el.setAttribute("data-cx-ext-github-primer-themes-" + name, ""); },
        unmark(el, name) { el.removeAttribute("data-cx-ext-github-primer-themes-" + name); },
      },
      storage,
      track() {},
    };

    const pageApi = {
      id: "github-primer-themes",
      apiVersion: 1,
      hostTarget: "web",
      locale: ${JSON.stringify(locale)},
      onLocaleChange() { return () => {}; },
      colorScheme: ${JSON.stringify(hostDark ? "dark" : "light")},
      onColorSchemeChange() { return () => {}; },
      signal: ac.signal,
      assets: { async url(p) { return "/" + p; } },
      storage,
      backend: { async invoke() { throw new Error("No backend"); } },
    };

    await activate(webApi);
    await mountPage(document.getElementById("page-host"), pageApi);
    if (${JSON.stringify(openWidget)}) {
      await mountWidget(document.getElementById("widget-host"), pageApi);
      const trigger = document.querySelector(".ghw-capsule");
      if (trigger) trigger.click();
    }
  </script>
</body>
</html>`;
}

async function generateScreenshots() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/render-dark") {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(
        makeHarnessHtml({
          settings: {
            themeMode: "single",
            singleTheme: "dark_dimmed",
            lightTheme: "light",
            darkTheme: "dark_dimmed",
            increaseContrast: false,
            showWidget: false,
          },
          locale: "en",
          openWidget: false,
        }),
      );
      return;
    }
    if (url.pathname === "/render-light") {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(
        makeHarnessHtml({
          settings: {
            themeMode: "single",
            singleTheme: "light",
            lightTheme: "light",
            darkTheme: "dark",
            increaseContrast: false,
            showWidget: false,
          },
          locale: "zh-CN",
          openWidget: false,
          hostDark: false,
        }),
      );
      return;
    }
    if (url.pathname === "/render-widget") {
      res.writeHead(200, { "Content-Type": MIME[".html"] });
      res.end(
        makeHarnessHtml({
          settings: {
            themeMode: "auto",
            singleTheme: "dark",
            lightTheme: "light",
            darkTheme: "dark",
            increaseContrast: true,
            showWidget: true,
          },
          locale: "zh-CN",
          openWidget: true,
          hostDark: true,
        }),
      );
      return;
    }

    const rel = url.pathname.replace(/^\/+/, "");
    const full = path.resolve(ROOT, rel);
    if (!full.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    try {
      const data = readFileSync(full);
      const ext = path.extname(full);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  const targets = [
    { route: "/render-dark", out: "preview-dark.png", width: 1024, height: 1260 },
    { route: "/render-light", out: "preview-light.png", width: 1024, height: 1260 },
    { route: "/render-widget", out: "preview-widget.png", width: 1024, height: 780 },
  ];

  try {
    for (const item of targets) {
      const outPath = path.join(ASSETS_DIR, item.out);
      const url = `http://127.0.0.1:${port}${item.route}`;
      await execFileAsync(
        "playwright",
        [
          "screenshot",
          "--browser=chromium",
          `--viewport-size=${item.width},${item.height}`,
          "--wait-for-timeout=400",
          url,
          outPath,
        ],
        { timeout: 20_000 },
      );
      console.log(`Generated assets/${item.out} (${(statSync(outPath).size / 1024).toFixed(1)} KiB)`);
    }
  } finally {
    server.close();
  }
}

generateIcon();
await generateScreenshots();

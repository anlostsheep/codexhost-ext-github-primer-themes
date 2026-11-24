import {
  BASE_THEMES,
  DARK_BASE_THEMES,
  LIGHT_BASE_THEMES,
  PRIMER_SOURCE,
  getThemeVariant,
  normalizeSettings,
  pickText,
  resolveEffectiveTheme,
} from "../shared/primer-themes.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

const COPY = {
  en: {
    title: "Theme preferences",
    subtitle:
      "Choose how GitHub looks to you. Select a single theme, or sync with your system and automatically switch between day and night themes. Selections are applied immediately and saved automatically.",
    sourceLabel: "Official GitHub Primer CSS",
    themeMode: "Theme mode",
    modeSingle: "Single theme",
    modeAuto: "Sync with system",
    hintSingle: "GitHub will use your selected theme across Codex Desktop and CH Web.",
    hintAuto: "Automatically switch between your Day (Light) and Night (Dark) GitHub themes.",
    activePrefix: "Active:",
    dayGroup: "Day theme (Light mode)",
    dayNote: "Used when your host or system is in Light mode",
    nightGroup: "Night theme (Dark mode)",
    nightNote: "Used when your host or system is in Dark mode",
    contrastSection: "Contrast",
    increaseContrastTitle: "Increase contrast",
    increaseContrastDesc:
      "Enable high contrast for light or dark mode (or both) using GitHub's official *-high-contrast.css Primer themes.",
    widgetTitle: "Quick theme switcher widget",
    widgetDesc:
      "Show the compact floating GitHub theme capsule in the main Codex Desktop and CH Web workspace.",
    off: "Off",
    on: "On",
    previewSection: "Live Primer UI Preview",
    inspectorTitle: "Official Primer CSS Tokens",
    inspectorCount: (n) => `${n} tokens`,
    searchPlaceholder: "Filter official Primer tokens (e.g. bgColor, diffBlob, prettylights)...",
    saved: "Saved and applied.",
    saveFailed: "Failed to save theme preference.",
  },
  "zh-CN": {
    title: "主题偏好设置 (Theme preferences)",
    subtitle:
      "完整还原 GitHub 官方外观主题。可固定使用单一主题，或跟随系统在日间浅色与夜间深色主题间自动切换；点击后立即生效并跨端自动保存。",
    sourceLabel: "GitHub 官方 Primer CSS",
    themeMode: "主题模式",
    modeSingle: "单一主题 (Single theme)",
    modeAuto: "跟随系统 (Sync with system)",
    hintSingle: "在 Codex Desktop 与 CH Web 中统一应用所选的 GitHub 官方主题。",
    hintAuto: "根据当前浅色/深色模式自动在日间浅色主题与夜间深色主题之间切换。",
    activePrefix: "当前生效：",
    dayGroup: "日间浅色主题 (Day theme)",
    dayNote: "浅色模式下使用的 3 套 GitHub 官方浅色主题",
    nightGroup: "夜间深色主题 (Night theme)",
    nightNote: "深色模式下使用的 4 套 GitHub 官方深色主题（含 Soft dark）",
    contrastSection: "对比度 (Contrast)",
    increaseContrastTitle: "增强对比度 (Increase contrast)",
    increaseContrastDesc:
      "为浅色与深色模式启用 GitHub 官方高对比度样式（*-high-contrast.css），增强文字与边框锐度。",
    widgetTitle: "主页面悬浮速切挂件",
    widgetDesc:
      "在 Codex Desktop 与 CH Web 主界面边缘显示轻量 GitHub 主题速切胶囊。",
    off: "关",
    on: "开",
    previewSection: "实时 GitHub Primer 组件预览",
    inspectorTitle: "官方 Primer CSS Token 检查器",
    inspectorCount: (n) => `共 ${n} 项官方变量`,
    searchPlaceholder: "搜索官方 Primer 变量（如 bgColor、diffBlob、prettylights）...",
    saved: "已保存并实时同步。",
    saveFailed: "保存主题设置失败。",
  },
};

function getCopy(locale) {
  return String(locale || "").toLowerCase().startsWith("zh") ? COPY["zh-CN"] : COPY.en;
}

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (tag === "button") node.type = "button";
  return node;
}

function createSvgIcon(doc, className, viewBox, paths) {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("aria-hidden", "true");
  for (const attrs of paths) {
    const p = doc.createElementNS(SVG_NS, "path");
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    svg.append(p);
  }
  return svg;
}

const OCTOCAT_PATH =
  "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z";

const SUN_PATH =
  "M8 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm5.657-8.157a.75.75 0 0 1 0 1.061l-1.061 1.06a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.06-1.06a.75.75 0 0 1 1.06 0Zm-9.193 9.193a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 1 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8Zm13 0a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8Zm-8 5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13Zm3.536-1.464a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061ZM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-1.06-1.06a.75.75 0 0 1 0-1.06Z";

const MOON_PATH =
  "M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.499 5.499 0 1 0 7.678-7.678Z";

function applyPreviewVars(node, preview) {
  node.style.setProperty("--m-canvas", preview.canvas);
  node.style.setProperty("--m-muted", preview.muted);
  node.style.setProperty("--m-border", preview.border);
  node.style.setProperty("--m-border-muted", preview.borderMuted);
  node.style.setProperty("--m-accent", preview.accent);
  node.style.setProperty("--m-bar-bg", preview.barBg);
  node.style.setProperty("--m-bar-fill", preview.barFill);
  node.style.setProperty("--m-dot-a", preview.dotA);
  node.style.setProperty("--m-dot-b", preview.dotB);
}

function createThemeCard(doc, baseTheme, variant, isSelected, locale, onSelect) {
  const card = el(doc, "button", "ghp-card");
  card.setAttribute("role", "radio");
  card.setAttribute("aria-checked", String(isSelected));
  card.dataset.selected = String(isSelected);
  card.dataset.themeId = baseTheme.id;

  const mini = el(doc, "div", "ghp-mini");
  applyPreviewVars(mini, variant.preview);

  const topbar = el(doc, "div", "ghp-mini-topbar");
  const pills = el(doc, "div", "ghp-mini-pills");
  pills.append(
    el(doc, "span", "ghp-mini-pill ghp-mini-pill--a"),
    el(doc, "span", "ghp-mini-pill ghp-mini-pill--b"),
    el(doc, "span", "ghp-mini-pill ghp-mini-pill--c"),
  );
  topbar.append(pills);
  if (baseTheme.beta) {
    topbar.append(el(doc, "span", "ghp-mini-beta", "Beta"));
  }

  const miniBody = el(doc, "div", "ghp-mini-body");
  const miniRow = el(doc, "div", "ghp-mini-row");
  const dots = el(doc, "div", "ghp-mini-dots");
  dots.append(
    el(doc, "span", "ghp-mini-dot ghp-mini-dot--a"),
    el(doc, "span", "ghp-mini-dot ghp-mini-dot--b"),
  );
  miniRow.append(el(doc, "span", "ghp-mini-heading"), dots);

  const miniContent = el(doc, "div", "ghp-mini-content");
  const box = el(doc, "div", "ghp-mini-box");
  const barWrap = el(doc, "div", "ghp-mini-bar-wrap");
  barWrap.append(el(doc, "div", "ghp-mini-bar"));
  box.append(barWrap, el(doc, "div", "ghp-mini-lines"));
  miniContent.append(box, el(doc, "div", "ghp-mini-side"));

  miniBody.append(miniRow, miniContent);
  mini.append(topbar, miniBody);

  const body = el(doc, "div", "ghp-card-body");
  const head = el(doc, "div", "ghp-card-head");
  head.append(
    el(doc, "span", "ghp-radio"),
    el(doc, "span", "ghp-card-name", pickText(baseTheme.name, locale)),
  );
  const desc = el(doc, "p", "ghp-card-desc", pickText(baseTheme.description, locale));
  body.append(head, desc);

  card.append(mini, body);
  card.addEventListener("click", () => onSelect(baseTheme.id));
  return card;
}

function buildSpecimen(doc, baseTheme, variant) {
  const p = variant.preview;
  const wrap = el(doc, "div", "ghp-specimen");
  wrap.style.setProperty("--s-canvas", p.canvas);
  wrap.style.setProperty("--s-muted", p.muted);
  wrap.style.setProperty("--s-border", p.border);
  wrap.style.setProperty("--s-text", p.text);
  wrap.style.setProperty("--s-text-muted", p.textMuted);
  wrap.style.setProperty("--s-btn-primary-bg", p.btnPrimaryBg);
  wrap.style.setProperty("--s-btn-primary-fg", p.btnPrimaryFg);
  wrap.style.setProperty("--s-btn-default-bg", p.btnDefaultBg);
  wrap.style.setProperty("--s-btn-default-fg", p.btnDefaultFg);
  wrap.style.setProperty("--s-btn-default-border", p.btnDefaultBorder);
  wrap.style.setProperty("--s-done-bg", p.doneBg);
  wrap.style.setProperty("--s-diff-add-bg", p.diffAddBg);
  wrap.style.setProperty("--s-diff-add-num", p.diffAddNumBg);
  wrap.style.setProperty("--s-diff-del-bg", p.diffDelBg);
  wrap.style.setProperty("--s-diff-del-num", p.diffDelNumBg);
  wrap.style.setProperty("--s-syn-kw", p.syntaxKeyword);
  wrap.style.setProperty("--s-syn-fn", p.syntaxEntity);
  wrap.style.setProperty("--s-syn-str", p.syntaxString);
  wrap.style.setProperty("--s-syn-cm", p.syntaxComment);
  wrap.style.setProperty("--s-syn-cn", p.syntaxConstant);

  const head = el(doc, "div", "ghp-specimen-head");
  const repo = el(doc, "div", "ghp-specimen-repo");
  repo.append(
    el(doc, "span", "", `primer / primitives · ${variant.cssFile.split("/").pop()}`),
    el(doc, "span", "ghp-specimen-pill", "Open"),
    el(doc, "span", "ghp-specimen-pill ghp-specimen-pill--done", "Merged"),
  );
  const actions = el(doc, "div", "ghp-specimen-actions");
  actions.append(
    el(doc, "span", "ghp-specimen-btn", baseTheme.scheme === "dark" ? "Dark" : "Light"),
    el(doc, "span", "ghp-specimen-btn ghp-specimen-btn--primary", "Apply Theme"),
  );
  head.append(repo, actions);

  const body = el(doc, "div", "ghp-specimen-body");

  // Left: PrettyLights syntax preview
  const codePane = el(doc, "div", "ghp-code-pane");
  const lines = [
    [["ghp-tok-cm", `// @primer/primitives@${PRIMER_SOURCE.version}`]],
    [
      ["ghp-tok-kw", "export const "],
      ["ghp-tok-cn", "theme"],
      ["", " = "],
      ["ghp-tok-fn", "loadPrimerTheme"],
      ["", "("],
      ["ghp-tok-str", `"${variant.id}"`],
      ["", ");"],
    ],
    [
      ["ghp-tok-kw", "const "],
      ["ghp-tok-cn", "canvas"],
      ["", " = "],
      ["ghp-tok-str", `"${p.canvas}"`],
      ["", ";"],
    ],
    [
      ["ghp-tok-kw", "const "],
      ["ghp-tok-cn", "accent"],
      ["", " = "],
      ["ghp-tok-str", `"${p.accent}"`],
      ["", ";"],
    ],
  ];
  for (const parts of lines) {
    const lineEl = el(doc, "div");
    for (const [cls, txt] of parts) {
      lineEl.append(el(doc, "span", cls, txt));
    }
    codePane.append(lineEl);
  }

  // Right: Official GitHub diffBlob preview
  const diffPane = el(doc, "div", "ghp-diff-pane");
  const diffRows = [
    ["11", " ", "  --bgColor-default: var(--primer-canvas);"],
    ["12", "-", `- --color-bg: ${p.muted};`],
    ["12", "+", `+ --bgColor-default: ${p.canvas};`],
    ["13", "+", `+ --borderColor-default: ${p.border};`],
  ];
  for (const [num, kind, text] of diffRows) {
    const row = el(
      doc,
      "div",
      `ghp-diff-line${kind === "+" ? " ghp-diff-line--add" : kind === "-" ? " ghp-diff-line--del" : ""}`,
    );
    row.append(el(doc, "span", "ghp-diff-num", num), el(doc, "span", "ghp-diff-code", text));
    diffPane.append(row);
  }

  body.append(codePane, diffPane);
  wrap.append(head, body);
  return wrap;
}

export async function mount(root, api) {
  const doc = root.ownerDocument;
  let locale = api.locale;
  let hostScheme = api.colorScheme;
  let settings = normalizeSettings(await api.storage.get().catch(() => ({})));
  let tokenFilter = "";
  let inspectorOpen = false;
  let statusText = "";
  let statusTimer = null;

  const container = el(doc, "div", "ghp-root");
  root.replaceChildren(container);

  const showStatus = (msg) => {
    statusText = msg;
    const statusEl = container.querySelector(".ghp-status");
    if (statusEl) statusEl.textContent = statusText;
    if (statusTimer) clearTimeout(statusTimer);
    if (msg) {
      statusTimer = setTimeout(() => {
        statusText = "";
        const target = container.querySelector(".ghp-status");
        if (target) target.textContent = "";
      }, 2400);
    }
  };

  const savePatch = async (patch) => {
    const next = normalizeSettings({ ...settings, ...patch });
    settings = next;
    render();
    try {
      const saved = await api.storage.set(next);
      settings = normalizeSettings(saved);
      showStatus(getCopy(locale).saved);
    } catch {
      showStatus(getCopy(locale).saveFailed);
    }
  };

  function createToggleCard(title, desc, checked, onToggle, copy) {
    const card = el(doc, "div", "ghp-setting-card");
    const copyCol = el(doc, "div", "ghp-setting-copy");
    copyCol.append(
      el(doc, "div", "ghp-setting-name", title),
      el(doc, "p", "ghp-setting-desc", desc),
    );

    const wrap = el(doc, "div", "ghp-switch-wrap");
    const stateLabel = el(doc, "span", "ghp-switch-state", checked ? copy.on : copy.off);
    const btn = el(doc, "button", "ghp-switch");
    btn.setAttribute("role", "switch");
    btn.setAttribute("aria-checked", String(checked));
    btn.setAttribute("aria-label", title);
    btn.append(el(doc, "span", "ghp-switch-knob"));
    btn.addEventListener("click", () => onToggle(!checked));
    wrap.append(stateLabel, btn);

    card.append(copyCol, wrap);
    return card;
  }

  function renderTokenRows(listEl, tokens, query) {
    listEl.replaceChildren();
    const q = query.trim().toLowerCase();
    for (const [key, val] of Object.entries(tokens)) {
      if (q && !key.toLowerCase().includes(q) && !val.toLowerCase().includes(q)) continue;
      const row = el(doc, "div", "ghp-token-row");
      const nameEl = el(doc, "span", "", key);
      const valWrap = el(doc, "span", "ghp-token-val");
      if (/^#[0-9a-f]{3,8}$/iu.test(val) || /^rgba?\(/iu.test(val)) {
        const chip = el(doc, "span", "ghp-chip");
        chip.style.background = val;
        valWrap.append(chip);
      }
      valWrap.append(el(doc, "span", "", val));
      row.append(nameEl, valWrap);
      listEl.append(row);
    }
  }

  function render() {
    if (api.signal.aborted) return;
    const copy = getCopy(locale);
    const { base: activeBase, variant: activeVariant } = resolveEffectiveTheme(
      settings,
      hostScheme,
    );

    container.replaceChildren();

    // Header
    const header = el(doc, "header", "ghp-header");
    const leftHead = el(doc, "div");
    const titleRow = el(doc, "div", "ghp-title-row");
    titleRow.append(
      createSvgIcon(doc, "ghp-octocat", "0 0 16 16", [{ d: OCTOCAT_PATH, fill: "currentColor" }]),
      el(doc, "h1", "ghp-title", copy.title),
    );
    leftHead.append(titleRow, el(doc, "p", "ghp-subtitle", copy.subtitle));

    const sourceLink = el(doc, "a", "ghp-source-pill");
    sourceLink.href = PRIMER_SOURCE.repository;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.append(
      el(doc, "span", "ghp-source-dot"),
      el(doc, "span", "", `${copy.sourceLabel} · v${PRIMER_SOURCE.version}`),
    );
    header.append(leftHead, sourceLink);
    container.append(header);

    // Theme mode bar
    const modeBar = el(doc, "div", "ghp-mode-bar");
    const modeGroup = el(doc, "div", "ghp-mode-group");
    const modeLabel = el(doc, "label", "ghp-label", copy.themeMode);
    modeLabel.htmlFor = "ghp-theme-mode";
    const modeRow = el(doc, "div", "ghp-mode-row");

    const modeSelect = el(doc, "select", "ghp-select");
    modeSelect.id = "ghp-theme-mode";
    const optSingle = el(doc, "option", "", copy.modeSingle);
    optSingle.value = "single";
    const optAuto = el(doc, "option", "", copy.modeAuto);
    optAuto.value = "auto";
    modeSelect.append(optSingle, optAuto);
    modeSelect.value = settings.themeMode;
    modeSelect.addEventListener("change", () => {
      void savePatch({ themeMode: modeSelect.value === "auto" ? "auto" : "single" });
    });

    const modeHint = el(
      doc,
      "span",
      "ghp-mode-hint",
      settings.themeMode === "auto" ? copy.hintAuto : copy.hintSingle,
    );
    modeRow.append(modeSelect, modeHint);
    modeGroup.append(modeLabel, modeRow);

    const activeBadge = el(doc, "div", "ghp-active-badge");
    const dot = el(doc, "span", "ghp-swatch-dot");
    dot.style.background = activeVariant.preview.canvas;
    activeBadge.append(
      dot,
      el(doc, "span", "", copy.activePrefix),
      el(
        doc,
        "strong",
        "",
        `${pickText(activeBase.name, locale)}${settings.increaseContrast ? " · HC" : ""}`,
      ),
    );
    modeBar.append(modeGroup, activeBadge);
    container.append(modeBar);

    // Theme Cards Grid
    if (settings.themeMode === "single") {
      const grid = el(doc, "div", "ghp-grid");
      grid.setAttribute("role", "radiogroup");
      grid.setAttribute("aria-label", copy.themeMode);
      for (const theme of BASE_THEMES) {
        const variant = getThemeVariant(theme.id, settings.increaseContrast);
        const selected = settings.singleTheme === theme.id;
        grid.append(
          createThemeCard(doc, theme, variant, selected, locale, (id) => {
            void savePatch({ singleTheme: id });
          }),
        );
      }
      container.append(grid);
    } else {
      // Sync with system: Day (Light) + Night (Dark) groups
      const daySection = el(doc, "section", "ghp-group");
      const dayHead = el(doc, "div", "ghp-group-header");
      dayHead.append(
        createSvgIcon(doc, "ghp-group-icon", "0 0 16 16", [{ d: SUN_PATH, fill: "currentColor" }]),
        el(doc, "h2", "ghp-group-title", copy.dayGroup),
        el(doc, "span", "ghp-group-note", copy.dayNote),
      );
      const dayGrid = el(doc, "div", "ghp-grid");
      dayGrid.setAttribute("role", "radiogroup");
      dayGrid.setAttribute("aria-label", copy.dayGroup);
      for (const theme of LIGHT_BASE_THEMES) {
        const variant = getThemeVariant(theme.id, settings.increaseContrast);
        dayGrid.append(
          createThemeCard(doc, theme, variant, settings.lightTheme === theme.id, locale, (id) => {
            void savePatch({ lightTheme: id });
          }),
        );
      }
      daySection.append(dayHead, dayGrid);

      const nightSection = el(doc, "section", "ghp-group");
      const nightHead = el(doc, "div", "ghp-group-header");
      nightHead.append(
        createSvgIcon(doc, "ghp-group-icon", "0 0 16 16", [{ d: MOON_PATH, fill: "currentColor" }]),
        el(doc, "h2", "ghp-group-title", copy.nightGroup),
        el(doc, "span", "ghp-group-note", copy.nightNote),
      );
      const nightGrid = el(doc, "div", "ghp-grid");
      nightGrid.setAttribute("role", "radiogroup");
      nightGrid.setAttribute("aria-label", copy.nightGroup);
      for (const theme of DARK_BASE_THEMES) {
        const variant = getThemeVariant(theme.id, settings.increaseContrast);
        nightGrid.append(
          createThemeCard(doc, theme, variant, settings.darkTheme === theme.id, locale, (id) => {
            void savePatch({ darkTheme: id });
          }),
        );
      }
      nightSection.append(nightHead, nightGrid);
      container.append(daySection, nightSection);
    }

    // Contrast & Widget section
    container.append(el(doc, "h2", "ghp-section-title", copy.contrastSection));
    const settingList = el(doc, "div", "ghp-setting-list");
    settingList.append(
      createToggleCard(
        copy.increaseContrastTitle,
        copy.increaseContrastDesc,
        settings.increaseContrast,
        (nextVal) => void savePatch({ increaseContrast: nextVal }),
        copy,
      ),
      createToggleCard(
        copy.widgetTitle,
        copy.widgetDesc,
        settings.showWidget,
        (nextVal) => void savePatch({ showWidget: nextVal }),
        copy,
      ),
    );
    container.append(settingList);

    // Live Primer UI Specimen
    container.append(el(doc, "h2", "ghp-section-title", copy.previewSection));
    container.append(buildSpecimen(doc, activeBase, activeVariant));

    // Official Primer CSS Inspector
    const details = el(doc, "details", "ghp-details");
    details.open = inspectorOpen;
    details.addEventListener("toggle", () => {
      inspectorOpen = details.open;
    });
    const tokenCount = Object.keys(activeVariant.tokens).length;
    const summary = el(doc, "summary");
    summary.append(
      el(doc, "span", "", `${copy.inspectorTitle} · ${activeVariant.cssFile}`),
      el(doc, "span", "ghp-mode-hint", copy.inspectorCount(tokenCount)),
    );

    const inspectorBody = el(doc, "div", "ghp-inspector-body");
    const metaLine = el(doc, "div", "ghp-meta-line");
    metaLine.append(
      el(doc, "code", "", `${PRIMER_SOURCE.packageName}@${PRIMER_SOURCE.version}`),
      el(doc, "code", "", activeVariant.cssFile),
      el(doc, "code", "", `sha256:${activeVariant.sha256.slice(0, 16)}`),
    );

    const search = el(doc, "input", "ghp-search");
    search.type = "search";
    search.placeholder = copy.searchPlaceholder;
    search.value = tokenFilter;

    const tokenList = el(doc, "div", "ghp-token-list");
    renderTokenRows(tokenList, activeVariant.tokens, tokenFilter);
    search.addEventListener("input", () => {
      tokenFilter = search.value;
      renderTokenRows(tokenList, activeVariant.tokens, tokenFilter);
    });

    inspectorBody.append(metaLine, search, tokenList);
    details.append(summary, inspectorBody);
    container.append(details);

    const statusLine = el(doc, "div", "ghp-status", statusText);
    statusLine.setAttribute("role", "status");
    container.append(statusLine);
  }

  render();

  const stopLocale = api.onLocaleChange((nextLocale) => {
    locale = nextLocale;
    render();
  });
  const stopScheme = api.onColorSchemeChange((nextScheme) => {
    hostScheme = nextScheme;
    render();
  });
  const stopStorage = api.storage.onChange((nextValues) => {
    settings = normalizeSettings(nextValues);
    render();
  });

  return () => {
    if (statusTimer) clearTimeout(statusTimer);
    stopLocale();
    stopScheme();
    stopStorage();
    root.replaceChildren();
  };
}

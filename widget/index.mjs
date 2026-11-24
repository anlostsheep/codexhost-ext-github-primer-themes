import {
  DARK_BASE_THEMES,
  LIGHT_BASE_THEMES,
  PRIMER_SOURCE,
  getThemeVariant,
  normalizeSettings,
  pickText,
  resolveEffectiveTheme,
} from "../shared/primer-themes.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const POSITION_KEY = "codexhost.github-primer-themes.widget-pos.v2";
const DRAG_THRESHOLD = 6;
const TOP_SAFE_MARGIN = 64;
const BOTTOM_SAFE_MARGIN = 150;
const PANEL_GAP = 10;

const OCTOCAT_PATH =
  "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z";

const COPY = {
  en: {
    title: "GitHub Themes",
    single: "Single",
    auto: "Sync",
    lightGroup: "Light themes",
    darkGroup: "Dark themes",
    highContrast: "Increase contrast",
    on: "ON",
    off: "OFF",
    close: "Close",
    hide: "Hide floating button",
    triggerLabel: "Switch GitHub Primer theme (drag to reposition)",
  },
  "zh-CN": {
    title: "GitHub 主题速切",
    single: "单一主题",
    auto: "跟随系统",
    lightGroup: "浅色主题 (3)",
    darkGroup: "深色主题 (4)",
    highContrast: "增强对比度",
    on: "开",
    off: "关",
    close: "关闭",
    hide: "隐藏悬浮按钮",
    triggerLabel: "切换 GitHub 官方主题（可拖动贴边）",
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

function createOctocat(doc, className) {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", OCTOCAT_PATH);
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function readSavedPosition(win) {
  try {
    const raw = JSON.parse(win?.localStorage?.getItem(POSITION_KEY) || "null");
    if (
      raw &&
      (raw.dock === "left" || raw.dock === "right") &&
      typeof raw.yRatio === "number" &&
      Number.isFinite(raw.yRatio)
    ) {
      return { dock: raw.dock, yRatio: clamp(raw.yRatio, 0.08, 0.78) };
    }
  } catch {
    // Ignore storage access errors.
  }
  // Default: right edge at 36% viewport height — far above bottom composer & send button
  return { dock: "right", yRatio: 0.36 };
}

function savePosition(win, pos) {
  try {
    win?.localStorage?.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch {
    // Ignore storage quota/privacy errors.
  }
}

export async function mount(root, api) {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? globalThis.window;
  let locale = api.locale;
  let hostScheme = api.colorScheme;
  let settings = normalizeSettings(await api.storage.get().catch(() => ({})));
  let isOpen = false;
  let pos = readSavedPosition(win);

  const overlay = el(doc, "div", "ghw-overlay");
  root.replaceChildren(overlay);

  const savePatch = async (patch) => {
    const next = normalizeSettings({ ...settings, ...patch });
    settings = next;
    render();
    try {
      const saved = await api.storage.set(next);
      settings = normalizeSettings(saved);
      render();
    } catch {
      // Keep UI responsive even if host storage temporarily rejects.
    }
  };

  function makePalette(docRef, preview) {
    const pal = el(docRef, "span", "ghw-palette");
    // Use official [canvas, dotA, dotB] so dark colorblind shows [dark, blue, amber]
    // and dark tritanopia shows [dark, blue, red] instead of duplicate warm dots.
    for (const color of [preview.canvas, preview.dotA, preview.dotB]) {
      const dot = el(docRef, "span", "ghw-pdot");
      dot.style.background = color;
      pal.append(dot);
    }
    return pal;
  }

  function renderThemeGroup(title, themes, selectedId, onPick) {
    const section = el(doc, "div");
    section.append(el(doc, "div", "ghw-group-label", title));
    const list = el(doc, "div", "ghw-list");
    for (const theme of themes) {
      const variant = getThemeVariant(theme.id, settings.increaseContrast);
      const item = el(doc, "button", "ghw-item");
      item.dataset.active = String(selectedId === theme.id);
      const left = el(doc, "span", "ghw-item-left");
      left.append(
        makePalette(doc, variant.preview),
        el(doc, "span", "ghw-item-label", pickText(theme.shortName, locale)),
      );
      item.append(left);
      if (selectedId === theme.id) {
        item.append(el(doc, "span", "", "✓"));
      }
      item.addEventListener("click", () => onPick(theme.id));
      list.append(item);
    }
    section.append(list);
    return section;
  }

  function computeY(capsuleHeight) {
    const vh = win?.innerHeight || 800;
    const minY = Math.min(TOP_SAFE_MARGIN, Math.max(12, vh - capsuleHeight - 12));
    const maxY = Math.max(minY, vh - BOTTOM_SAFE_MARGIN - capsuleHeight);
    return Math.round(clamp(vh * pos.yRatio, minY, maxY));
  }

  function applyCapsuleCoords(capsule, customX, customY) {
    const vw = win?.innerWidth || 1024;
    const w = capsule.offsetWidth || 44;
    const h = capsule.offsetHeight || 32;
    if (customX !== undefined && customY !== undefined) {
      capsule.removeAttribute("data-dock");
      capsule.style.left = `${Math.round(clamp(customX, 4, vw - w - 4))}px`;
      capsule.style.right = "auto";
      capsule.style.top = `${Math.round(clamp(customY, 12, (win?.innerHeight || 800) - h - 12))}px`;
      return;
    }
    const y = computeY(h);
    capsule.dataset.dock = pos.dock;
    capsule.style.top = `${y}px`;
    if (pos.dock === "right") {
      capsule.style.left = "auto";
      capsule.style.right = "0px";
    } else {
      capsule.style.left = "0px";
      capsule.style.right = "auto";
    }
  }

  function placePanel(capsule, panel) {
    if (!panel || panel.hidden) return;
    const vw = win?.innerWidth || 1024;
    const vh = win?.innerHeight || 800;
    const cRect = capsule.getBoundingClientRect();
    const pW = panel.offsetWidth || 274;
    const pH = panel.offsetHeight || 380;

    let left;
    if (pos.dock === "right") {
      left = cRect.left - pW - PANEL_GAP;
      if (left < 12) left = Math.max(12, vw - pW - 12);
    } else {
      left = cRect.right + PANEL_GAP;
      if (left + pW > vw - 12) left = Math.max(12, vw - pW - 12);
    }
    const top = clamp(cRect.top - 12, 16, Math.max(16, vh - pH - 16));
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  let activeCapsule = null;
  let activePanel = null;

  function render() {
    if (api.signal.aborted) return;
    overlay.hidden = !settings.showWidget;
    overlay.replaceChildren();
    activeCapsule = null;
    activePanel = null;
    if (!settings.showWidget) return;

    const copy = getCopy(locale);
    const { base: activeBase, variant: activeVariant } = resolveEffectiveTheme(
      settings,
      hostScheme,
    );

    // Edge-docked compact draggable tab (pointer-events: auto)
    const capsule = el(doc, "button", "ghw-capsule");
    capsule.setAttribute("aria-expanded", String(isOpen));
    capsule.setAttribute("aria-label", copy.triggerLabel);
    capsule.title = `${copy.title} · @primer/primitives@${PRIMER_SOURCE.version}`;
    const swatch = el(doc, "span", "ghw-capsule-swatch");
    swatch.style.background = activeVariant.preview.dotA;
    const label = el(
      doc,
      "span",
      "ghw-capsule-label",
      `${pickText(activeBase.shortName, locale)}${settings.increaseContrast ? " HC" : ""}`,
    );
    capsule.append(createOctocat(doc, "ghw-capsule-icon"), swatch, label);

    let dragState = null;
    let suppressNextClick = false;

    capsule.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const rect = capsule.getBoundingClientRect();
      dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        moved: false,
      };
      capsule.setPointerCapture?.(e.pointerId);
    });

    capsule.addEventListener("pointermove", (e) => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        dragState.moved = true;
        capsule.dataset.dragging = "true";
        if (isOpen) {
          isOpen = false;
          if (activePanel) activePanel.hidden = true;
          capsule.setAttribute("aria-expanded", "false");
        }
      }
      if (dragState.moved) {
        applyCapsuleCoords(capsule, e.clientX - dragState.offsetX, e.clientY - dragState.offsetY);
      }
    });

    const finishDrag = (e) => {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const wasMoved = dragState.moved;
      dragState = null;
      delete capsule.dataset.dragging;
      if (wasMoved) {
        suppressNextClick = true;
        const rect = capsule.getBoundingClientRect();
        const vw = win?.innerWidth || 1024;
        const vh = win?.innerHeight || 800;
        const dock = rect.left + rect.width / 2 < vw / 2 ? "left" : "right";
        const yRatio = clamp(rect.top / Math.max(1, vh), 0.08, 0.78);
        pos = { dock, yRatio };
        savePosition(win, pos);
        applyCapsuleCoords(capsule);
      }
    };

    capsule.addEventListener("pointerup", finishDrag);
    capsule.addEventListener("pointercancel", finishDrag);

    capsule.addEventListener("click", () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      isOpen = !isOpen;
      render();
    });

    overlay.append(capsule);
    activeCapsule = capsule;
    applyCapsuleCoords(capsule);

    if (!isOpen) return;

    // Popover panel (pointer-events: auto)
    const panel = el(doc, "section", "ghw-panel");
    panel.setAttribute("aria-label", copy.title);

    const head = el(doc, "div", "ghw-panel-head");
    const headTitle = el(doc, "div", "ghw-panel-title");
    headTitle.append(
      createOctocat(doc, "ghw-capsule-icon"),
      el(doc, "span", "", copy.title),
    );
    const closeBtn = el(doc, "button", "ghw-close", "×");
    closeBtn.setAttribute("aria-label", copy.close);
    closeBtn.addEventListener("click", () => {
      isOpen = false;
      render();
    });
    head.append(headTitle, closeBtn);

    const body = el(doc, "div", "ghw-panel-body");

    // Single / Auto segmented bar
    const seg = el(doc, "div", "ghw-seg");
    const singleBtn = el(doc, "button", "ghw-seg-btn", copy.single);
    singleBtn.setAttribute("aria-pressed", String(settings.themeMode === "single"));
    singleBtn.addEventListener("click", () => void savePatch({ themeMode: "single" }));

    const autoBtn = el(doc, "button", "ghw-seg-btn", copy.auto);
    autoBtn.setAttribute("aria-pressed", String(settings.themeMode === "auto"));
    autoBtn.addEventListener("click", () => void savePatch({ themeMode: "auto" }));
    seg.append(singleBtn, autoBtn);
    body.append(seg);

    // Light 3 + Dark 4 groups
    const activeLightId =
      settings.themeMode === "auto" ? settings.lightTheme : settings.singleTheme;
    const activeDarkId =
      settings.themeMode === "auto" ? settings.darkTheme : settings.singleTheme;

    body.append(
      renderThemeGroup(copy.lightGroup, LIGHT_BASE_THEMES, activeLightId, (id) => {
        if (settings.themeMode === "auto") void savePatch({ lightTheme: id });
        else void savePatch({ singleTheme: id });
      }),
      renderThemeGroup(copy.darkGroup, DARK_BASE_THEMES, activeDarkId, (id) => {
        if (settings.themeMode === "auto") void savePatch({ darkTheme: id });
        else void savePatch({ singleTheme: id });
      }),
    );

    // High contrast toggle + quick hide button
    const footer = el(doc, "div", "ghw-footer-row");
    const hcBtn = el(doc, "button", "ghw-hc-btn");
    hcBtn.setAttribute("aria-pressed", String(settings.increaseContrast));
    hcBtn.append(
      el(doc, "span", "", copy.highContrast),
      el(doc, "span", "ghw-hc-pill", settings.increaseContrast ? copy.on : copy.off),
    );
    hcBtn.addEventListener("click", () => {
      void savePatch({ increaseContrast: !settings.increaseContrast });
    });

    const hideBtn = el(doc, "button", "ghw-hide-btn", copy.hide);
    hideBtn.addEventListener("click", () => {
      isOpen = false;
      void savePatch({ showWidget: false });
    });

    footer.append(hcBtn, hideBtn);
    body.append(footer);

    panel.append(head, body);
    overlay.append(panel);
    activePanel = panel;
    placePanel(capsule, panel);
  }

  const onResize = () => {
    if (!activeCapsule) return;
    applyCapsuleCoords(activeCapsule);
    if (activePanel && !activePanel.hidden) placePanel(activeCapsule, activePanel);
  };
  win?.addEventListener?.("resize", onResize, { signal: api.signal });

  const onKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      isOpen = false;
      render();
    }
  };
  doc.addEventListener("keydown", onKeyDown, { signal: api.signal });

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
    stopLocale();
    stopScheme();
    stopStorage();
    root.replaceChildren();
  };
}

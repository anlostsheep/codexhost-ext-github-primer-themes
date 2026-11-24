import {
  ALL_MARKERS,
  resolveEffectiveTheme,
} from "../shared/primer-themes.mjs";

function detectWebColorScheme(doc, win) {
  if (doc.body?.hasAttribute("data-ds-dark-theme")) return "dark";
  if (doc.documentElement?.getAttribute("data-theme") === "dark") return "dark";
  if (doc.documentElement?.getAttribute("data-theme") === "light") return "light";
  try {
    if (win?.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    // Ignore restricted matchMedia environments.
  }
  return "light";
}

export async function activate(api) {
  const doc = globalThis.document;
  const win = doc?.defaultView ?? globalThis.window;
  const html = doc?.documentElement;
  if (!doc || !html) return undefined;

  let currentSettings = {};
  let appliedMarkers = [];

  const applyMarkers = () => {
    if (api.signal.aborted) return;
    const hostScheme = detectWebColorScheme(doc, win);
    const { variant } = resolveEffectiveTheme(currentSettings, hostScheme);
    const nextMarkers = [
      "gh-active",
      variant.marker,
      variant.scheme === "dark" ? "gh-scheme-dark" : "gh-scheme-light",
    ];

    for (const oldMarker of appliedMarkers) {
      if (!nextMarkers.includes(oldMarker)) {
        api.dom.unmark(html, oldMarker);
      }
    }
    for (const marker of nextMarkers) {
      if (!appliedMarkers.includes(marker)) {
        api.dom.mark(html, marker);
      }
    }
    appliedMarkers = nextMarkers;
  };

  try {
    currentSettings = (await api.storage.get()) ?? {};
  } catch {
    currentSettings = {};
  }
  if (api.signal.aborted) return undefined;
  applyMarkers();

  const stopStorage = api.storage.onChange((next) => {
    currentSettings = next ?? {};
    applyMarkers();
  });

  const bodyObserver =
    typeof MutationObserver === "function" && doc.body
      ? new MutationObserver(() => applyMarkers())
      : null;
  bodyObserver?.observe(doc.body, {
    attributes: true,
    attributeFilter: ["data-ds-dark-theme"],
  });

  const media = (() => {
    try {
      return win?.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
    } catch {
      return null;
    }
  })();
  const onMediaChange = () => applyMarkers();
  media?.addEventListener?.("change", onMediaChange);

  const cleanup = () => {
    stopStorage();
    bodyObserver?.disconnect();
    media?.removeEventListener?.("change", onMediaChange);
    if (!api.signal.aborted) {
      for (const marker of ALL_MARKERS) {
        api.dom.unmark(html, marker);
      }
    }
    appliedMarkers = [];
  };

  api.track(cleanup);
  return cleanup;
}

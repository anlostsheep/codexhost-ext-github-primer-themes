/* global define */
// Codex Desktop host injection (classic script, non-ESM).
// Applies official GitHub Primer CSS theme markers via api.dom.mark on <html>.
define({
  activate(api) {
    const doc = globalThis.document;
    const win = doc && doc.defaultView ? doc.defaultView : globalThis.window;
    const html = doc ? doc.documentElement : null;
    if (!doc || !html) return undefined;

    const THEME_META = {
      light: { scheme: "light", marker: "gh-light", hcMarker: "gh-light-hc" },
      light_colorblind: { scheme: "light", marker: "gh-light-cb", hcMarker: "gh-light-cb-hc" },
      light_tritanopia: { scheme: "light", marker: "gh-light-trit", hcMarker: "gh-light-trit-hc" },
      dark: { scheme: "dark", marker: "gh-dark", hcMarker: "gh-dark-hc" },
      dark_colorblind: { scheme: "dark", marker: "gh-dark-cb", hcMarker: "gh-dark-cb-hc" },
      dark_tritanopia: { scheme: "dark", marker: "gh-dark-trit", hcMarker: "gh-dark-trit-hc" },
      dark_dimmed: { scheme: "dark", marker: "gh-soft-dark", hcMarker: "gh-soft-dark-hc" },
    };

    const LIGHT_IDS = { light: true, light_colorblind: true, light_tritanopia: true };
    const DARK_IDS = { dark: true, dark_colorblind: true, dark_tritanopia: true, dark_dimmed: true };

    function detectDesktopScheme() {
      const themeAttr = html.getAttribute("data-theme");
      if (themeAttr === "dark" || themeAttr === "light") return themeAttr;
      if (html.classList.contains("dark")) return "dark";
      if (html.classList.contains("light")) return "light";
      try {
        if (win && win.matchMedia && win.matchMedia("(prefers-color-scheme: dark)").matches) {
          return "dark";
        }
      } catch {
        // Ignore restricted matchMedia environments.
      }
      return "dark";
    }

    function resolveVariant(rawSettings) {
      const input = rawSettings && typeof rawSettings === "object" ? rawSettings : {};
      const themeMode = input.themeMode === "auto" ? "auto" : "single";
      const singleTheme = THEME_META[input.singleTheme] ? input.singleTheme : "dark_dimmed";
      const lightTheme = LIGHT_IDS[input.lightTheme] ? input.lightTheme : "light";
      const darkTheme = DARK_IDS[input.darkTheme] ? input.darkTheme : "dark_dimmed";
      const increaseContrast = Boolean(input.increaseContrast);

      const hostScheme = detectDesktopScheme();
      const baseId =
        themeMode === "auto" ? (hostScheme === "light" ? lightTheme : darkTheme) : singleTheme;
      const meta = THEME_META[baseId] || THEME_META.dark_dimmed;
      return {
        scheme: meta.scheme,
        marker: increaseContrast ? meta.hcMarker : meta.marker,
      };
    }

    let currentSettings = {};
    let appliedMarkers = [];

    function applyMarkers() {
      if (api.signal.aborted) return;
      const variant = resolveVariant(currentSettings);
      const nextMarkers = [
        "gh-active",
        variant.marker,
        variant.scheme === "dark" ? "gh-scheme-dark" : "gh-scheme-light",
      ];

      for (const oldMarker of appliedMarkers) {
        if (nextMarkers.indexOf(oldMarker) === -1) {
          api.dom.unmark(html, oldMarker);
        }
      }
      for (const marker of nextMarkers) {
        if (appliedMarkers.indexOf(marker) === -1) {
          api.dom.mark(html, marker);
        }
      }
      appliedMarkers = nextMarkers;
    }

    // Apply default immediately, then reconcile with shared Host storage.
    applyMarkers();

    void Promise.resolve(api.storage.get())
      .then((values) => {
        if (api.signal.aborted) return;
        currentSettings = values || {};
        applyMarkers();
      })
      .catch(() => {
        // Keep defaults if settings cannot be read yet.
      });

    const stopStorage = api.storage.onChange((next) => {
      currentSettings = next || {};
      applyMarkers();
    });

    const htmlObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            if (currentSettings.themeMode === "auto") applyMarkers();
          })
        : null;
    if (htmlObserver) {
      htmlObserver.observe(html, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
      });
    }

    let media = null;
    try {
      media = win && win.matchMedia ? win.matchMedia("(prefers-color-scheme: dark)") : null;
    } catch {
      media = null;
    }
    const onMediaChange = () => {
      if (currentSettings.themeMode === "auto") applyMarkers();
    };
    if (media && media.addEventListener) {
      media.addEventListener("change", onMediaChange);
    }

    const cleanup = () => {
      stopStorage();
      if (htmlObserver) htmlObserver.disconnect();
      if (media && media.removeEventListener) {
        media.removeEventListener("change", onMediaChange);
      }
      appliedMarkers = [];
    };

    api.track(cleanup);
    return cleanup;
  },
});

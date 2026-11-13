/*
 * NDCConnect — apply display preferences before the app paints (spec 20 §10.2).
 * Same origin (CSP script-src 'self'). Reads localStorage only; never calls the API. Keep in step with
 * src/settings/prefsStore.ts.
 */
(function () {
  var html = document.documentElement;
  var p = {};
  try {
    p = JSON.parse(window.localStorage.getItem("ndc.prefs.v1") || "{}") || {};
  } catch (e) {
    p = {};
  }
  function pick(v, allowed, fallback) {
    return allowed.indexOf(v) >= 0 ? v : fallback;
  }
  html.setAttribute("data-theme", pick(p.theme, ["system", "light", "dark"], "system"));
  html.setAttribute("data-text-size", pick(p.text_size, ["standard", "large", "larger"], "standard"));
  html.setAttribute("data-contrast", pick(p.contrast, ["system", "standard", "more"], "system"));
  html.setAttribute("data-motion", pick(p.motion, ["system", "reduce"], "system"));
  var theme = html.getAttribute("data-theme");
  var contrast = html.getAttribute("data-contrast");
  function media(q) {
    return !!(window.matchMedia && window.matchMedia(q).matches);
  }
  html.setAttribute("data-scheme", theme === "system" ? (media("(prefers-color-scheme: dark)") ? "dark" : "light") : theme);
  html.setAttribute("data-contrast-level", contrast === "system" ? (media("(prefers-contrast: more)") ? "more" : "standard") : contrast);
  // <html lang> is set by the app once the chosen language's text has loaded (spec 21 §5.4): English until then.
})();

(function () {
  const LANG_KEY = "natl-lang";
  const langs = ["en", "ru", "zh", "es"];

  function detect() {
    const saved = localStorage.getItem(LANG_KEY);
    if (langs.includes(saved)) return saved;
    // Документация по умолчанию на русском; остальные языки — через переключатель.
    return "ru";
  }

  function lookup(dict, key) {
    return key.split(".").reduce((o, k) => (o == null ? o : o[k]), dict);
  }

  async function load(lang) {
    const res = await fetch(`i18n/${lang}.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Missing locale ${lang}`);
    return res.json();
  }

  function fill(dict) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const val = lookup(dict, el.getAttribute("data-i18n"));
      if (typeof val === "string") el.textContent = val;
    });

    // Page body: prefer pages[data-page].html into [data-page-content]
    const page = document.body.dataset.page || "home";
    const pageHtml = dict.pages?.[page]?.html;
    const pageEl = document.querySelector("[data-page-content]");
    if (pageEl && typeof pageHtml === "string") {
      pageEl.innerHTML = pageHtml;
    }

    // Inline HTML snippets (e.g. sandbox lede) — never wipe the assert form
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      if (pageEl && pageEl.contains(el) && typeof pageHtml === "string") return;
      const val = lookup(dict, el.getAttribute("data-i18n-html"));
      if (typeof val === "string") el.innerHTML = val;
    });

    const title = dict.pages?.[page]?.title || dict.meta?.title || "NATL";
    document.title = `${title} · NATL test runner`;
    document.documentElement.lang = dict.meta?.htmlLang || "en";
    document.dispatchEvent(new CustomEvent("natl:content"));
  }

  window.NATLI18n = {
    async init() {
      const select = document.querySelector("[data-lang-select]");
      let lang = detect();
      if (select) select.value = lang;

      async function apply(next) {
        lang = next;
        localStorage.setItem(LANG_KEY, lang);
        const dict = await load(lang);
        fill(dict);
        if (select) select.value = lang;
        const btn = document.querySelector("[data-theme-toggle]");
        if (btn) {
          btn.dataset.light = dict.ui?.themeLight || "Light";
          btn.dataset.dark = dict.ui?.themeDark || "Dark";
          const theme = document.documentElement.getAttribute("data-theme") || "light";
          btn.textContent = theme === "dark" ? btn.dataset.light : btn.dataset.dark;
        }
      }

      select?.addEventListener("change", (e) => apply(e.target.value));
      await apply(lang);
    },
  };
})();

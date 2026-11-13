(function () {
  // Палитра «Полигон»: графит и сигнальный оранжевый.
  const lightVars = {
    darkMode: false,
    background: "#f2f3f5",
    primaryColor: "#ff6b1a",
    primaryTextColor: "#16181c",
    primaryBorderColor: "#e2580a",
    secondaryColor: "#e1e3e7",
    tertiaryColor: "#ffffff",
    lineColor: "#5a626e",
    textColor: "#16181c",
    mainBkg: "#ffe6d5",
    nodeBorder: "#e2580a",
    clusterBkg: "#f2f3f5",
    clusterBorder: "#d8dade",
    titleColor: "#16181c",
    edgeLabelBackground: "#ffffff",
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
  };

  const darkVars = {
    darkMode: true,
    background: "#1c1f24",
    primaryColor: "#ff6b1a",
    primaryTextColor: "#f2f3f5",
    primaryBorderColor: "#ff8a45",
    secondaryColor: "#2c3037",
    tertiaryColor: "#16181c",
    lineColor: "#9aa1ac",
    textColor: "#f2f3f5",
    mainBkg: "#3a2214",
    nodeBorder: "#ff8a45",
    clusterBkg: "#1c1f24",
    clusterBorder: "#2c3037",
    titleColor: "#f2f3f5",
    edgeLabelBackground: "#1c1f24",
    fontFamily: "IBM Plex Sans, Segoe UI, sans-serif",
  };

  let loading = null;
  let seq = 0;
  let renderGen = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  async function loadMermaid() {
    if (window.mermaid) return window.mermaid;
    if (loading) return loading;
    loading = (async () => {
      const sources = [
        "assets/js/vendor/mermaid.min.js",
        "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.1/mermaid.min.js",
      ];
      let lastErr;
      for (const src of sources) {
        try {
          await loadScript(src);
          if (window.mermaid) return window.mermaid;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error("Mermaid failed to load");
    })();
    return loading;
  }

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function collectTargets() {
    return [...document.querySelectorAll("[data-mermaid], pre.mermaid, div.mermaid")].filter(
      (el) => !el.closest("svg"),
    );
  }

  function readSource(el) {
    if (el.dataset.source) return el.dataset.source;
    const raw = (el.textContent || "").trim();
    el.dataset.source = raw;
    return raw;
  }

  async function renderOne(mermaid, el, source) {
    const id = "natl-mmd-" + ++seq;
    const out = await mermaid.render(id, source);
    el.innerHTML = out.svg;
    el.setAttribute("data-rendered", "1");
    el.classList.add("mermaid");
    el.classList.remove("mermaid-pending");
  }

  async function render() {
    const targets = collectTargets();
    if (!targets.length) return;

    const myGen = ++renderGen;
    let mermaid;
    try {
      mermaid = await loadMermaid();
    } catch (err) {
      targets.forEach((el) => {
        el.classList.add("mermaid-error");
        el.textContent =
          "Diagram failed to load. Check network or assets/js/vendor/mermaid.min.js";
      });
      throw err;
    }
    if (myGen !== renderGen) return;

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      themeVariables: isDark() ? darkVars : lightVars,
      flowchart: {
        curve: "basis",
        padding: 14,
        htmlLabels: false,
        useMaxWidth: true,
      },
    });

    for (const el of targets) {
      if (myGen !== renderGen) return;
      const source = readSource(el);
      if (!source) continue;
      el.classList.add("mermaid-pending");
      try {
        await renderOne(mermaid, el, source);
      } catch (err) {
        console.error("Mermaid render failed", err);
        el.classList.add("mermaid-error");
        el.textContent = source;
      }
    }
  }

  window.NATLMermaid = { render };

  document.addEventListener("natl:content", () => {
    render().catch((err) => console.error(err));
  });
  document.addEventListener("natl:theme", () => {
    // Drop cached SVG so theme variables re-apply from source text
    collectTargets().forEach((el) => {
      if (el.dataset.source) {
        el.textContent = el.dataset.source;
        el.removeAttribute("data-rendered");
      }
    });
    render().catch((err) => console.error(err));
  });
})();

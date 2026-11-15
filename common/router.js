/* Seamless page switching.
   Pages stay separate HTML files (so every URL still opens directly),
   but links between them swap the page content in place instead of
   reloading. The navbar never disappears, so its glass pill glides the
   moment a link is tapped, whatever the network speed.
   Pages listed in FULL_LOAD_PATHS (the Drones page) load normally. */
(() => {
  if (!window.fetch || !window.DOMParser || !history.pushState) return;

  const FULL_LOAD_PATHS = ["/drones/"];
  const SHARED_STYLES = ["/common.css", "/navbar.css", "/common/footer.css"];
  const SHARED_SCRIPT = /^\/common\//;
  const FADE_MS = 180;


  /* =======================================================
     PAGE LIFECYCLES
     Page scripts were written for a fresh page load. Whatever
     they start globally (window/document listeners, timers,
     animation frames, observers) is recorded against their
     page and stopped when that page is left.
  ======================================================= */

  const native = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    addWindowListener: window.addEventListener.bind(window),
    removeWindowListener: window.removeEventListener.bind(window),
    addDocumentListener: document.addEventListener.bind(document),
    removeDocumentListener: document.removeEventListener.bind(document)
  };

  const createLifecycle = () => ({
    alive: true,
    timeouts: new Set(),
    intervals: new Set(),
    frames: new Set(),
    listeners: [],
    observers: []
  });

  // Shared scripts (footer, navbar glass, this file) live for the whole visit.
  const sharedLife = createLifecycle();
  let pageLife = createLifecycle();
  let runningLife = null;

  const ownerLife = () => {
    if (runningLife) return runningLife;

    const script = document.currentScript;
    if (script && script.src && SHARED_SCRIPT.test(new URL(script.src).pathname)) {
      return sharedLife;
    }

    return pageLife;
  };

  // Callbacks run "inside" their page, so anything they schedule belongs to it too.
  const within = (life, callback) =>
    function (...args) {
      if (!life.alive) return undefined;

      const previous = runningLife;
      runningLife = life;

      try {
        return callback.apply(this, args);
      } finally {
        runningLife = previous;
      }
    };

  window.setTimeout = function (callback, delay, ...args) {
    const life = ownerLife();
    if (!life.alive) return 0;
    if (typeof callback !== "function") return native.setTimeout(callback, delay, ...args);

    const id = native.setTimeout(
      within(life, (...callbackArgs) => {
        life.timeouts.delete(id);
        callback(...callbackArgs);
      }),
      delay,
      ...args
    );
    life.timeouts.add(id);
    return id;
  };

  window.setInterval = function (callback, delay, ...args) {
    const life = ownerLife();
    if (!life.alive) return 0;
    if (typeof callback !== "function") return native.setInterval(callback, delay, ...args);

    const id = native.setInterval(within(life, callback), delay, ...args);
    life.intervals.add(id);
    return id;
  };

  window.requestAnimationFrame = function (callback) {
    const life = ownerLife();
    if (!life.alive) return 0;

    const id = native.requestAnimationFrame(
      within(life, (time) => {
        life.frames.delete(id);
        callback(time);
      })
    );
    life.frames.add(id);
    return id;
  };

  const captureOf = (options) =>
    typeof options === "boolean" ? options : Boolean(options && options.capture);

  const trackListeners = (target, add, remove) => {
    target.addEventListener = function (type, listener, options) {
      if (!listener) return;

      const life = ownerLife();
      if (!life.alive) return;

      const wrapped = typeof listener === "function" ? within(life, listener) : listener;
      life.listeners.push({ target, type, listener, wrapped, options, capture: captureOf(options) });
      add(type, wrapped, options);

      // A page swapped in after load still expects its ready/load handlers to run.
      const late =
        document.readyState === "complete" &&
        life !== sharedLife &&
        (type === "DOMContentLoaded" || (type === "load" && target === window));

      if (late && typeof listener === "function") {
        native.setTimeout(() => wrapped.call(target, new Event(type)), 0);
      }
    };

    target.removeEventListener = function (type, listener, options) {
      const capture = captureOf(options);

      [sharedLife, pageLife].forEach((life) => {
        const index = life.listeners.findIndex(
          (entry) =>
            entry.target === target &&
            entry.type === type &&
            entry.listener === listener &&
            entry.capture === capture
        );

        if (index === -1) return;

        remove(type, life.listeners[index].wrapped, options);
        life.listeners.splice(index, 1);
      });

      remove(type, listener, options);
    };
  };

  trackListeners(window, native.addWindowListener, native.removeWindowListener);
  trackListeners(document, native.addDocumentListener, native.removeDocumentListener);

  ["IntersectionObserver", "ResizeObserver", "MutationObserver"].forEach((name) => {
    const NativeObserver = window[name];
    if (!NativeObserver) return;

    window[name] = class extends NativeObserver {
      constructor(callback, options) {
        const life = ownerLife();
        super(within(life, callback), options);
        life.observers.push(this);
      }
    };
  });

  const endLifecycle = (life) => {
    life.alive = false;
    life.timeouts.forEach((id) => native.clearTimeout(id));
    life.intervals.forEach((id) => native.clearInterval(id));
    life.frames.forEach((id) => native.cancelAnimationFrame(id));
    life.listeners.forEach(({ target, type, wrapped, options }) => {
      if (target === window) {
        native.removeWindowListener(type, wrapped, options);
      } else {
        native.removeDocumentListener(type, wrapped, options);
      }
    });
    life.observers.forEach((observer) => observer.disconnect());
  };


  /* =======================================================
     FETCHING PAGES
     Pages are fetched once and kept, and hovering or touching
     a link starts the download early.
  ======================================================= */

  const pages = new Map();
  const scripts = new Map();

  const fetchText = (cache, url, mustBeHtml) => {
    if (!cache.has(url)) {
      const request = fetch(url, { credentials: "same-origin" })
        .then((response) => {
          const type = response.headers.get("content-type") || "";
          if (!response.ok || (mustBeHtml && !type.includes("text/html"))) {
            throw new Error(`Cannot swap to ${url} (${response.status})`);
          }
          return response.text();
        })
        .catch((error) => {
          cache.delete(url);
          throw error;
        });

      cache.set(url, request);
    }

    return cache.get(url);
  };

  const parsePage = (html, url) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const absolute = (value) => new URL(value, url).href;
    const isShared = (href, list) => list.includes(new URL(href).pathname);

    return {
      doc,
      styles: [...doc.querySelectorAll('link[rel="stylesheet"][href]')]
        .map((link) => absolute(link.getAttribute("href")))
        .filter((href) => !isShared(href, SHARED_STYLES)),
      scripts: [...doc.querySelectorAll("script[src]")]
        .map((script) => absolute(script.getAttribute("src")))
        .filter((src) => !SHARED_SCRIPT.test(new URL(src).pathname))
    };
  };

  // Download a page and its own styles and scripts ahead of time.
  const warmed = new Set();

  const warm = (url) => {
    if (warmed.has(url)) return;
    warmed.add(url);

    fetchText(pages, url, true)
      .then((html) => {
        const page = parsePage(html, url);
        page.styles.forEach((href) => fetch(href).catch(() => {}));
        page.scripts.forEach((src) => fetchText(scripts, src).catch(() => {}));
      })
      .catch(() => warmed.delete(url));
  };


  /* =======================================================
     WHICH LINKS ARE SWAPPED
  ======================================================= */

  const swappableUrl = (link) => {
    if (!link || link.hasAttribute("download")) return null;
    if (link.target && link.target !== "_self") return null;

    const url = new URL(link.href, location.href);

    if (url.origin !== location.origin) return null;
    if (FULL_LOAD_PATHS.some((path) => url.pathname.startsWith(path))) return null;
    // Only pages, not files such as the brochure PDF.
    if (!/(\/|\.html)$/.test(url.pathname)) return null;
    // Anchors on the same page scroll as usual.
    if (url.pathname === location.pathname && url.hash) return null;

    return url;
  };


  /* =======================================================
     SWAPPING
  ======================================================= */

  const style = document.createElement("style");
  style.textContent = `
    html.vp-switching body > :not(.topbar):not([data-vp-persist]) {
      transition: opacity ${FADE_MS}ms ease;
    }

    html.vp-hidden body > :not(.topbar):not([data-vp-persist]) {
      opacity: 0;
    }`;
  document.head.appendChild(style);

  const wait = (ms) => new Promise((resolve) => native.setTimeout(resolve, ms));
  const nextFrame = () => new Promise((resolve) => native.requestAnimationFrame(resolve));

  const isPageStyle = (link) =>
    !SHARED_STYLES.includes(new URL(link.href).pathname);

  // Add the new page's stylesheets (and wait for them) before showing it.
  const addStyles = async (hrefs) => {
    const current = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(isPageStyle);
    const footerStyle = [...document.querySelectorAll('link[rel="stylesheet"]')].find(
      (link) => new URL(link.href).pathname === "/common/footer.css"
    );
    const keep = new Set();
    const loading = [];

    hrefs.forEach((href) => {
      const existing = current.find((link) => link.href === href);

      if (existing) {
        keep.add(existing);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      loading.push(new Promise((resolve) => {
        link.onload = resolve;
        link.onerror = resolve;
      }));

      // Same order as a normal load: page styles before the footer's.
      document.head.insertBefore(link, footerStyle || null);
    });

    await Promise.all(loading);

    return () => current.filter((link) => !keep.has(link)).forEach((link) => link.remove());
  };

  const isPersistent = (element) =>
    element.matches(".topbar, #site-footer, [data-vp-persist], script, style");

  // Replace everything except the navbar, footer and shared helpers.
  const swapContent = (doc) => {
    const topbar = document.querySelector(".topbar");
    const footer = document.getElementById("site-footer");
    let beforeNavbar = true;

    [...document.body.children].forEach((element) => {
      if (!isPersistent(element)) element.remove();
    });

    [...doc.body.children].forEach((element) => {
      if (element.matches(".topbar")) {
        beforeNavbar = false;
        return;
      }

      if (element.matches("#site-footer, script")) return;

      const anchor = beforeNavbar ? topbar : footer;
      document.body.insertBefore(document.adoptNode(element), anchor || null);
    });

    document.title = doc.title;
  };

  // Run a page script in its own scope, so coming back to a page can't
  // clash with the variables it declared the first time.
  const runScript = (code, src, life) => {
    const script = document.createElement("script");
    script.textContent = `(function () {\n${code}\n})();\n//# sourceURL=${src}`;

    runningLife = life;

    try {
      document.body.appendChild(script);
    } finally {
      runningLife = null;
      script.remove();
    }
  };

  let navigation = 0;
  let currentPath = location.pathname;

  const navigate = async (url, { push, scrollY = 0 }) => {
    const id = ++navigation;
    const address = url.pathname + url.search;

    // Keep the page being left at its exact scroll position for Back.
    native.clearTimeout(scrollSave);
    if (push) history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, "");

    // Instant feedback: the pill glides and the page fades out right away.
    if (window.VPPill) window.VPPill.moveTo(url.pathname);

    const root = document.documentElement;
    root.classList.add("vp-switching", "vp-hidden");

    let page;

    try {
      const [html] = await Promise.all([fetchText(pages, address, true), wait(FADE_MS)]);
      page = parsePage(html, url.href);
    } catch (error) {
      location.href = url.href;
      return;
    }

    // Styles and scripts download together. The old content is already
    // faded out, so the new styles can't be seen applying to it.
    const [codes, removeOldStyles] = await Promise.all([
      Promise.all(page.scripts.map((src) => fetchText(scripts, src).catch(() => null))),
      addStyles(page.styles)
    ]);

    if (id !== navigation) return;

    if (push) history.pushState({ scrollY: 0 }, "", url.href);
    currentPath = url.pathname;

    endLifecycle(pageLife);
    pageLife = createLifecycle();

    swapContent(page.doc);
    removeOldStyles();

    const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
    window.scrollTo({ top: target ? target.getBoundingClientRect().top + window.scrollY : scrollY, behavior: "instant" });

    page.scripts.forEach((src, index) => {
      if (codes[index] !== null) runScript(codes[index], src, pageLife);
    });

    await nextFrame();
    if (id !== navigation) return;

    root.classList.remove("vp-hidden");
    await wait(FADE_MS);
    if (id === navigation) root.classList.remove("vp-switching");
  };


  /* =======================================================
     EVENTS
  ======================================================= */

  history.scrollRestoration = "manual";
  history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, "");

  // Capture phase, so the navbar's own click handler sees the click is handled.
  native.addDocumentListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target.closest && event.target.closest("a[href]");
    const url = swappableUrl(link);
    if (!url) return;

    event.preventDefault();

    // Tapping the current page's link scrolls back to the top, like iOS tabs.
    if (url.pathname === location.pathname) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    navigate(url, { push: true });
  }, true);

  const warmLink = (event) => {
    const link = event.target.closest && event.target.closest("a[href]");
    const url = swappableUrl(link);
    if (url && url.pathname !== location.pathname) warm(url.pathname + url.search);
  };

  native.addDocumentListener("pointerover", warmLink, { passive: true });
  native.addDocumentListener("touchstart", warmLink, { passive: true });
  native.addDocumentListener("focusin", warmLink);

  // Remember the scroll position of each entry for Back/Forward.
  let scrollSave = 0;
  native.addWindowListener("scroll", () => {
    native.clearTimeout(scrollSave);
    scrollSave = native.setTimeout(() => {
      history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, "");
    }, 150);
  }, { passive: true });

  native.addWindowListener("popstate", (event) => {
    const url = new URL(location.href);

    // Only the hash changed: same page, let the browser scroll.
    if (url.pathname === currentPath) return;

    navigate(url, { push: false, scrollY: (event.state && event.state.scrollY) || 0 });
  });
})();

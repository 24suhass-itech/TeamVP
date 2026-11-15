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

  /* Pages slide like a carousel in navbar order: going to a link on the
     right, the current page leaves to the left and the new one comes in
     from the right (and the reverse). The navbar stays put. Browsers
     without View Transitions fall back to a quick fade. */
  const SLIDE_MS = 460;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canSlide = typeof document.startViewTransition === "function" && !reduceMotion;

  const style = document.createElement("style");
  style.textContent = `
    html[data-vp-direction] .topbar {
      view-transition-name: vp-navbar;
    }

    ::view-transition-group(vp-navbar),
    ::view-transition-new(vp-navbar) {
      animation: none;
    }

    ::view-transition-old(vp-navbar) {
      display: none;
    }

    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: ${SLIDE_MS}ms;
      animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
      mix-blend-mode: normal;
    }

    html[data-vp-direction="forward"]::view-transition-old(root) { animation-name: vp-out-to-left; }
    html[data-vp-direction="forward"]::view-transition-new(root) { animation-name: vp-in-from-right; }
    html[data-vp-direction="back"]::view-transition-old(root) { animation-name: vp-out-to-right; }
    html[data-vp-direction="back"]::view-transition-new(root) { animation-name: vp-in-from-left; }

    @keyframes vp-out-to-left { to { transform: translateX(-100%); } }
    @keyframes vp-in-from-right { from { transform: translateX(100%); } }
    @keyframes vp-out-to-right { to { transform: translateX(100%); } }
    @keyframes vp-in-from-left { from { transform: translateX(-100%); } }

    html.vp-fading body > :not(.topbar):not([data-vp-persist]) {
      transition: opacity ${FADE_MS}ms ease;
    }

    html.vp-hidden body > :not(.topbar):not([data-vp-persist]) {
      opacity: 0;
    }`;
  document.head.appendChild(style);

  // Position of a page along the navbar (Events articles count as Events).
  const sectionOf = (pathname) => {
    const order = [...document.querySelectorAll(".navbar a[href]")].map(
      (link) => new URL(link.href, location.href).pathname
    );
    const index = order.findIndex((path) => path !== "/" && pathname.startsWith(path));
    return index === -1 ? order.indexOf("/") : index;
  };

  const depthOf = (pathname) => pathname.split("/").filter(Boolean).length;

  const directionOf = (from, to) => {
    const fromSection = sectionOf(from);
    const toSection = sectionOf(to);

    if (fromSection !== toSection) return toSection > fromSection ? "forward" : "back";
    return depthOf(to) >= depthOf(from) ? "forward" : "back";
  };

  const wait = (ms) => new Promise((resolve) => native.setTimeout(resolve, ms));
  const nextFrame = () => new Promise((resolve) => native.requestAnimationFrame(resolve));

  const isPageStyle = (link) =>
    !SHARED_STYLES.includes(new URL(link.href).pathname);

  // Download the new page's stylesheets switched off (media "not all"),
  // so they can't touch the page still on screen; apply() switches them
  // on and drops the old page's styles in one go.
  const loadStyles = async (hrefs) => {
    const current = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(isPageStyle);
    const footerStyle = [...document.querySelectorAll('link[rel="stylesheet"]')].find(
      (link) => new URL(link.href).pathname === "/common/footer.css"
    );
    const keep = [];
    const loading = [];

    hrefs.forEach((href) => {
      const existing = current.find((link) => link.href === href);

      if (existing) {
        keep.push(existing);
        return;
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.media = "not all";
      loading.push(new Promise((resolve) => {
        link.onload = resolve;
        link.onerror = resolve;
      }));

      // Same order as a normal load: page styles before the footer's.
      document.head.insertBefore(link, footerStyle || null);
      keep.push(link);
    });

    await Promise.all(loading);

    return () => {
      keep.forEach((link) => link.removeAttribute("media"));
      current.filter((link) => !keep.includes(link)).forEach((link) => link.remove());
    };
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

    // Instant feedback: the pill glides right away. When sliding, the
    // current page stays on screen until the new one is ready.
    const direction = directionOf(currentPath, url.pathname);
    if (window.VPPill) window.VPPill.moveTo(url.pathname);

    const root = document.documentElement;
    root.classList.add("vp-switching");
    if (!canSlide) root.classList.add("vp-fading", "vp-hidden");

    let page;

    try {
      const [html] = await Promise.all([
        fetchText(pages, address, true),
        canSlide ? null : wait(FADE_MS)
      ]);
      page = parsePage(html, url.href);
    } catch (error) {
      location.href = url.href;
      return;
    }

    // Everything is downloaded before the switch, so the slide never
    // stalls waiting for the network.
    const [codes, applyStyles] = await Promise.all([
      Promise.all(page.scripts.map((src) => fetchText(scripts, src).catch(() => null))),
      loadStyles(page.styles)
    ]);

    if (id !== navigation) return;

    const showNewPage = () => {
      if (push) history.pushState({ scrollY: 0 }, "", url.href);
      currentPath = url.pathname;

      endLifecycle(pageLife);
      pageLife = createLifecycle();

      applyStyles();
      swapContent(page.doc);

      const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
      window.scrollTo({ top: target ? target.getBoundingClientRect().top + window.scrollY : scrollY, behavior: "instant" });

      page.scripts.forEach((src, index) => {
        if (codes[index] !== null) runScript(codes[index], src, pageLife);
      });
    };

    if (canSlide) {
      root.dataset.vpDirection = direction;

      try {
        await document.startViewTransition(showNewPage).finished;
      } catch (error) {
        // Skipped by a newer switch; that one finishes the job.
      }

      if (id === navigation) {
        delete root.dataset.vpDirection;
        root.classList.remove("vp-switching");
      }
      return;
    }

    showNewPage();

    await nextFrame();
    if (id !== navigation) return;

    root.classList.remove("vp-hidden");
    await wait(FADE_MS);
    if (id === navigation) root.classList.remove("vp-switching", "vp-fading");
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

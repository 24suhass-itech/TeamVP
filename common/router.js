/* Seamless page switching.
   Pages stay separate HTML files (so every URL still opens directly),
   but links between them swap the page content in place instead of
   reloading. The navbar never disappears, so its glass pill glides the
   moment a link is tapped, whatever the network speed.
   Pages listed in FULL_LOAD_PATHS (none at the moment) load normally. */
(() => {
  if (!window.fetch || !window.DOMParser || !history.pushState) return;

  const FULL_LOAD_PATHS = [];
  const SHARED_STYLES = [
    "/common.css",
    "/navbar.css",
    "/common/footer.css",
    "/common/cursor.css",
    "/common/mobile-nav.css"
  ];
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

  /* Page content slides like a carousel in navbar order: going to a link
     on the right, the current content leaves to the left and the new
     content comes in from the right (and the reverse). The navbar and
     the shared background stay put. Browsers
     without View Transitions fall back to a quick fade. */
  const SLIDE_MS = 500;
  // If the next page isn't ready by then, the pill starts on its own.
  const PILL_HEAD_START_MS = 150;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canSlide = typeof document.startViewTransition === "function" && !reduceMotion;

  const style = document.createElement("style");
  style.textContent = `
    html[data-vp-direction] .navbar {
      view-transition-name: vp-navbar;
    }

    /* The navbar is shown as a picture during the slide, and a picture
       has nothing behind it for its glass to blur, so it turns grey.
       Give the picture's frame the same glass, over the sliding pages. */
    ::view-transition-group(vp-navbar) {
      animation: none;
      border-radius: 999px;
      /* Same recipe as the live glass in liquid-glass.js: light blur,
         a colour boost and a touch of brightness. */
      backdrop-filter: blur(3px) saturate(170%) brightness(1.08);
    }

    ::view-transition-new(vp-navbar) {
      animation: none;
    }

    /* The incoming page is redrawn on every frame of the slide, and
       frosted-glass blurs (cards, buttons) are what makes that slow.
       They sit over smooth gradients, so pausing them for the half
       second of the slide isn't visible but keeps it smooth. The
       navbar's own glass is drawn by the group above meanwhile. */
    html.vp-sliding main,
    html.vp-sliding main *,
    html.vp-sliding #site-footer *,
    html.vp-sliding .navbar {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    ::view-transition-old(vp-navbar) {
      display: none;
    }

    /* Every page shares the same background, so it stays still and only
       the content slides. The old page's content and the new page's
       content get different names, so each slides from exactly where it
       sits on screen (the old one from wherever it was scrolled to). */
    html[data-vp-phase="old"] main { view-transition-name: vp-old-main; }
    html[data-vp-phase="old"] #site-footer { view-transition-name: vp-old-footer; }
    html[data-vp-phase="new"] main { view-transition-name: vp-new-main; }
    html[data-vp-phase="new"] #site-footer { view-transition-name: vp-new-footer; }

    /* The background (everything not named above) doesn't move. */
    ::view-transition-old(root) { display: none; }
    ::view-transition-new(root) { animation: none; }

    ::view-transition-old(vp-old-main),
    ::view-transition-old(vp-old-footer),
    ::view-transition-new(vp-new-main),
    ::view-transition-new(vp-new-footer) {
      animation-duration: ${SLIDE_MS}ms;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      animation-fill-mode: both;
      mix-blend-mode: normal;
    }

    html[data-vp-direction="forward"]::view-transition-old(vp-old-main),
    html[data-vp-direction="forward"]::view-transition-old(vp-old-footer) { animation-name: vp-out-to-left; }
    html[data-vp-direction="forward"]::view-transition-new(vp-new-main),
    html[data-vp-direction="forward"]::view-transition-new(vp-new-footer) { animation-name: vp-in-from-right; }
    html[data-vp-direction="back"]::view-transition-old(vp-old-main),
    html[data-vp-direction="back"]::view-transition-old(vp-old-footer) { animation-name: vp-out-to-right; }
    html[data-vp-direction="back"]::view-transition-new(vp-new-main),
    html[data-vp-direction="back"]::view-transition-new(vp-new-footer) { animation-name: vp-in-from-left; }

    @keyframes vp-out-to-left { to { transform: translateX(-100vw); } }
    @keyframes vp-in-from-right { from { transform: translateX(100vw); } }
    @keyframes vp-out-to-right { to { transform: translateX(100vw); } }
    @keyframes vp-in-from-left { from { transform: translateX(-100vw); } }

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

    // Decode images in the background so a page full of photos (Team)
    // can't hold up frames of the slide; each shows once it's ready.
    [...doc.images].forEach((img) => {
      if (!img.hasAttribute("decoding")) img.decoding = "async";
    });

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

    // The pill glides together with the slide. The browser freezes the
    // screen briefly to start a slide, which would stall a pill that was
    // already moving, so it only starts early when the page is slow.
    const direction = directionOf(currentPath, url.pathname);
    let pillMoved = false;
    const movePill = () => {
      if (pillMoved || id !== navigation) return;
      pillMoved = true;
      if (window.VPPill) window.VPPill.moveTo(url.pathname);
    };
    const pillTimer = native.setTimeout(movePill, canSlide ? PILL_HEAD_START_MS : 0);

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
      // Set after the old page's picture is taken, so only the incoming
      // page has its blurs paused.
      if (canSlide) {
        root.classList.add("vp-sliding");
        root.dataset.vpPhase = "new";
      }
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
      root.dataset.vpPhase = "old";

      const transition = document.startViewTransition(showNewPage);

      transition.ready
        .then(() => {
          native.clearTimeout(pillTimer);
          movePill();
        })
        .catch(movePill);

      try {
        await transition.finished;
      } catch (error) {
        // Skipped by a newer switch; that one finishes the job.
      }

      if (id === navigation) {
        delete root.dataset.vpDirection;
        delete root.dataset.vpPhase;
        root.classList.remove("vp-switching", "vp-sliding");
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

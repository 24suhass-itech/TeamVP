/* Liquid glass refraction for the navbar.
   Builds an SVG displacement filter shaped to the navbar's pill so the
   page behind its edges bends like real glass. Only Chromium browsers
   support SVG filters in backdrop-filter; others keep the CSS glass look. */
(() => {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;

  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const isChromium = brands.some((item) => /Chromium/.test(item.brand));
  if (!isChromium) return;

  const SVG_NS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.setAttribute("data-vp-persist", ""); // kept when router.js swaps pages
  svg.innerHTML = `
    <filter id="liquid-glass-filter" filterUnits="userSpaceOnUse"
            x="0" y="0" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
      <feImage result="map" x="0" y="0" preserveAspectRatio="none" />
      <feDisplacementMap in="blur" in2="map" xChannelSelector="R"
                         yChannelSelector="G" result="refracted" />
      <feColorMatrix in="refracted" type="saturate" values="1.7" result="vivid" />
      <feComponentTransfer in="vivid">
        <feFuncR type="linear" slope="1.08" />
        <feFuncG type="linear" slope="1.08" />
        <feFuncB type="linear" slope="1.08" />
      </feComponentTransfer>
    </filter>`;
  document.body.appendChild(svg);

  const filter = svg.querySelector("filter");
  const image = svg.querySelector("feImage");
  const displacement = svg.querySelector("feDisplacementMap");

  // Red/green encode how far each pixel samples inward from the pill edge.
  const buildMap = (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    const pixels = context.createImageData(width, height);
    const radius = height / 2;
    const bevel = Math.min(radius, 22);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const nearestX = Math.min(Math.max(px, radius), width - radius);
        const vx = px - nearestX;
        const vy = py - radius;
        const length = Math.hypot(vx, vy);
        const depth = radius - length;

        let dx = 0;
        let dy = 0;

        if (depth < bevel && length > 0) {
          // Curved glass: bending grows sharply toward the rim.
          const t = 1 - Math.max(depth, 0) / bevel;
          const strength = 1 - Math.sqrt(1 - t * t);
          dx = (-vx / length) * strength;
          dy = (-vy / length) * strength;
        }

        const i = (y * width + x) * 4;
        pixels.data[i] = 128 + dx * 127;
        pixels.data[i + 1] = 128 + dy * 127;
        pixels.data[i + 2] = 128;
        pixels.data[i + 3] = 255;
      }
    }

    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL();
  };

  let lastSize = "";

  const update = () => {
    const width = Math.round(navbar.offsetWidth);
    const height = Math.round(navbar.offsetHeight);
    const size = `${width}x${height}`;

    if (!width || !height || size === lastSize) return;
    lastSize = size;

    filter.setAttribute("width", width);
    filter.setAttribute("height", height);
    image.setAttribute("width", width);
    image.setAttribute("height", height);
    image.setAttribute("href", buildMap(width, height));
    displacement.setAttribute("scale", Math.min(height * 0.55, 40));

    document.documentElement.classList.add("liquid-glass");
  };

  let frame = 0;
  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }).observe(navbar);

  update();
})();


/* Liquid glass pill that sits behind the current page link and slides
   to the hovered link, iOS tab bar style. Its last position is kept in
   sessionStorage so it glides from the old link on the next page. */
(() => {
  const navbar = document.querySelector(".navbar");
  if (!navbar) return;

  const links = [...navbar.querySelectorAll(".nav-link")];
  const logo = navbar.querySelector(".logo-link");

  // Current page link matched from the URL (so /events/yuktha/ still
  // highlights Events). Home has no link; the logo stands for it.
  const linkFor = (pathname) => {
    const path = pathname.replace(/index\.html$/, "");

    return links.find((link) => {
      const href = new URL(link.href, location.href).pathname;
      return href !== "/" && path.startsWith(href);
    });
  };

  const markActive = (link) => {
    links.forEach((item) => {
      item.classList.toggle("active", item === link);
      if (item === link) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });
  };

  let active = navbar.querySelector(".nav-link.active") || linkFor(location.pathname);
  markActive(active);

  const STORAGE_KEY = "navPillRect";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pill = document.createElement("span");
  pill.className = "nav-pill";
  pill.setAttribute("aria-hidden", "true");
  navbar.prepend(pill);
  navbar.classList.add("has-nav-pill");

  let current = null;
  let animation = null;

  // Pill box behind a link, relative to the navbar: nearly the full bar
  // height like the iOS tab bar, with room either side of the text.
  const rectFor = (element) => {
    const nav = navbar.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const navStyles = getComputedStyle(navbar);
    const fontSize = parseFloat(getComputedStyle(element).fontSize) || 16;
    const padX = element === logo
      ? 0
      : (parseFloat(navStyles.getPropertyValue("--pill-pad-x")) || 1) * fontSize;
    const inset = parseFloat(navStyles.getPropertyValue("--pill-inset")) || 6;
    const height = navbar.clientHeight - inset * 2;
    // Short words still get a capsule, not a circle.
    const width = Math.max(box.width + padX * 2, height * 1.2);
    const centre = box.left - nav.left - navbar.clientLeft + box.width / 2;
    const edge = Math.min(inset, 6);
    const x = Math.min(
      Math.max(centre - width / 2, edge),
      navbar.clientWidth - edge - width
    );

    return { x, y: inset, w: width, h: height };
  };

  const frameFor = (rect) => ({
    transform: `translate(${rect.x}px, ${rect.y}px)`,
    width: `${rect.w}px`,
    height: `${rect.h}px`
  });

  const place = (rect) => {
    if (animation) animation.cancel();
    Object.assign(pill.style, frameFor(rect));
    current = rect;
  };

  const slideTo = (rect) => {
    if (!current || reduceMotion) return place(rect);

    const from = current;
    const distance = Math.abs(rect.x - from.x);

    // Stretch wide and squash slightly mid-flight, like a liquid drop.
    const middle = {
      x: (from.x + rect.x) / 2 - distance * 0.06,
      w: (from.w + rect.w) / 2 + distance * 0.12,
      h: ((from.h + rect.h) / 2) * 0.9,
      y: 0
    };
    middle.y = (from.y + rect.y) / 2 + ((from.h + rect.h) / 2 - middle.h) / 2;

    if (animation) animation.cancel();
    Object.assign(pill.style, frameFor(rect));
    current = rect;

    // The pill is already sized for where it ends up; on the way it is
    // only moved and stretched (a transform), which the GPU animates by
    // itself, so a busy page can't make it stutter.
    const stretchTo = (box) =>
      `translate(${box.x}px, ${box.y}px) scale(${box.w / rect.w}, ${box.h / rect.h})`;

    animation = pill.animate(
      [
        { transform: stretchTo(from) },
        { transform: stretchTo(middle), offset: 0.45 },
        { transform: stretchTo(rect) }
      ],
      { duration: 520, easing: "cubic-bezier(0.22, 1.2, 0.36, 1)" }
    );
  };

  const show = (visible) => pill.classList.toggle("visible", visible);

  // Appear at once (no fade), so a glide from the previous page reads as one motion.
  const showInstantly = () => {
    pill.style.transition = "none";
    show(true);
    pill.getBoundingClientRect();
    pill.style.transition = "";
  };

  const restingRect = () => (active ? rectFor(active) : null);

  const init = () => {
    let saved = null;

    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      saved = null;
    }

    const target = restingRect();

    if (saved && target) {
      // Arrived from another page: glide from the previous link.
      place(saved);
      showInstantly();
      requestAnimationFrame(() => slideTo(target));
    } else if (saved && logo) {
      // Arrived on the home page: glide into the logo and fade away.
      place(saved);
      showInstantly();
      requestAnimationFrame(() => {
        slideTo(rectFor(logo));
        show(false);
      });
    } else if (target) {
      place(target);
      show(true);
    }
  };

  // Remember where the pill was so the next page can continue the slide.
  // Skipped when router.js handles the click (no reload, pill just glides).
  [...links, logo].filter(Boolean).forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;

      // From the home page the pill starts out of the logo.
      const rect = pill.classList.contains("visible")
        ? current
        : restingRect() || (logo && rectFor(logo));
      if (!rect) return;

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rect));
      } catch (error) {
        // Storage unavailable: the next page simply starts in place.
      }
    });
  });

  // Keep the pill on its link when the navbar resizes. The observer also
  // fires once on start; skip that so it can't cut the arrival glide short.
  let navSize = "";

  new ResizeObserver(() => {
    const size = `${navbar.offsetWidth}x${navbar.offsetHeight}`;
    const firstCall = !navSize;

    if (size === navSize) return;
    navSize = size;
    if (firstCall) return;

    const target = pill.classList.contains("visible") ? restingRect() : null;
    if (target) place(target);
  }).observe(navbar);

  // Back/forward cache restores the page as it was left (pill on the
  // clicked link), so settle it back on this page's link.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;

    const target = restingRect();

    if (target) {
      place(target);
      show(true);
    } else {
      show(false);
    }
  });

  // Page switch without a reload (router.js): glide to the new page's
  // link straight away, out of the logo when leaving home, into it when
  // going home.
  window.VPPill = {
    moveTo(pathname) {
      const next = linkFor(pathname);
      const visible = pill.classList.contains("visible");

      active = next;
      markActive(next);

      if (next) {
        if (!visible) {
          place(logo ? rectFor(logo) : rectFor(next));
          showInstantly();
        }
        slideTo(rectFor(next));
      } else if (visible && logo) {
        slideTo(rectFor(logo));
        show(false);
      }
    }
  };

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(init);
})();

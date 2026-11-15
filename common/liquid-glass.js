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

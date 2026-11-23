/* =========================================================
   EXPLORE POP-UP (Drones page)
   The drone assembly animation that used to sit on the home
   page, now inside a liquid glass pop-up. Scrolling inside the
   pop-up plays the frames; spec cards spring in along the right
   of the frame while their part is on screen.

   Opening and closing is handled by /popup.js (the EXPLORE
   button carries data-specs="<dialog id>"). This file only
   runs the animation. Frames are downloaded the first time the
   button is hovered, focused or clicked, not on page load.
   ========================================================= */

const TOTAL_FRAMES = 720;

const framePath = (number) => `/frames/${number}.jpg`;

// Spring feel: higher stiffness = quicker, lower damping = more wobble
const SPEC_STIFFNESS = 170;
const SPEC_DAMPING = 15;

// Card centre path, as fractions of the frame (cubic Bezier, top to bottom)
const SPEC_PATH = [
  [0.97, 0.00],
  [0.87, 0.35],
  [0.87, 0.65],
  [1.00, 1.00]
];

const reduceMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)");

function pointOnPath(t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;

  return [0, 1].map((k) =>
    a * SPEC_PATH[0][k] +
    b * SPEC_PATH[1][k] +
    c * SPEC_PATH[2][k] +
    d * SPEC_PATH[3][k]
  );
}


document.querySelectorAll(".explore-dialog").forEach((dialog) => {

  const scroller = dialog.querySelector(".explore-scroller");
  const frameWrap = dialog.querySelector(".frame-wrap");
  const canvas = dialog.querySelector(".explore-canvas");
  const progressBar = dialog.querySelector(".progress-bar");
  const hint = dialog.querySelector(".explore-hint");
  const buttons = document.querySelectorAll(`[data-specs="${dialog.id}"]`);

  if (!scroller || !frameWrap || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });

  const images = [];
  let currentFrame = 0;
  let ticking = false;


  /* =========================
     FRAMES
  ========================= */

  function preloadImages() {
    if (images.length) return;

    for (let number = 1; number <= TOTAL_FRAMES; number++) {
      const image = new Image();
      image.src = framePath(number);
      images.push(image);
    }

    // Draw the first frame as soon as it arrives, and whichever
    // frame is current if it was still loading when scrolled to
    images[0].addEventListener("load", () => drawFrame(currentFrame));
    images.forEach((image, index) => {
      image.addEventListener("load", () => {
        if (index === currentFrame) drawFrame(index);
      });
    });
  }

  function drawFrame(index) {
    const image = images[index];

    if (!image || !image.complete || !image.naturalWidth) return;
    if (!canvas.width || !canvas.height) return;

    // Fill the frame (crop slightly if it is shorter than 16:9)
    const scale = Math.max(
      canvas.width / image.naturalWidth,
      canvas.height / image.naturalHeight
    );

    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    ctx.fillStyle = "#020307";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      image,
      (canvas.width - width) / 2,
      (canvas.height - height) / 2,
      width,
      height
    );
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);

    drawFrame(currentFrame);
    updateSpecCards(lastSpecFrame);
  }


  /* =========================
     SCROLL
  ========================= */

  function updateScroll() {
    ticking = false;

    const distance = scroller.scrollHeight - scroller.clientHeight;
    const progress = distance > 0
      ? Math.max(0, Math.min(1, scroller.scrollTop / distance))
      : 0;

    const nextFrame = Math.min(
      TOTAL_FRAMES - 1,
      Math.floor(progress * (TOTAL_FRAMES - 1))
    );

    if (progressBar) progressBar.style.width = `${progress * 100}%`;
    if (hint) hint.classList.toggle("hidden", progress > 0.02);

    updateSpecCards(progress * (TOTAL_FRAMES - 1));

    if (nextFrame !== currentFrame) {
      currentFrame = nextFrame;
      drawFrame(currentFrame);
    }
  }

  function requestScrollUpdate() {
    if (!ticking) {
      window.requestAnimationFrame(updateScroll);
      ticking = true;
    }
  }

  scroller.addEventListener("scroll", requestScrollUpdate, { passive: true });


  /* =========================
     SPEC CARDS
     The frame number only decides WHEN a card is shown
     (between its data-start and data-end frames). Once
     triggered, the card springs in on its own timing,
     like iOS: up from the bottom-right corner, a soft
     wobble as it settles in the centre of the right
     side, then springs out through the top-right when
     its frames are over. Scrolling back reverses it.
  ========================= */

  const specCards =
    [...dialog.querySelectorAll(".spec-card")].map((el) => ({
      el,
      start: Number(el.dataset.start) - 1,  // HTML uses 1-based frames
      end: Number(el.dataset.end) - 1,
      pos: 0,       // 0 = bottom-right, 0.5 = centre, 1 = top-right
      vel: 0,
      target: 0
    }));

  let lastSpecFrame = 0;
  let specAnimating = false;
  let specLastTime = 0;

  function renderSpecCard(card) {
    const { el, pos } = card;

    // Fully visible near the centre, fading out towards either end
    const distance = Math.abs(pos - 0.5);
    const opacity = Math.max(0, Math.min(1, 1 - (distance - 0.22) / 0.26));

    if (opacity <= 0.001) {
      el.style.opacity = "0";
      el.style.visibility = "hidden";
      return;
    }

    const W = frameWrap.clientWidth;
    const H = frameWrap.clientHeight;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    let x;
    let y;

    if (W < 600) {
      // Phones: ride just below the frame, rising a little
      x = (W - cw) / 2;
      y = H + 24 + (0.5 - pos) * 120;
    } else {
      // pos 0 is the bottom of the path, 1 the top
      const [px, py] = pointOnPath(1 - pos);
      x = px * W - cw / 2;
      y = py * H - ch / 2;
    }

    const scale = 0.94 + 0.06 * opacity;

    el.style.visibility = "visible";
    el.style.opacity = opacity.toFixed(3);
    el.style.transform =
      `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
  }

  function stepSpecCards(now) {
    const dt = Math.min(0.033, (now - specLastTime) / 1000 || 0.016);
    specLastTime = now;

    let moving = false;

    specCards.forEach((card) => {
      const force =
        -SPEC_STIFFNESS * (card.pos - card.target) -
        SPEC_DAMPING * card.vel;

      card.vel += force * dt;
      card.pos += card.vel * dt;

      if (
        Math.abs(card.vel) < 0.0005 &&
        Math.abs(card.pos - card.target) < 0.0005
      ) {
        card.pos = card.target;
        card.vel = 0;
      } else {
        moving = true;
      }

      renderSpecCard(card);
    });

    if (moving) {
      window.requestAnimationFrame(stepSpecCards);
    } else {
      specAnimating = false;
    }
  }

  function updateSpecCards(frame) {
    lastSpecFrame = frame;

    specCards.forEach((card) => {
      // frame stays at 0 until the pop-up is scrolled, so the
      // first card waits for the first scroll
      const active = frame > 0 && frame >= card.start && frame <= card.end;
      const hidden = Math.abs(card.pos - 0.5) >= 0.48;

      // Before its frames it waits below; after them it leaves upwards
      const target = active ? 0.5 : (frame > card.end ? 1 : 0);

      // Out of view on the wrong side: jump across without animating
      if (!active && hidden) {
        card.pos = target;
        card.vel = 0;
      }

      card.target = target;

      if (reduceMotion.matches) {
        card.pos = target;
        card.vel = 0;
      }

      renderSpecCard(card);
    });

    if (!specAnimating && !reduceMotion.matches) {
      specAnimating = true;
      specLastTime = performance.now();
      window.requestAnimationFrame(stepSpecCards);
    }
  }


  /* =========================
     OPEN / RESIZE
  ========================= */

  buttons.forEach((button) => {
    button.addEventListener("pointerenter", preloadImages, { once: true });
    button.addEventListener("focus", preloadImages, { once: true });

    // popup.js opens the dialog on this same click; start every
    // visit from the first frame
    button.addEventListener("click", () => {
      preloadImages();
      scroller.scrollTop = 0;
      window.requestAnimationFrame(() => {
        resizeCanvas();
        updateScroll();
      });
    });
  });

  // The canvas has no size while the pop-up is closed, so it is
  // measured again whenever the frame changes size (opening it,
  // rotating a phone, resizing the window).
  if ("ResizeObserver" in window) {
    new ResizeObserver(resizeCanvas).observe(frameWrap);
  } else {
    window.addEventListener("resize", resizeCanvas);
  }
});

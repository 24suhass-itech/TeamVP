const TOTAL_FRAMES = 720;
const FRAME_EXTENSION = ".jpg";

const canvas = document.getElementById("droneCanvas");

const ctx = canvas.getContext("2d", {
  alpha: false
});

const assembly =
  document.querySelector(".assembly");

const assemblySticky =
  document.querySelector(".assembly-sticky");

const progressBar =
  document.getElementById("progressBar");

const frameNumber =
  document.getElementById("frameNumber");

const images = [];

let currentFrame = 0;
let ticking = false;


/* =========================
   REALISTIC TYPING ANIMATION
========================= */

const typedText =
  document.getElementById("typedText");

const cursor =
  document.querySelector(".typing-cursor");

const textToType =
  "TEAM\nVAYUPUTRA";

let characterIndex = 0;

const typingSpeed = 150;


/* =========================
   UPDATE CURSOR POSITION
========================= */

function updateCursorPosition() {

  const range =
    document.createRange();

  if (typedText.firstChild) {

    range.setStart(
      typedText.firstChild,
      typedText.firstChild.length
    );

    range.setEnd(
      typedText.firstChild,
      typedText.firstChild.length
    );

  } else {

    range.setStart(
      typedText,
      0
    );

    range.setEnd(
      typedText,
      0
    );

  }

  const rect =
    range.getBoundingClientRect();

  const parentRect =
    typedText.parentElement
      .getBoundingClientRect();

  cursor.style.position =
    "absolute";

  cursor.style.left =
    `${rect.right - parentRect.left}px`;

  cursor.style.top =
    `${rect.bottom - parentRect.top - rect.height}px`;

}


/* =========================
   TYPING FUNCTION
========================= */

function typeText() {

  if (
    characterIndex <
    textToType.length
  ) {

    typedText.textContent +=
      textToType.charAt(
        characterIndex
      );

    characterIndex++;

    updateCursorPosition();

    setTimeout(
      typeText,
      typingSpeed
    );

  } else {

    updateCursorPosition();

  }

}


typeText();


/* =========================
   UPDATE CURSOR ON RESIZE
========================= */

window.addEventListener(
  "resize",
  updateCursorPosition
);


/* =========================
   FRAME PATH
========================= */

function framePath(number) {

  return `/frames/${number}${FRAME_EXTENSION}`;

}


/* =========================
   CANVAS RESIZE
========================= */

function resizeCanvas() {

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );

  canvas.width =
    Math.floor(
      canvas.clientWidth * dpr
    );

  canvas.height =
    Math.floor(
      canvas.clientHeight * dpr
    );

  drawFrame(currentFrame);

  updateSpecCards(lastSpecFrame);

}


/* =========================
   DRAW FRAME
========================= */

function drawFrame(index) {

  const image =
    images[index];

  if (
    !image ||
    !image.complete ||
    !image.naturalWidth
  ) {

    return;

  }

  // Fill the frame (crop slightly if it is shorter than 16:9)
  const scale =
    Math.max(
      canvas.width /
        image.naturalWidth,

      canvas.height /
        image.naturalHeight
    );

  const width =
    image.naturalWidth *
    scale;

  const height =
    image.naturalHeight *
    scale;

  const x =
    (canvas.width - width) / 2;

  const y =
    (canvas.height - height) / 2;


  ctx.fillStyle =
    "#020307";

  ctx.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  ctx.drawImage(
    image,
    x,
    y,
    width,
    height
  );


  if (frameNumber) {
    frameNumber.textContent =
      `Frame ${index + 1} / ${TOTAL_FRAMES}`;
  }

}


/* =========================
   SCROLL ANIMATION
========================= */

function updateScroll() {

  ticking = false;

  const rect =
    assembly.getBoundingClientRect();

  /* How far the pinned panel can travel. Measuring the panel
     rather than assuming a full screen matters on phones, where
     it is only as tall as the framed animation. */
  const distance =
    assembly.offsetHeight -
    (assemblySticky
      ? assemblySticky.offsetHeight
      : window.innerHeight);

  const progress =
    Math.max(
      0,
      Math.min(
        1,
        -rect.top / distance
      )
    );

  const nextFrame =
    Math.min(
      TOTAL_FRAMES - 1,

      Math.floor(
        progress *
        (TOTAL_FRAMES - 1)
      )
    );


  progressBar.style.width =
    `${progress * 100}%`;

  updateSpecCards(
    progress * (TOTAL_FRAMES - 1)
  );


  if (
    nextFrame !== currentFrame
  ) {

    currentFrame =
      nextFrame;

    drawFrame(
      currentFrame
    );

  }

}


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
  [...document.querySelectorAll(".spec-card")].map((el) => ({
    el,
    start: Number(el.dataset.start) - 1,  // HTML uses 1-based frames
    end: Number(el.dataset.end) - 1,
    pos: 0,       // 0 = bottom-right, 0.5 = centre, 1 = top-right
    vel: 0,
    target: 0
  }));

const frameWrap =
  document.querySelector(".frame-wrap");

let lastSpecFrame = 0;
let specAnimating = false;
let specLastTime = 0;

const reduceMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)");

// Spring feel: higher stiffness = quicker, lower damping = more wobble
const SPEC_STIFFNESS = 170;
const SPEC_DAMPING = 15;

// Card centre path, as fractions of the frame (cubic Bezier, top to bottom)
const SPEC_PATH = [
  [0.90, 0.00],
  [0.80, 0.35],
  [0.80, 0.65],
  [0.93, 1.00]
];

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
    y = H + 28 + (0.5 - pos) * 140;
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

  if (!frameWrap) return;

  /* On a phone the card sits below the animation rather than over
     it, so the panel reserves room for it. Letting the last card
     run to the final frame keeps that room filled right up to the
     moment the section underneath slides into its place. */
  const holdLast = frameWrap.clientWidth < 600;
  const lastCard = specCards[specCards.length - 1];

  specCards.forEach((card) => {

    const end = (holdLast && card === lastCard)
      ? TOTAL_FRAMES - 1
      : card.end;

    // frame stays at 0 until the animation section reaches the
    // top of the screen, so nothing triggers while on the hero
    const active =
      frame > 0 && frame >= card.start && frame <= end;
    const hidden = Math.abs(card.pos - 0.5) >= 0.48;

    // Before its frames it waits below; after them it leaves upwards
    const target = active ? 0.5 : (frame > end ? 1 : 0);

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
   REQUEST SCROLL UPDATE
========================= */

function requestScrollUpdate() {

  if (!ticking) {

    window.requestAnimationFrame(
      updateScroll
    );

    ticking = true;

  }

}


/* =========================
   PRELOAD IMAGES
========================= */

function preloadImages() {

  for (
    let number = 1;
    number <= TOTAL_FRAMES;
    number++
  ) {

    const image =
      new Image();

    image.src =
      framePath(number);

    images.push(image);

  }


  images[0].addEventListener(
    "load",
    () => {

      resizeCanvas();

      updateScroll();

    }
  );

}


/* =========================
   EVENTS
========================= */

window.addEventListener(
  "resize",
  resizeCanvas
);

window.addEventListener(
  "scroll",
  requestScrollUpdate,
  {
    passive: true
  }
);


/* =========================
   INITIALIZE DRONE FRAMES
========================= */

preloadImages();


/* =========================
   HERO POLAROID
   Fades in once the mouse moves. The cursor itself
   lives in /common/cursor.js, shared by every page.
========================= */

const mousePolaroid =
  document.querySelector(".mouse-polaroid");

if (mousePolaroid) {

  document.addEventListener(
    "mousemove",
    () => {

      mousePolaroid.classList.add("active");

    }
  );


  document.addEventListener(
    "mouseleave",
    () => {

      mousePolaroid.classList.remove("active");

    }
  );

}

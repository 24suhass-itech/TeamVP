
const TOTAL_FRAMES = 720;
const FRAME_EXTENSION = ".jpg";

const canvas = document.getElementById("droneCanvas");

const ctx = canvas.getContext("2d", {
  alpha: false
});

const assembly = document.querySelector(".assembly");

const progressBar = document.getElementById("progressBar");

const frameNumber = document.getElementById("frameNumber");

const images = [];

let currentFrame = 0;
let ticking = false;

/* =========================
   REALISTIC TYPING ANIMATION
========================= */

const typedText = document.getElementById("typedText");
const cursor = document.querySelector(".typing-cursor");

const textToType = "TEAM\nVAYUPUTRA";

let characterIndex = 0;

const typingSpeed = 150;


/* =========================
   UPDATE CURSOR POSITION
========================= */

function updateCursorPosition() {

  const range = document.createRange();

  const selection = window.getSelection();

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

    range.setStart(typedText, 0);
    range.setEnd(typedText, 0);

  }

  const rect = range.getBoundingClientRect();

  const parentRect =
    typedText.parentElement.getBoundingClientRect();

  cursor.style.position = "absolute";

  cursor.style.left =
    `${rect.right - parentRect.left}px`;

  cursor.style.top =
    `${rect.bottom - parentRect.top - rect.height}px`;

}


/* =========================
   TYPING FUNCTION
========================= */

function typeText() {

  if (characterIndex < textToType.length) {

    typedText.textContent +=
      textToType.charAt(characterIndex);

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
   UPDATE ON RESIZE
========================= */

window.addEventListener(
  "resize",
  updateCursorPosition
);
/* =========================
   FRAME PATH
========================= */

function framePath(number) {
  return `frames/${number}${FRAME_EXTENSION}`;
}


/* =========================
   CANVAS RESIZE
========================= */

function resizeCanvas() {
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  canvas.width = Math.floor(
    window.innerWidth * dpr
  );

  canvas.height = Math.floor(
    window.innerHeight * dpr
  );

  drawFrame(currentFrame);
}


/* =========================
   DRAW FRAME
========================= */

function drawFrame(index) {
  const image = images[index];

  if (
    !image ||
    !image.complete ||
    !image.naturalWidth
  ) {
    return;
  }

  const scale = Math.min(
    canvas.width / image.naturalWidth,
    canvas.height / image.naturalHeight
  );

  const width = image.naturalWidth * scale;

  const height = image.naturalHeight * scale;

  const x = (canvas.width - width) / 2;

  const y = (canvas.height - height) / 2;


  ctx.fillStyle = "#020307";

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


  frameNumber.textContent =
    `Frame ${index + 1} / ${TOTAL_FRAMES}`;
}


/* =========================
   SCROLL ANIMATION
========================= */

function updateScroll() {
  ticking = false;

  const rect = assembly.getBoundingClientRect();

  const distance =
    assembly.offsetHeight - window.innerHeight;

  const progress = Math.max(
    0,
    Math.min(
      1,
      -rect.top / distance
    )
  );

  const nextFrame = Math.min(
    TOTAL_FRAMES - 1,
    Math.floor(
      progress * (TOTAL_FRAMES - 1)
    )
  );


  progressBar.style.width =
    `${progress * 100}%`;


  if (nextFrame !== currentFrame) {
    currentFrame = nextFrame;

    drawFrame(currentFrame);
  }
}


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
    const image = new Image();

    image.src = framePath(number);

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
   INITIALIZE
========================= */

preloadImages();
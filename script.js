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

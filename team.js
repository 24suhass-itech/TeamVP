/* =========================================================
   VP REVOLVER
========================================================= */

const vpNames = [
  "VP4",
  "VP3",
  "VP2"
];


/* =========================================================
   ELEMENTS
========================================================= */

const vpSelector =
  document.querySelector(".vp-selector");

const vpTrack =
  document.querySelector(".vp-track");

const vpItems =
  document.querySelectorAll(".vp-item");


/* =========================================================
   CURRENT POSITION
========================================================= */

let currentIndex = 0;
let currentGeneration = "VP4";


/* =========================================================
   SCROLL CONTROL
========================================================= */

let wheelAccumulator = 0;

/* =========================================================
   UPDATE DISPLAY
========================================================= */

function updateVP() {
  vpItems.forEach((item, index) => {
    item.classList.toggle("is-active", index === currentIndex);
  });
  vpTrack.style.transform = `translateY(${-22 - currentIndex * 44}px)`;
}


/* =========================================================
   CHANGE VP
========================================================= */

function changeVP(direction) {
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= vpNames.length) return;
  currentIndex = nextIndex;
  currentGeneration = vpNames[currentIndex];
  updateVP();
  renderActiveDivision(direction > 0 ? "up" : "down");
}


/* =========================================================
   MOUSE WHEEL
   SCROLL ONLY INSIDE REVOLVER
========================================================= */

vpSelector.addEventListener(
  "wheel",
  (event) => {

    event.preventDefault();

    event.stopPropagation();


    wheelAccumulator +=
      event.deltaY;


    const threshold = 50;


    if (
      Math.abs(
        wheelAccumulator
      ) < threshold
    ) {

      return;

    }


    /* SCROLL DOWN */

    if (
      wheelAccumulator > 0
    ) {

      changeVP(1);

    }


    /* SCROLL UP */

    else {

      changeVP(-1);

    }


    wheelAccumulator = 0;

  },
  {
    passive: false
  }
);


/* =========================================================
   TOUCH / SWIPE SUPPORT
========================================================= */

let touchStartY = 0;


vpSelector.addEventListener(
  "touchstart",
  (event) => {

    touchStartY =
      event.touches[0].clientY;

  },
  {
    passive: true
  }
);


vpSelector.addEventListener(
  "touchend",
  (event) => {

    const touchEndY =
      event.changedTouches[0].clientY;


    const difference =
      touchStartY - touchEndY;


    if (
      Math.abs(difference) < 40
    ) {

      return;

    }


    /* Swipe UP */

    if (
      difference > 0
    ) {

      changeVP(1);

    }


    /* Swipe DOWN */

    else {

      changeVP(-1);

    }

  },
  {
    passive: true
  }
);


/* =========================================================
   INITIALIZE
========================================================= */

updateVP();


/* =========================================================
   DECRYPT TITLE ANIMATION
========================================================= */

const decryptTitle =
  document.getElementById("decryptTitle");

if (decryptTitle) {

  const finalText =
    "MEET THE TEAM BEHIND THE TECH";

  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>[]{}";

  let iteration = 0;

  decryptTitle.classList.add("active");
  decryptTitle.classList.add("decrypting");

  const decryptInterval =
    setInterval(() => {

      decryptTitle.textContent =
        finalText
          .split("")
          .map((char, index) => {

            if (char === " ") {
              return " ";
            }

            if (index < iteration) {
              return char;
            }

            return characters[
              Math.floor(
                Math.random() *
                characters.length
              )
            ];

          })
          .join("");

      iteration += 0.5;


      if (
        iteration >=
        finalText.length
      ) {

        clearInterval(
          decryptInterval
        );

        decryptTitle.textContent =
          finalText;

        decryptTitle.classList.remove(
          "decrypting"
        );

      }

    }, 45);

}


/* =========================================================
   TEAM DIVISION NAVIGATION
   A liquid glass bar: the glass pill glides to the chosen
   division and the cards slide sideways, like switching pages.
========================================================= */

const divisionNav =
  document.querySelector(
    ".division-nav"
  );

const divisionButtons =
  Array.from(
    document.querySelectorAll(
      ".division-btn"
    )
  );

const personCards =
  document.querySelectorAll(
    ".person-card"
  );

document.querySelectorAll(".vp3-photo img").forEach((image) => {
  const showFallback = () => {
    image.parentElement.classList.add("photo-missing");
  };

  image.addEventListener("error", showFallback);
  if (image.complete && image.naturalWidth === 0) showFallback();
});

const teamGrid =
  document.querySelector(
    ".team-grid"
  );

const originalCardOrder = new Map(
  Array.from(personCards).map((card, index) => [card, index])
);

const reduceMotion =
  matchMedia("(prefers-reduced-motion: reduce)").matches;

let activeDivision = "all";


/* =========================================================
   CARDS FOR A DIVISION
========================================================= */

function cardsFor(division) {

  const selectedCards =
    Array.from(personCards).filter(
      (card) => {

        const cardDivisions =
          card.dataset.division
            .split(" ");

        const isSharedMentor =
          cardDivisions.includes("mentors");

        const cardGeneration =
          card.dataset.generation || "VP4";


        /*
          A card can belong to
          multiple divisions.

          Example:

          data-division="management hardware"

          Therefore Nithilan,
          Kathirvel and Mohanaa
          appear in BOTH filters.
        */

        return (
          (isSharedMentor || cardGeneration === currentGeneration) &&
          (division === "all" ||
            cardDivisions.includes(division))
        );

      }
    );

  selectedCards.sort(
    (a, b) => originalCardOrder.get(a) - originalCardOrder.get(b)
  );


  /* =================================================
     HARDWARE-SPECIFIC ORDER
  ================================================= */

  if (
    division ===
    "hardware"
  ) {

    /*
      Required Hardware order:

      1. Charunetraa
      2. Nithilan
      3. Kathirvel
      4. Mohanaa
      5. Kaviprasadh
      6. Leonard
      7. Pranati
      8. Vishal
    */

    const hardwareOrder = currentGeneration === "VP3"
      ? {
          "Gautam VR": 1,
          "Shruthi B": 2,
          "Nivashini N": 3,
          "Aadhitya TS": 4,
          "Charunetraa PL": 5,
          "Kathirvel M": 6,
          "Mohanaa Praveena S": 7,
          "Nithilan RS": 8
        }
      : {
          "Charunetraa P L": 1,
          "Nithilan R S": 2,
          "Kathirvel M": 3,
          "Mohanaa Praveena S": 4,
          "Kaviprasadh AM": 5,
          "Leonard Novel A L": 6,
          "Pranati Miras J": 7,
          "Vishal R": 8
        };


    selectedCards.sort(
      (a, b) => {

        const nameA =
          a.querySelector(
            "h3"
          )?.textContent.trim();

        const nameB =
          b.querySelector(
            "h3"
          )?.textContent.trim();


        return (
          (hardwareOrder[nameA] ||
            999) -

          (hardwareOrder[nameB] ||
            999)
        );

      }
    );

  }

  if (
    division === "mechanical" &&
    currentGeneration === "VP3"
  ) {
    const mechanicalOrder = {
      "Sanjay Krishna J": 1,
      "Aswin MC": 2,
      "Narenkrishna M": 3,
      "Sanjay R": 4,
      "Vishnu": 5,
      "Lohan R": 6
    };

    selectedCards.sort((a, b) => {
      const nameA = a.querySelector("h3")?.textContent.trim();
      const nameB = b.querySelector("h3")?.textContent.trim();
      return mechanicalOrder[nameA] - mechanicalOrder[nameB];
    });
  }

  return selectedCards;

}


/* Show only the division's cards, in order. */

function showCards(division) {

  const selectedCards =
    cardsFor(division);

  personCards.forEach(
    (card) => {
      card.style.display = "none";
    }
  );

  selectedCards.forEach(
    (card) => {
      card.style.display = "";
      teamGrid.appendChild(card);
    }
  );

}


/* =========================================================
   GLASS PILL
   Same pill as the navbar's (styled in navbar.css).
========================================================= */

const divisionPill =
  document.createElement("span");

divisionPill.className = "nav-pill visible";
divisionPill.setAttribute("aria-hidden", "true");
divisionNav.prepend(divisionPill);

let pillBox = null;
let pillAnimation = null;

const activeButton = () =>
  divisionButtons.find(
    (button) => button.dataset.division === activeDivision
  );

const boxFor = (button) => ({
  x: button.offsetLeft,
  y: button.offsetTop,
  w: button.offsetWidth,
  h: button.offsetHeight
});

function placePill(box) {
  if (pillAnimation) pillAnimation.cancel();

  Object.assign(divisionPill.style, {
    transform: `translate(${box.x}px, ${box.y}px)`,
    width: `${box.w}px`,
    height: `${box.h}px`
  });

  pillBox = box;
}

/* Glide with a slight liquid stretch, moved by the GPU only. */

function glidePill(box) {
  const from = pillBox;

  placePill(box);
  if (!from || reduceMotion) return;

  const distance = Math.hypot(box.x - from.x, box.y - from.y);

  const middle = {
    x: (from.x + box.x) / 2 - distance * 0.06,
    w: (from.w + box.w) / 2 + distance * 0.12,
    h: ((from.h + box.h) / 2) * 0.9,
    y: 0
  };
  middle.y = (from.y + box.y) / 2 + ((from.h + box.h) / 2 - middle.h) / 2;

  const stretchTo = (step) =>
    `translate(${step.x}px, ${step.y}px) scale(${step.w / box.w}, ${step.h / box.h})`;

  pillAnimation = divisionPill.animate(
    [
      { transform: stretchTo(from) },
      { transform: stretchTo(middle), offset: 0.45 },
      { transform: stretchTo(box) }
    ],
    { duration: 520, easing: "cubic-bezier(0.22, 1.2, 0.36, 1)" }
  );
}

/* Keep the pill on its button when the bar resizes or wraps. */

new ResizeObserver(() => {
  placePill(boxFor(activeButton()));
}).observe(divisionNav);


/* =========================================================
   CARD SLIDE
   A copy of the current cards slides out while the real grid,
   already showing the new cards, slides in from the other side.
========================================================= */

const SLIDE_MS = 500;
const SLIDE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

let endSlide = null;

/*
  direction: "left"  → cards leave to the left, new ones come from the right
             "right" → the reverse
             "up" / "down" → for VP generations, matching the selector
*/

function slideCards(direction, update) {

  /* A new switch finishes the previous one straight away. */
  if (endSlide) endSlide();

  if (reduceMotion) {
    update();
    return;
  }

  const content = teamGrid.parentElement;
  const leaving = teamGrid.cloneNode(true);

  leaving.setAttribute("aria-hidden", "true");
  leaving.inert = true;

  Object.assign(leaving.style, {
    position: "absolute",
    top: `${teamGrid.offsetTop}px`,
    left: `${teamGrid.offsetLeft}px`,
    width: `${teamGrid.offsetWidth}px`,
    pointerEvents: "none"
  });

  content.appendChild(leaving);
  content.classList.add("is-sliding");

  update();

  const sideways = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;

  const offset = (amount) =>
    sideways
      ? `translateX(${amount * window.innerWidth}px)`
      : `translateY(${amount * 60}px)`;

  const timing = { duration: SLIDE_MS, easing: SLIDE_EASING };

  const animations = [
    leaving.animate(
      [
        { transform: "none", opacity: 1 },
        { transform: offset(sign), opacity: sideways ? 1 : 0 }
      ],
      timing
    ),
    teamGrid.animate(
      [
        { transform: offset(-sign), opacity: sideways ? 1 : 0 },
        { transform: "none", opacity: 1 }
      ],
      timing
    )
  ];

  const finish = () => {
    if (endSlide !== finish) return;
    endSlide = null;

    animations.forEach((animation) => animation.cancel());
    leaving.remove();
    content.classList.remove("is-sliding");
  };

  endSlide = finish;
  animations[1].finished.then(finish, () => {});

}


/* =========================================================
   DIVISION BUTTON CLICK
========================================================= */

divisionButtons.forEach((button) => {

  button.setAttribute(
    "aria-pressed",
    String(button.classList.contains("active"))
  );

  button.addEventListener(
    "click",
    () => {

      const division =
        button.dataset.division;

      /* Do nothing if already selected */

      if (division === activeDivision) {
        return;
      }

      /* Pick a division to the right: cards move left (and back). */

      const from =
        divisionButtons.indexOf(activeButton());

      const to =
        divisionButtons.indexOf(button);

      activeDivision = division;

      divisionButtons.forEach(
        (btn) => {
          btn.classList.toggle("active", btn === button);
          btn.setAttribute("aria-pressed", String(btn === button));
        }
      );

      glidePill(boxFor(button));

      slideCards(
        to > from ? "left" : "right",
        () => showCards(division)
      );

    }
  );

});


/* =========================================================
   VP GENERATION CHANGE
   Same division, other generation: cards move up or down
   with the VP selector.
========================================================= */

function renderActiveDivision(direction) {
  slideCards(
    direction,
    () => showCards(activeDivision)
  );
}

personCards.forEach((card) => {
  if ((card.dataset.generation || "VP4") !== currentGeneration) {
    card.style.display = "none";
  }
});


/* Contact icons still holding a placeholder (#name-gmail /
   #name-linkedin) do nothing until a real address is added. */

document.querySelectorAll(".person-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (link.getAttribute("href").startsWith("#")) {
      event.preventDefault();
    }
  });
});


/* Decode every photo once the page is idle. Hidden cards' photos are
   otherwise decoded on the first switch, which makes it stall. */

function decodePhotos() {
  personCards.forEach((card) => {
    const photo = card.querySelector(".person-photo img");
    if (photo) photo.decode().catch(() => {});
  });
}

if ("requestIdleCallback" in window) {
  requestIdleCallback(decodePhotos, { timeout: 2000 });
} else {
  setTimeout(decodePhotos, 1500);
}

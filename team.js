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
  renderActiveDivision();
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
   SQUISH → VANISH → SHOW
========================================================= */

const divisionButtons =
  document.querySelectorAll(
    ".division-btn"
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

let isFiltering = false;
let pendingGenerationRender = false;
const originalCardOrder = new Map(
  Array.from(personCards).map((card, index) => [card, index])
);

function renderActiveDivision() {
  if (isFiltering) {
    pendingGenerationRender = true;
    return;
  }

  const activeButton = Array.from(divisionButtons).find((button) =>
    button.classList.contains("active")
  );

  if (!activeButton) return;
  activeButton.classList.remove("active");
  activeButton.click();
}


/* =========================================================
   DIVISION BUTTON CLICK
========================================================= */

divisionButtons.forEach((button) => {

  button.addEventListener(
    "click",
    () => {

      /* Prevent multiple clicks during animation */

      if (isFiltering) {
        return;
      }


      /* Do nothing if already selected */

      if (
        button.classList.contains(
          "active"
        )
      ) {

        return;

      }


      const selectedDivision =
        button.dataset.division;


      isFiltering = true;


      /* ===================================================
         CHANGE ACTIVE BUTTON
      =================================================== */

      divisionButtons.forEach(
        (btn) => {

          btn.classList.remove(
            "active"
          );

        }
      );


      button.classList.add(
        "active"
      );


      /* ===================================================
         STEP 1
         VANISH EVERY CARD
      =================================================== */

      personCards.forEach(
        (card) => {

          card.classList.remove(
            "division-show"
          );

          card.classList.add(
            "division-hide"
          );

        }
      );


      /* ===================================================
         STEP 2
         WAIT FOR VANISH ANIMATION
      =================================================== */

      setTimeout(() => {

        /* Hide every card */

        personCards.forEach(
          (card) => {

            card.style.display =
              "none";

            card.classList.remove(
              "division-hide"
            );

          }
        );


        /* =================================================
           STEP 3
           FIND SELECTED CARDS
        ================================================= */

        let selectedCards = [];


        personCards.forEach(
          (card) => {

            const cardDivisions =
              card.dataset.division
                .split(" ");

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

            if (
              cardGeneration === currentGeneration &&
              (selectedDivision === "all" ||
                cardDivisions.includes(selectedDivision))
            ) {

              selectedCards.push(
                card
              );

            }

          }
        );

        selectedCards.sort(
          (a, b) => originalCardOrder.get(a) - originalCardOrder.get(b)
        );


        /* =================================================
           STEP 4
           HARDWARE-SPECIFIC ORDER
        ================================================= */

        if (
          selectedDivision ===
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
          selectedDivision === "mechanical" &&
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


        /* =================================================
           STEP 5
           PUT SELECTED CARDS BACK IN ORDER
        ================================================= */

        selectedCards.forEach(
          (card) => {

            card.style.display =
              "";

            teamGrid.appendChild(
              card
            );

          }
        );


        /* =================================================
           STEP 6
           PLAY APPEAR ANIMATION
        ================================================= */

        selectedCards.forEach(
          (card) => {

            card.classList.add(
              "division-show"
            );

          }
        );


        /* =================================================
           STEP 7
           CLEAN UP
        ================================================= */

        setTimeout(() => {

          selectedCards.forEach(
            (card) => {

              card.classList.remove(
                "division-show"
              );

            }
          );


          isFiltering = false;

          if (pendingGenerationRender) {
            pendingGenerationRender = false;
            renderActiveDivision();
          }

        }, 500);

      }, 400);

    }
  );

});

personCards.forEach((card) => {
  if ((card.dataset.generation || "VP4") !== currentGeneration) {
    card.style.display = "none";
  }
});

/* The glowing sphere cursor, shared by every page.
   Styles live in /common/cursor.css.

   This file is under /common/, so router.js treats it as a shared
   script: it runs once and keeps running across page switches, and
   its elements carry data-vp-persist so a page swap leaves them be. */

(() => {
  // Only where there is a real pointer: no phones, no tablets.
  if (!matchMedia("(pointer: fine)").matches) return;

  const cursorSphere = document.createElement("div");
  const cursorRipple = document.createElement("div");

  cursorSphere.className = "cursor-sphere";
  cursorRipple.className = "cursor-ripple";

  [cursorSphere, cursorRipple].forEach((element) => {
    element.setAttribute("data-vp-persist", "");
    element.setAttribute("aria-hidden", "true");
  });

  /* An open <dialog> is painted in the browser's top layer, above
     everything else whatever its z-index, so while a pop-up is open
     the sphere has to live inside it to stay visible. */
  const mount = () => {
    const host = document.querySelector("dialog[open]") || document.body;

    if (cursorSphere.parentNode !== host) {
      host.appendChild(cursorSphere);
      host.appendChild(cursorRipple);
    }
  };

  mount();

  new MutationObserver(mount).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open"]
  });

  // Hides the system pointer (see cursor.css)
  document.documentElement.classList.add("vp-cursor-on");

  // Form fields keep the real caret, so the sphere steps aside
  const TYPING = "input, textarea, select, [contenteditable='']," +
    " [contenteditable='true']";

  let mouseX = 0;
  let mouseY = 0;

  let mouseInside = false;


  /* =========================
     MOUSE MOVE
  ========================= */

  document.addEventListener("mousemove", (event) => {

    mouseX = event.clientX;
    mouseY = event.clientY;

    const overField =
      event.target.closest && event.target.closest(TYPING);

    mouseInside = !overField;

    cursorSphere.classList.toggle("active", mouseInside);

  }, { passive: true });


  /* =========================
     MOUSE LEAVE
  ========================= */

  const leave = () => {
    mouseInside = false;
    cursorSphere.classList.remove("active");
  };

  document.addEventListener("mouseleave", leave);
  window.addEventListener("blur", leave);


  /* =========================
     CLICK ANIMATION
  ========================= */

  document.addEventListener("mousedown", () => {

    if (!mouseInside) return;

    cursorSphere.classList.remove("clicking");

    // Force the browser to restart the animation
    void cursorSphere.offsetWidth;

    cursorSphere.classList.add("clicking");

    cursorRipple.style.left = `${mouseX}px`;
    cursorRipple.style.top = `${mouseY}px`;

    cursorRipple.classList.remove("active");

    void cursorRipple.offsetWidth;

    cursorRipple.classList.add("active");

  });


  /* =========================
     SPHERE FOLLOW
  ========================= */

  const follow = () => {

    // A page switch can take the sphere's host with it
    if (!cursorSphere.isConnected) mount();

    cursorSphere.style.left = `${mouseX}px`;
    cursorSphere.style.top = `${mouseY}px`;

    requestAnimationFrame(follow);

  };

  requestAnimationFrame(follow);
})();

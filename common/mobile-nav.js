/* Mobile navigation, shared by every page.

   On phones the glass navbar pill is hidden (see mobile-nav.css) and
   this three-bar button opens a full-screen menu instead. Nothing here
   affects the desktop layout: the button and menu are display:none
   above the mobile breakpoint.

   This file is under /common/, so router.js treats it as a shared
   script: it runs once and keeps running across page switches, and its
   elements carry data-vp-persist so a page swap leaves them be. */

(() => {
  if (document.querySelector(".vp-menu-button")) return;

  const LINKS = [
    ["Home", "/"],
    ["Team", "/team/"],
    ["Challenges", "/challenges/"],
    ["Drones", "/drones/"],
    ["Events", "/events/"],
    ["About Us", "/about/"],
    ["Sponsor Us", "/sponsor/"]
  ];

  /* =========================
     BUILD
  ========================= */

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vp-menu-button";
  button.setAttribute("aria-label", "Open menu");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "vp-menu");
  button.innerHTML = '<span class="bars"><i></i><i></i><i></i></span>';

  const menu = document.createElement("nav");
  menu.className = "vp-menu";
  menu.id = "vp-menu";
  menu.setAttribute("aria-label", "Site menu");

  const panel = document.createElement("div");
  panel.className = "vp-menu-panel";

  LINKS.forEach(([label, href], index) => {
    const link = document.createElement("a");
    link.className = "vp-menu-link";
    link.href = href;
    link.textContent = label;
    // --i staggers the drop-in (see mobile-nav.css)
    link.style.setProperty("--i", index);
    panel.appendChild(link);
  });

  menu.appendChild(panel);

  [button, menu].forEach((element) => {
    element.setAttribute("data-vp-persist", "");
    document.body.appendChild(element);
  });


  /* =========================
     CURRENT PAGE
  ========================= */

  const markCurrent = () => {
    const here = location.pathname;

    panel.querySelectorAll(".vp-menu-link").forEach((link) => {
      const path = new URL(link.href).pathname;

      const current = path === "/"
        ? here === "/"
        : here.startsWith(path);

      link.classList.toggle("is-current", current);

      if (current) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  markCurrent();


  /* =========================
     OPEN / CLOSE
  ========================= */

  let open = false;

  const setOpen = (next) => {
    if (open === next) return;
    open = next;


    menu.classList.toggle("is-open", open);
    button.classList.toggle("is-open", open);

    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close menu" : "Open menu");

    document.documentElement.classList.toggle("vp-menu-locked", open);
  };

  button.addEventListener("click", () => setOpen(!open));

  // Tapping a name closes the menu and router.js swaps the page
  // underneath; tapping anywhere else just closes it.
  menu.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) setOpen(false);
  });

  // Rotating to a wide screen falls back to the desktop navbar
  matchMedia("(max-width: 860px)").addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
  });

  // router.js swaps pages without a reload, so follow along
  addEventListener("popstate", markCurrent);

  const pushState = history.pushState;
  history.pushState = function (...args) {
    const result = pushState.apply(this, args);
    markCurrent();
    return result;
  };
})();

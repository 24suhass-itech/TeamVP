/* Drones and Events pages: a READ MORE button with data-specs="<id>"
   opens the liquid glass pop-up <dialog id="<id>">. It closes with
   the × button, Esc, or a click outside its content. */

document.querySelectorAll("[data-specs]").forEach((button) => {
  const dialog = document.getElementById(button.dataset.specs);
  if (!dialog) return;

  const CLOSE_MS = 200;  // length of the closing animation in popup.css

  const close = () => {
    if (!dialog.open || dialog.classList.contains("closing")) return;

    const instant =
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    dialog.classList.add("closing");

    setTimeout(() => {
      dialog.classList.remove("closing");
      dialog.close();
    }, instant ? 0 : CLOSE_MS);
  };

  // Start loading the pop-up's photos as soon as the button is
  // hovered or focused, so they are ready when it opens.
  const warm = () => {
    dialog.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      img.loading = "eager";
    });
  };

  button.addEventListener("pointerenter", warm, { once: true });
  button.addEventListener("focus", warm, { once: true });

  button.addEventListener("click", () => {
    warm();
    dialog.showModal();
    dialog.scrollTop = 0;
  });

  dialog.querySelector(".spec-close").addEventListener("click", close);

  // Esc: play the closing animation instead of vanishing
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  // A click on the dimmed page or the empty space around the
  // content closes it
  dialog.addEventListener("click", (event) => {
    const inside = event.target.closest(
      ".spec-dialog-inner, .popup-card, .popup-photo, .popup-photo-wide"
    );
    if (!inside) close();
  });
});

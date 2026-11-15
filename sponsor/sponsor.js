/* Reveal sponsor page sections as they enter the viewport. */
(() => {
  const revealItems = document.querySelectorAll(".reveal");

  if (!revealItems.length) return;

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("visible");
        activeObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  revealItems.forEach((item) => observer.observe(item));
})();

/* Send the partner form to email via FormSubmit without leaving the page. */
(() => {
  const form = document.querySelector(".journey-form");

  if (!form) return;

  const button = form.querySelector(".journey-form-submit");
  const status = form.querySelector(".journey-form-status");
  const endpoint = form.action.replace("formsubmit.co/", "formsubmit.co/ajax/");

  const setStatus = (message, type) => {
    status.textContent = message;
    status.className = `journey-form-status ${type || ""}`.trim();
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Reject fields that contain only spaces.
    const emptyField = [...form.querySelectorAll("[required]")].find(
      (field) => !field.value.trim()
    );

    if (emptyField) {
      emptyField.focus();
      setStatus("Please fill in all fields.", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "Sending...";
    setStatus("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || String(result.success) === "false") {
        throw new Error(result.message || "Request failed");
      }

      form.reset();
      setStatus("Thank you! We'll get back to you soon.", "success");
    } catch (error) {
      setStatus("Something went wrong. Please try again later.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Submit";
    }
  });
})();

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

/* Send the partner form to email via Web3Forms without leaving the page. */
(() => {
  const form = document.querySelector(".journey-form");

  if (!form) return;

  const button = form.querySelector(".journey-form-submit");
  const status = form.querySelector(".journey-form-status");
  const endpoint = form.action;

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

    const data = new FormData(form);
    const company = data.get("Company").trim();

    // Name the sponsor in the email subject and let replies go straight to them.
    data.set("subject", `Sponsorship Enquiry from ${company} | Team Vayuputra`);
    data.set("replyto", data.get("Email").trim());

    button.disabled = true;
    button.textContent = "Sending...";
    setStatus("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || String(result.success) === "false") {
        throw new Error(result.message || "Request failed");
      }

      form.reset();
      setStatus(
        "Thank you for your interest in partnering with Team Vayuputra. Our team will get in touch with you shortly.",
        "success"
      );
    } catch (error) {
      setStatus(
        "We couldn't send your enquiry right now. Please try again, or write to us at vayuputra@psgitech.ac.in.",
        "error"
      );
    } finally {
      button.disabled = false;
      button.textContent = "Send Enquiry";
    }
  });
})();

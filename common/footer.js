(() => {
  const container = document.getElementById("site-footer");
  if (!container) return;

  fetch("/common/footer.html?v=2")
    .then((response) => {
      if (!response.ok) throw new Error(`Footer request failed: ${response.status}`);
      return response.text();
    })
    .then((markup) => {
      container.innerHTML = markup;
    })
    .catch((error) => {
      console.error("Unable to load the Team Vayuputra footer.", error);
    });
})();
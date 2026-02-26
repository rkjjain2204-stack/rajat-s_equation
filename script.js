const yearEl = document.getElementById("year");
const contactBtn = document.getElementById("contactBtn");

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

if (contactBtn) {
  contactBtn.addEventListener("click", () => {
    alert("Thanks for reaching out! Customize this action with your real contact flow.");
  });
}

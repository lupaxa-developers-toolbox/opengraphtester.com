/**
 * Privacy page: remember a choice to skip Counter or Cloudflare.
 * The head snippets in overrides/main.html read the same localStorage keys.
 */
(() => {
  "use strict";

  const { onPageRender } = window.LupaxaPageLifecycle;
  const OFF = "off";

  const bindChoices = () => {
    document.querySelectorAll("[data-analytics-choice]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      const key = button.getAttribute("data-analytics-key");
      const name = button.getAttribute("data-analytics-name");
      if (!key || !name) return;

      button.dataset.bound = "true";

      const countingOff = () => {
        try {
          return localStorage.getItem(key) === OFF;
        } catch (error) {
          return false;
        }
      };

      const render = () => {
        const off = countingOff();
        button.setAttribute("aria-pressed", off ? "true" : "false");
        button.textContent = off
          ? `Count my visits with ${name}`
          : `Don't count my visits with ${name}`;
      };

      button.addEventListener("click", () => {
        try {
          if (countingOff()) localStorage.removeItem(key);
          else localStorage.setItem(key, OFF);
        } catch (error) {
          return;
        }
        render();
      });

      render();
    });
  };

  onPageRender(bindChoices);
})();

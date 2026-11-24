/**
 * Sponsor page: load the Ko-fi frame only after the visitor asks for it.
 * Instant navigation replaces the page, so the button is bound again.
 */
(() => {
  "use strict";

  const { onPageRender } = window.LupaxaPageLifecycle;

  const bindSponsor = () => {
    const widget = document.querySelector(".sponsor-widget");
    if (!widget || widget.dataset.bound === "true") return;

    const button = widget.querySelector(".sponsor-widget-open");
    const frame = widget.querySelector("#kofiframe");
    if (!button || !frame) return;

    widget.dataset.bound = "true";
    button.addEventListener("click", () => {
      const src = frame.getAttribute("data-src");
      if (!src || frame.getAttribute("src")) return;
      frame.src = src;
      frame.hidden = false;
      button.hidden = true;
      widget.classList.add("is-open");
    });
  };

  onPageRender(bindSponsor);
})();

/* Match the reference builder's 20%-80% split between its two right-side columns. */
(() => {
  "use strict";

  const MIN_SPLIT = 20;
  const MAX_SPLIT = 80;
  const desktopMedia = window.matchMedia("(min-width: 721px)");

  const installResizeHandle = () => {
    const panel = document.querySelector("#builder .configurations");
    const handle = panel?.querySelector(":scope > .bv2-right-panel__resize");
    const itemColumn = panel?.querySelector(":scope > .configurations-itemstack");
    const buttonColumn = panel?.querySelector(":scope > .configurations-button");

    if (!panel || !handle || !itemColumn || !buttonColumn || handle.dataset.resizeReady === "true") {
      return;
    }

    handle.dataset.resizeReady = "true";
    let resizing = false;

    const finishResize = () => {
      if (!resizing) return;
      resizing = false;
      document.body.classList.remove("bv2-right-panel-resizing");
      document.removeEventListener("mousemove", moveResize);
      document.removeEventListener("mouseup", finishResize);
    };

    const moveResize = event => {
      if (!resizing) return;
      const bounds = panel.getBoundingClientRect();
      if (bounds.width <= 0) return;

      const split = Math.round((event.clientX - bounds.left) / bounds.width * 100);
      const nextSplit = Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, split));
      itemColumn.style.flex = `${nextSplit} 1 0`;
      buttonColumn.style.flex = `${100 - nextSplit} 1 0`;
    };

    handle.addEventListener("mousedown", event => {
      if (!desktopMedia.matches || event.button !== 0) return;
      event.preventDefault();
      resizing = true;
      document.body.classList.add("bv2-right-panel-resizing");
      moveResize(event);
      document.addEventListener("mousemove", moveResize);
      document.addEventListener("mouseup", finishResize);
    });

    desktopMedia.addEventListener("change", event => {
      if (!event.matches) finishResize();
    });
  };

  const builder = document.getElementById("builder");
  if (!builder) return;

  new MutationObserver(installResizeHandle).observe(builder, {
    childList: true,
    subtree: true
  });
  installResizeHandle();
})();

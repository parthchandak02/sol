// Fits the output frame into the free part of the screen when the app opens and when the
// window resizes, through runtime canvas commands. Editing the canvas size does not refit,
// so the user's own zoom and pan are never overridden by a settings change.

import * as React from "react";

import { useToolcraft } from "@/toolcraft/runtime/react";

const MIN_ZOOM_PERCENT = 25;
const MARGIN_PX = 24;

type Box = { bottom: number; left: number; right: number; top: number };

function visibleWorkArea(viewport: HTMLElement): Box | null {
  const rect = viewport.getBoundingClientRect();
  const box: Box = {
    bottom: Math.min(rect.bottom, window.innerHeight),
    left: Math.max(rect.left, 0),
    right: Math.min(rect.right, window.innerWidth),
    top: Math.max(rect.top, 0),
  };

  // Leave room for a controls panel docked on the right half of the screen
  const panel = viewport.ownerDocument.querySelector<HTMLElement>("[data-slot='toolcraft-runtime-panel-host']");
  const panelRect = panel?.getBoundingClientRect();
  if (panelRect && panelRect.width > 0 && panelRect.left > (box.left + box.right) / 2) {
    box.right = Math.min(box.right, panelRect.left);
  }

  return box.right - box.left > 0 && box.bottom - box.top > 0 ? box : null;
}

export function useFitViewport(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  const { dispatch, state } = useToolcraft();
  const sizeRef = React.useRef(state.canvas.size);
  sizeRef.current = state.canvas.size;

  React.useEffect(() => {
    let reshaped = false;

    function fit(isFirstFit: boolean): void {
      const viewport = canvasRef.current?.closest<HTMLElement>("[data-slot='toolcraft-runtime-canvas']");
      const { height, width } = sizeRef.current;
      if (!viewport || !(width > 0) || !(height > 0)) return;
      const area = visibleWorkArea(viewport);
      if (!area) return;

      const areaWidth = area.right - area.left;
      const areaHeight = area.bottom - area.top;
      const zoom = Math.min((areaWidth - MARGIN_PX * 2) / width, (areaHeight - MARGIN_PX * 2) / height) * 100;

      if (zoom < MIN_ZOOM_PERCENT) {
        // Phones: even the smallest zoom would crop the frame, so on first load the output
        // takes the screen's shape instead (the drawing scales with the output size).
        if (isFirstFit && !reshaped) {
          reshaped = true;
          dispatch({
            size: { height: Math.floor(areaHeight), unit: "px", width: Math.floor(areaWidth) },
            type: "canvas.setSize",
          });
          window.requestAnimationFrame(() => fit(false));
        }
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      dispatch({
        offset: {
          x: (area.left + area.right) / 2 - (viewportRect.left + viewportRect.width / 2),
          y: (area.top + area.bottom) / 2 - (viewportRect.top + viewportRect.height / 2),
        },
        type: "canvas.setViewport",
        zoom: Math.floor(zoom),
      });
    }

    const frame = window.requestAnimationFrame(() => fit(true));
    const onResize = () => fit(false);
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [canvasRef, dispatch]);
}

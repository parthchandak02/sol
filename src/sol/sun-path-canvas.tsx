// Product output for Sol: one Canvas 2D element inside the Toolcraft canvas frame.
// Reads every setting from runtime state; redraws when settings, API data, size, or the minute change.

import * as React from "react";

import { shouldIncludeToolcraftPreviewBackground } from "@/toolcraft/runtime";
import { useToolcraft } from "@/toolcraft/runtime/react";

import styles from "./sun-path-canvas.module.css";
import { drawSunPath } from "./sun-path-draw";
import { readSunPathSettings } from "./sun-path-settings";
import { getCachedSunTimes, loadSunTimes, type SunTimes } from "./sun-model";
import { useFitViewport } from "./use-fit-viewport";

const CLOCK_TICK_MS = 60_000;

function useMinuteClock(): number {
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return nowMs;
}

export function SunPathCanvas(): React.JSX.Element {
  const { state } = useToolcraft();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  useFitViewport(canvasRef);
  const settings = readSunPathSettings(state.values);
  const includeBackground = shouldIncludeToolcraftPreviewBackground({ state });
  const { height, width } = state.canvas.size;
  const nowMs = useMinuteClock();
  const year = new Date(nowMs).getFullYear();
  const { dayOfYear, latitude, longitude } = settings;

  const [times, setTimes] = React.useState<SunTimes | null>(() =>
    getCachedSunTimes({ dayOfYear, latitude, longitude }, year),
  );

  React.useEffect(() => {
    let current = true;
    const inputs = { dayOfYear, latitude, longitude };
    setTimes(getCachedSunTimes(inputs, year));
    void loadSunTimes(inputs, year).then((loaded) => {
      if (current) setTimes(loaded);
    });
    return () => {
      current = false;
    };
  }, [dayOfYear, latitude, longitude, year]);

  const [, setLayoutVersion] = React.useState(0);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => setLayoutVersion((version) => version + 1));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !(width > 0) || !(height > 0)) return;

    const cssWidth = canvas.clientWidth || width;
    const cssHeight = canvas.clientHeight || height;
    const pixelRatio = (window.devicePixelRatio || 1) * settings.renderScale;
    const backingWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
    const backingHeight = Math.max(1, Math.round(cssHeight * pixelRatio));
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;

    // Draw in output CSS pixels (canvas.size), whatever size the frame is shown at
    context.setTransform(backingWidth / width, 0, 0, backingHeight / height, 0, 0);
    drawSunPath(context, {
      background: settings.background,
      dayOfYear,
      height,
      includeBackground,
      latitude,
      nowMs,
      times,
      width,
    });
  });

  return (
    <canvas
      aria-label="Sun path across the sky"
      className={styles.canvas}
      data-sol-sun-path=""
      data-sol-times={times ? times.source : "loading"}
      ref={canvasRef}
      role="img"
    />
  );
}

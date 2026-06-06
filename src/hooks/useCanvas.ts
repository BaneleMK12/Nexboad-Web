import { useRef, useEffect, useCallback } from "react";

/**
 * Returns a canvasRef whose pixel dimensions stay in sync with its CSS display size.
 * Calls `onResize(canvas)` whenever the dimensions change (including initial mount).
 */
export function useResponsiveCanvas(onResize: (canvas: HTMLCanvasElement) => void) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(onResize);
  cbRef.current = onResize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sync = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
      cbRef.current(canvas);
    };

    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    // fire once immediately
    sync();
    return () => ro.disconnect();
  }, []);

  return canvasRef;
}

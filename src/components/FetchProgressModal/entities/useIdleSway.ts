import { useEffect } from "react";

/** Hook that applies a gentle Web Animations sway to an element ref. */
export function useIdleSway(ref: React.RefObject<HTMLElement>, durationMs = 4500) {
  useEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!el) return;
    const anim = el.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(1.5deg)" },
        { transform: "rotate(0deg)" },
        { transform: "rotate(-1.5deg)" },
        { transform: "rotate(0deg)" },
      ],
      { duration: durationMs + Math.random() * 1500, iterations: Infinity }
    );
    return () => anim.cancel();
  }, [ref, durationMs]);
}

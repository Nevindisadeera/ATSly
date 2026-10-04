"use client";

import { useEffect } from "react";

/**
 * Sets data-scrolled on the element with the given id once the page scrolls.
 * Kept tiny so the header itself can stay a server component.
 */
export function HeaderScrollState({ targetId }: { targetId: string }) {
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const update = () => target.toggleAttribute("data-scrolled", window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [targetId]);

  return null;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Clipboard API first; the selection fallback covers insecure origins and older browsers. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or not focused; try the fallback.
  }
  const area = document.createElement("textarea");
  // Selecting the textarea moves focus; keyboard users get it back on the button.
  const focused = document.activeElement as HTMLElement | null;
  try {
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    focused?.focus();
  }
}

type CopyButtonProps = {
  text: string;
  /** Completes the accessible name after "Copy", e.g. "suggested text". */
  what: string;
  onCopy?: (copied: boolean) => void;
};

/** Copies text and confirms it in place and to screen readers. */
export function CopyButton({ text, what, onCopy }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const copied = await writeClipboard(text);
    setState(copied ? "copied" : "failed");
    onCopy?.(copied);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2_500);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        leadingIcon={
          state === "copied" ? (
            <Check className="text-success-strong" strokeWidth={2.25} />
          ) : (
            <Copy strokeWidth={1.75} />
          )
        }
        className="-my-1 -mr-2 text-subtle hover:text-foreground"
      >
        {state === "copied" ? (
          "Copied"
        ) : state === "failed" ? (
          "Couldn't copy"
        ) : (
          <>
            Copy<span className="sr-only"> {what}</span>
          </>
        )}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied"
          ? "Copied to the clipboard."
          : state === "failed"
            ? "Couldn't copy. Select the text and copy it instead."
            : ""}
      </span>
    </>
  );
}

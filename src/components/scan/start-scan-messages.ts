import type { ClientFailure } from "@/lib/client/api-response";

export type StartScanMessage = { title: string; hint: string };

/** "a minute", "25 minutes", "about 3 hours". */
export function formatWait(seconds: number | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 90) return "a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** Copy for a scan that couldn't be started — docs/PLANNING.md §24. */
export function startScanErrorMessage(failure: ClientFailure): StartScanMessage {
  switch (failure.code) {
    case "RATE_LIMITED": {
      const wait = formatWait(failure.retryAfterSeconds);
      return {
        title: "You've reached today's scan limit.",
        hint: wait ? `You can scan again in ${wait}.` : "Please try again tomorrow.",
      };
    }
    case "NOT_FOUND":
      return {
        title: "We couldn't find this resume anymore.",
        hint: "Upload it again to continue.",
      };
    case "SERVICE_UNAVAILABLE":
      return {
        title: "We're having trouble saving right now.",
        hint: "Please try again in a moment.",
      };
    case "NETWORK_ERROR":
      return { title: "Connection lost.", hint: "Check your connection and try again." };
    default:
      return {
        title: "Something went wrong on our side.",
        hint: failure.requestId
          ? `Please try again. Reference: ${failure.requestId}`
          : "Please try again.",
      };
  }
}

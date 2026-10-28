"use client";

/**
 * Last resort when the root layout itself fails — docs/PLANNING.md §24. It replaces the
 * whole document, so it can't rely on the app's styles or fonts.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#0f172a",
          background: "#f8fafc",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong.</h1>
          <p style={{ color: "#475569", lineHeight: 1.6 }}>
            Please try again in a moment.
            {error.digest ? ` Reference: ${error.digest}` : null}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 6,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

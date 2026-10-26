"use client";

// Last resort when the root layout itself fails. The app's CSS isn't loaded here, so styles are inline.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaff", fontFamily: "system-ui, sans-serif", color: "#161622", textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>JustCmul8 couldn&apos;t load</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>
            Something went wrong on our side. Your saved work is safe.
            {error.digest && <span style={{ display: "block", marginTop: 8, fontFamily: "monospace", fontSize: 12 }}>Reference: {error.digest}</span>}
          </p>
          <button onClick={reset} style={{ border: 0, borderRadius: 999, background: "#5742ff", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 20px", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

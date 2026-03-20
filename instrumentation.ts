/**
 * Pokreće se kad se server podigne. Po ~10s pozove internal route da uključi mail sync.
 * Aplikacija onda sluša za nove mailove nevezano od toga da li je neko otvorio app.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const base =
    process.env.AUTH0_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";

  const url = `${base.replace(/\/$/, "")}/api/internal/start-mail-sync`;

  setTimeout(() => {
    fetch(url, { method: "GET" })
      .then((r) => {
        if (r.ok) console.log("[instrumentation] Mail sync started");
        else console.warn("[instrumentation] start-mail-sync:", r.status);
      })
      .catch((err) => console.warn("[instrumentation] start-mail-sync failed:", err?.message ?? err));
  }, 10000);
}

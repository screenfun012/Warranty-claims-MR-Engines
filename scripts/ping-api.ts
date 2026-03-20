/**
 * Ping API rute i izmeri vreme odziva (ms).
 * Pokretanje: npx tsx scripts/ping-api.ts [baseUrl]
 * Primer: npx tsx scripts/ping-api.ts http://localhost:3000
 */

const BASE = process.argv[2] || "http://localhost:3000";

const ROUTES: { name: string; path: string }[] = [
  { name: "inbox unread-count", path: "/api/inbox/unread-count" },
  { name: "inbox (threads)", path: "/api/inbox" },
  { name: "dashboard stats", path: "/api/dashboard/stats" },
  { name: "notifications", path: "/api/notifications" },
];

async function ping(path: string): Promise<{ ms: number; status: number }> {
  const url = BASE + path;
  const start = performance.now();
  const res = await fetch(url, { method: "GET" });
  const ms = Math.round(performance.now() - start);
  return { ms, status: res.status };
}

async function main() {
  console.log("Ping:", BASE, "\n");
  for (const { name, path } of ROUTES) {
    try {
      const { ms, status } = await ping(path);
      const ok = status >= 200 && status < 300 ? "✓" : "✗";
      console.log(`${ok} ${name.padEnd(22)} ${ms} ms  (HTTP ${status})`);
    } catch (err) {
      console.log(`✗ ${name.padEnd(22)} ERROR: ${(err as Error).message}`);
    }
  }
  console.log("");
}

main();

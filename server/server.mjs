/**
 * Pikud-Ha-Oref “Red Alert” Proxy
 * ───────────────────────────────
 * ▸ Serves the static front-end from /public
 * ▸ Adds permissive CORS so any origin can call the API
 * ▸ GET /api/history?city=<name>&range=day|week|month
 *        day   = last 24 h      (mode=3)
 *        week  = last 7 days    (custom from/to)
 *        month = last 30 days   (custom from/to)
 *   Responds: [{ alertDate, category, category_desc }, …]
 *
 * Run:
 *   npm i express
 *   node server.js
 */

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* ---------- resolve __dirname in ESM ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- basic app setup ---------- */
const PORT = process.env.PORT || 3000;
const app = express();

/* ---------- 1. Global CORS ---------- */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* ---------- 2. Static front-end ---------- */
app.use(express.static(path.join(__dirname, "../public")));

/* ---------- 3. Helpers ---------- */
const fmtDMY = (d) => d.toLocaleDateString("en-GB").split("/").join("."); // DD.MM.YYYY

function buildHistoryURL(city, range) {
  const base =
    "https://alerts-history.oref.org.il//Shared/Ajax/GetAlarmsHistory.aspx?lang=en";
  const cityParam = `city_0=${encodeURIComponent(city)}`;

  switch (range) {
    case "day": // last 24 h
      return `${base}&${cityParam}`;

    case "week": {
      return `${base}&mode=2&${cityParam}`;
    }
    case "month": {
      return `${base}&mode=3&${cityParam}`;
    }

    default: {
      // last 1 day
      return `${base}&${cityParam}`;
    }
  }
}

/* ---------- 4. History API ---------- */
app.get("/api/history", async (req, res) => {
  const city = (req.query.city || "Yad Binyamin").trim();
  const range = (req.query.range || "day").toLowerCase(); // day | week | month

  try {
    const url = buildHistoryURL(city, range);
    const resp = await fetch(url, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://alerts-history.oref.org.il/", // some edges require this
      },
    });

    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);

    const raw = await resp.json();
    const clean = raw.map(({ alertDate, category, category_desc }) => ({
      alertDate,
      category,
      category_desc,
    }));

    res.json(clean);
  } catch (err) {
    console.error("[history]", err.message);
    res
      .status(502)
      .json({ error: "History fetch failed", detail: err.message });
  }
});

/* ---------- 5. Simple health-check ---------- */
app.get("/api/health", (_, res) => res.json({ status: "ok", ts: Date.now() }));

/* ---------- 6. Launch ---------- */
app.listen(PORT, () =>
  console.log(`🚀  Server running  →  http://localhost:${PORT}`)
);

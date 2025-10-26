// capture/capture-ttc.js
// Usage: node capture-ttc.js --minutes=2 --interval=5
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch"); // v2
const Gtfs = require("gtfs-realtime-bindings");

const ENDPOINT = "https://bustime.ttc.ca/gtfsrt/vehicles";
const OUT_DIR = path.join(__dirname, "..", "viewer", "public", "data");
const OUT_FILE = path.join(OUT_DIR, "ttc_tracks.geojson");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? ""];
  }),
);
const MINUTES = Math.max(1, parseInt(args.minutes || "2", 10));
const INTERVAL_MS = Math.max(1000, parseInt(args.interval || "5000", 10));

const tracks = new Map(); // vehicleId -> [{ts, lon, lat}]

function toNumber(x) {
  // protobuf Long -> number
  if (x == null) return undefined;
  if (typeof x === "number") return x;
  if (typeof x.toNumber === "function") return x.toNumber();
  if (typeof x.low === "number") return x.low; // fallback
  return Number(x);
}

async function pollOnce() {
  const res = await fetch(ENDPOINT, {
    headers: {
      Accept: "application/x-protobuf",
      "User-Agent": "ttc-capture/1.0 (+local)",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const feed = Gtfs.transit_realtime.FeedMessage.decode(buf);

  let added = 0;
  for (const entity of feed.entity) {
    const v = entity.vehicle;
    if (!v || !v.position) continue;
    const lat = v.position.latitude;
    const lon = v.position.longitude;
    if (typeof lat !== "number" || typeof lon !== "number") continue;

    // Robust vehicle ID: prefer vehicle.id, else label, else trip, else entity.id
    const vehId = String(
      v.vehicle?.id ??
        v.vehicle?.label ??
        v.trip?.tripId ??
        entity.id ??
        "unknown",
    );

    const ts = toNumber(v.timestamp) ?? Math.floor(Date.now() / 1000);

    if (!tracks.has(vehId)) tracks.set(vehId, []);
    tracks.get(vehId).push({ ts, lon, lat });
    added++;
  }
  return { entities: feed.entity.length, added };
}

function buildGeoJSON() {
  const features = [];
  for (const [vehId, samples] of tracks.entries()) {
    if (!samples || samples.length < 2) continue;
    samples.sort((a, b) => a.ts - b.ts);

    const coords = [];
    let last;
    for (const s of samples) {
      const c = [s.lon, s.lat];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) {
        coords.push(c);
        last = c;
      }
    }
    if (coords.length >= 2) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
        properties: { vehicle_id: vehId, points: coords.length },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

async function main() {
  console.log(
    `Capturing from TTC GTFS-RT for ~${MINUTES} min, every ${INTERVAL_MS / 1000}s…`,
  );
  const stopAt = Date.now() + MINUTES * 60_000;
  let polls = 0,
    totalAdded = 0;

  while (Date.now() < stopAt) {
    try {
      const { entities, added } = await pollOnce();
      polls++;
      totalAdded += added;
      process.stdout.write(
        `\rPolls: ${polls}  entities: ${String(entities).padStart(3)}  new points: ${String(added).padStart(3)}   `,
      );
    } catch (e) {
      console.error("\nPoll error:", e.message);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }

  console.log("\nBuilding GeoJSON…");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fc = buildGeoJSON();
  fs.writeFileSync(OUT_FILE, JSON.stringify(fc));
  console.log(
    `Wrote ${OUT_FILE} with ${fc.features.length} path(s) from ${tracks.size} vehicle(s).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

const fetch = require("node-fetch"); // v2
const Gtfs = require("gtfs-realtime-bindings");

(async () => {
  const res = await fetch("https://bustime.ttc.ca/gtfsrt/vehicles", {
    headers: {
      Accept: "application/x-protobuf",
      "User-Agent": "ttc-capture/1.0 (+local)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const feed = Gtfs.transit_realtime.FeedMessage.decode(buf);
  console.log("entities:", feed.entity.length);
  // Show a couple of positions
  for (const e of feed.entity.slice(0, 5)) {
    const p = e.vehicle?.position;
    console.log(e.id, p?.latitude, p?.longitude);
  }
})();

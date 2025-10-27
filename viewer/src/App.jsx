import React, { useEffect, useMemo, useState } from "react";
import { DeckGL } from "deck.gl";
import { GeoJsonLayer } from "@deck.gl/layers";
import Map from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";

const INITIAL_VIEW_STATE = {
  longitude: -79.3832,
  latitude: 43.6532,
  zoom: 11,
  pitch: 0,
  bearing: 0,
};

const POSITRON_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export default function App() {
  const [data, setData] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    const url = `${import.meta.env.BASE_URL}data/ttc_tracks.geojson`;
    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .catch((err) => console.error("Failed to load GeoJSON:", err));
  }, []);

  const layers = useMemo(() => {
    if (!data) return [];
    return [
      new GeoJsonLayer({
        id: "ttc-paths",
        data,
        stroked: true,
        filled: false,
        getLineColor: (f) => [200, 30, 0, 200],
        getLineWidth: (f) =>
          Math.min(8, 1 + Math.log(f.properties?.points || 2)),
        lineWidthMinPixels: 2,
        pickable: true,
        onHover: (info) => setHoverInfo(info?.object ? info : null),
        parameters: { depthTest: false },
      }),
    ];
  }, [data]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
      >
        <Map
          reuseMaps
          style={{ width: "100%", height: "100%" }}
          mapLib={maplibregl}
          mapStyle={POSITRON_STYLE}
          attributionControl={true}
        />
      </DeckGL>

      {hoverInfo && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            pointerEvents: "none",
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            padding: "6px 8px",
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            fontSize: 12,
            borderRadius: 6,
          }}
        >
          <div>
            <b>Vehicle</b>: {hoverInfo.object?.properties?.vehicle_id}
          </div>
          <div>
            <b>Points</b>: {hoverInfo.object?.properties?.points}
          </div>
        </div>
      )}
    </div>
  );
}

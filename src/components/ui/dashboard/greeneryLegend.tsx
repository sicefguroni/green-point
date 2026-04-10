"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  GREENERY_INDEX_FILL_STOPS,
  interpolateGreeneryIndexFillColor,
} from "@/lib/chloroplet-colors";

export default function GreeneryLegend() {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: "topright" });

    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");
      const labels: string[] = [];
      div.innerHTML += "<h4>Greenery Index</h4>";

      const first = GREENERY_INDEX_FILL_STOPS[0];
      const lowMid = first.value / 2;
      labels.push(
        `<i style="background:${interpolateGreeneryIndexFillColor(lowMid)}"></i> 0 – ${first.value}`,
      );
      for (let i = 0; i < GREENERY_INDEX_FILL_STOPS.length - 1; i++) {
        const from = GREENERY_INDEX_FILL_STOPS[i].value;
        const to = GREENERY_INDEX_FILL_STOPS[i + 1].value;
        const mid = (from + to) / 2;
        labels.push(
          `<i style="background:${interpolateGreeneryIndexFillColor(mid)}"></i> ${from} – ${to}`,
        );
      }
      const last = GREENERY_INDEX_FILL_STOPS[GREENERY_INDEX_FILL_STOPS.length - 1];
      labels.push(
        `<i style="background:${last.color}"></i> ${last.value} – 1`,
      );

      div.innerHTML += labels.join("<br>");
      return div;
    };

    legend.addTo(map);
    return () => {
      legend.remove();
    };
  }, [map]);

  return null;
}

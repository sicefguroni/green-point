"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getGreeneryColor } from "@/lib/chloroplet-colors";

export default function GreeneryLegend() {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: "topright" });

    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "info legend");
      const grades = [0, 0.1, 0.3, 0.5, 0.7, 1];
      const labels: string[] = [];

      div.innerHTML += "<h4>Greenery Index</h4>";

      for (let i = 0; i < grades.length - 1; i++) {
        const from = grades[i];
        const to = grades[i + 1];

        labels.push(
          `<i style="background: ${getGreeneryColor(from + 0.01)}"></i>
          ${from} - ${to}`
        )
      }

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
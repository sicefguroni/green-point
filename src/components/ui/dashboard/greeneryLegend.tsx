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
      const steps = 14;
      const gradientStops = Array.from({ length: steps + 1 }, (_, index) => {
        const value = index / steps;
        return `${getGreeneryColor(value)} ${(value * 100).toFixed(0)}%`;
      });
      const scaleTicks = [0, 0.25, 0.5, 0.75, 1];

      div.innerHTML = `
        <div class="legend-title-wrap">
          <h4>Greenery Index</h4>
        </div>
        <div class="legend-body">
          <div class="legend-gradient-wrap">
            <div class="legend-gradient-track">
              <div class="legend-gradient-fill" style="background: linear-gradient(to right, ${gradientStops.join(", ")});"></div>
            </div>
            <div class="legend-scale-row">
              ${scaleTicks
                .map(
                  (value) => `
                    <span class="legend-scale-tick" style="left:${(value * 100).toFixed(0)}%">
                      ${value === 0 || value === 1 ? value.toFixed(0) : value.toFixed(2)}
                    </span>
                  `,
                )
                .join("")}
            </div>
          </div>
        </div>
      `;
      return div;
    };

    legend.addTo(map);
    return () => {
      legend.remove();
    };
  }, [map]);

  return null;
}

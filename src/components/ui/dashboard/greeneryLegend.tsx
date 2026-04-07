"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { getGreeneryColor } from "@/lib/chloroplet-colors";

export default function GreeneryLegend() {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: "bottomleft" });

    legend.onAdd = function () {
      const div = L.DomUtil.create(
        "div",
        "info legend p-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl border border-neutral-200 min-w-[150px]",
      );
      const grades = [0, 0.15, 0.35, 0.55, 0.75, 1.0];
      const categories = ["Very Low", "Low", "Medium", "High", "Very High"];
      const labels: string[] = [];

      div.innerHTML += '<h4 style="margin:0 0 10px; font-weight:800; font-size: 11px; color: #171717; text-transform: uppercase; letter-spacing: 0.05em;">Greenery Index</h4>';

      for (let i = 0; i < grades.length - 1; i++) {
        const from = grades[i];
        const to = grades[i + 1];

        labels.push(
          `<div style="display:flex; align-items:center; gap: 12px; margin-bottom: 8px;">
            <i style="background: ${getGreeneryColor(from + 0.01)}; width:14px; height:14px; display:inline-block; border-radius:4px; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);"></i>
            <div style="display:flex; flex-direction:column; line-height: 1.2;">
              <span style="font-size: 11px; font-weight: 700; color: #1f2937;">${categories[i]}</span>
              <span style="font-size: 10px; color: #6b7280;">${from.toFixed(2)} - ${to.toFixed(2)}</span>
            </div>
          </div>`,
        );
      }

      div.innerHTML += labels.join("");
      return div;
    };

    legend.addTo(map);
    return () => {
      legend.remove();
    };
  }, [map]);

  return null;
}

import { describe, expect, it } from "vitest";
import type { CityMetricAggregates } from "@/lib/api/city-metrics";
import {
  buildDashboardReport,
  buildInterventionCsv,
  toPdfText,
  type ExportEntry,
} from "./intervention-export";

function entry(barangay: string, cost: number, costPerImpact: number): ExportEntry {
  return {
    row: { barangay, equity: 0.3125, areaHectares: 13.04 },
    display: {
      strategy: "rain garden",
      strategyLabel: "Rain Garden",
      aiRec: null,
      cost,
      impactGI: 0.0312,
      canopyDeltaPct: 0.84,
      coolingDeltaC: -0.456,
      pm25: 0.123,
      overallRating: 61.4,
      costPerImpact,
      status: "Good",
    },
  } as unknown as ExportEntry;
}

const city: CityMetricAggregates = {
  meanGreeneryIndex: 1.4, // out of range on purpose: the card clamps to 1
  meanNdvi: 0.4567,
  meanTreeCanopy: 0.1234,
  meanLst: 31.456,
  barangayCount: 27,
  datasetDate: "2026-11-02",
};

describe("buildInterventionCsv", () => {
  it("keeps the CSV columns the table export has always had", () => {
    const [header] = buildInterventionCsv([]).split("\n");
    expect(header).toBe(
      [
        "Barangay",
        "Equity Index",
        "Area (ha)",
        "Est. Cost (PHP)",
        "Impact (ΔGI)",
        "Canopy Δ (%)",
        "Cooling ΔLST (°C)",
        "PM2.5 removed (kg/yr)",
        "PHP per ΔGI",
        "Status",
        "Recommended Strategy",
        "AI Headline",
        "Overall Rating",
      ]
        .map((h) => `"${h}"`)
        .join(","),
    );
  });

  it("quotes cells and escapes embedded quotes", () => {
    const [, line] = buildInterventionCsv([
      entry('Looc "Proper"', 1_500_000, Infinity),
    ]).split("\n");
    expect(line.startsWith('"Looc ""Proper""","0.313","13.04","1500000"')).toBe(true);
    expect(line).toContain('"n/a"');
  });
});

describe("buildDashboardReport", () => {
  const generatedAt = new Date(2026, 10, 23);

  it("summarises the city cards with the same clamping and rounding", () => {
    const report = buildDashboardReport({ city, entries: [], totalRows: 0, generatedAt });
    expect(report.summary).toEqual([
      ["Greenery Index (city mean, 0-1)", "1"],
      ["NDVI (city mean)", "0.46"],
      ["Tree canopy (city mean, 0-1)", "0.12"],
      ["Surface temperature (city mean)", "31.46 °C"],
      ["Barangays measured", "27"],
    ]);
    expect(report.generatedLabel).toBe("Generated November 23, 2026");
    expect(report.datasetLabel).toBe("Metrics last updated 2 Nov 2026");
  });

  it("exports the rows shown and says when the table is filtered", () => {
    const rows = [entry("Alang-alang", 1_234_567.4, 39_570_750)];
    const filtered = buildDashboardReport({ city, entries: rows, totalRows: 27, generatedAt });
    expect(filtered.tableCaption).toBe(
      "Barangay intervention analysis (1 of 27 barangays, filtered)",
    );
    expect(filtered.rows).toEqual([
      [
        "Alang-alang",
        "0.31",
        "13.0",
        "PHP 1,234,567",
        "0.031",
        "-0.5 °C",
        "0.1",
        "PHP 39,570,750",
        "Good",
        "Rain Garden",
      ],
    ]);
    expect(filtered.rows[0]).toHaveLength(filtered.columns.length);

    const all = buildDashboardReport({ city, entries: rows, totalRows: 1, generatedAt });
    expect(all.tableCaption).toBe("Barangay intervention analysis (1 barangay)");
  });

  it("fills the landscape A4 content width", () => {
    const { columns } = buildDashboardReport({ city: null, entries: [], totalRows: 0, generatedAt });
    const total = columns.reduce((sum, c) => sum + c.width, 0);
    expect(total).toBeLessThanOrEqual(841.89 - 2 * 36 + 1);
    expect(total).toBeGreaterThan(740);
  });

  it("omits the city section and date when metrics did not load", () => {
    const report = buildDashboardReport({ city: null, entries: [], totalRows: 0, generatedAt });
    expect(report.summary).toEqual([]);
    expect(report.datasetLabel).toBeNull();
  });
});

describe("toPdfText", () => {
  it("replaces characters the built-in PDF fonts cannot draw", () => {
    expect(toPdfText("₱1.2M — ΔGI “up” … 🌳")).toBe('PHP 1.2M - dGI "up" ...');
  });

  it("keeps Latin-1 letters such as ñ and the degree sign", () => {
    expect(toPdfText("Bañadero 31 °C")).toBe("Bañadero 31 °C");
  });
});

import type { CityMetricAggregates } from "@/lib/api/city-metrics";
import { formatDatasetDate } from "@/lib/dashboard/barangay-comparison";
import { roundTo2Decimals } from "@/lib/format-number";
import { clamp01 } from "@/lib/site-analysis";
import type { RowDisplay } from "./dashboard-table-utils";
import type { TableRow } from "./dashboard-table-types";

/** One table row as the dashboard displays it (see `resolveRowDisplay`). */
export type ExportEntry = { row: TableRow; display: RowDisplay };

type ReportColumn = {
  label: string;
  /** Width in PDF points; the widths add up to the landscape A4 content width. */
  width: number;
  align?: "left" | "right";
  value: (entry: ExportEntry) => string;
};

type ExportColumn = {
  label: string;
  csv: (entry: ExportEntry) => string | number;
  /** Columns without `report` are CSV-only (long free text does not fit a PDF row). */
  report?: ReportColumn;
};

const formatPeso = (n: number) =>
  Number.isFinite(n) ? `PHP ${Math.round(n).toLocaleString("en-US")}` : "n/a";

/**
 * Every exported column, in order. The CSV and the PDF report both read from
 * this list so they always show the same values as the on-screen table.
 */
const COLUMNS: ExportColumn[] = [
  {
    label: "Barangay",
    csv: ({ row }) => row.barangay,
    report: { label: "Barangay", width: 112, value: ({ row }) => row.barangay },
  },
  {
    label: "Equity Index",
    csv: ({ row }) => row.equity.toFixed(3),
    report: {
      label: "Equity",
      width: 48,
      align: "right",
      value: ({ row }) => row.equity.toFixed(2),
    },
  },
  {
    label: "Area (ha)",
    csv: ({ row }) => row.areaHectares.toFixed(2),
    report: {
      label: "Area (ha)",
      width: 56,
      align: "right",
      value: ({ row }) => row.areaHectares.toFixed(1),
    },
  },
  {
    label: "Est. Cost (PHP)",
    csv: ({ display }) => display.cost,
    report: {
      label: "Est. cost",
      width: 92,
      align: "right",
      value: ({ display }) => formatPeso(display.cost),
    },
  },
  {
    label: "Impact (ΔGI)",
    csv: ({ display }) => display.impactGI.toFixed(3),
    report: {
      label: "GI gain",
      width: 52,
      align: "right",
      value: ({ display }) => display.impactGI.toFixed(3),
    },
  },
  {
    label: "Canopy Δ (%)",
    csv: ({ display }) => display.canopyDeltaPct.toFixed(1),
  },
  {
    label: "Cooling ΔLST (°C)",
    csv: ({ display }) => display.coolingDeltaC.toFixed(2),
    report: {
      label: "LST change",
      width: 62,
      align: "right",
      value: ({ display }) => `${display.coolingDeltaC.toFixed(1)} °C`,
    },
  },
  {
    label: "PM2.5 removed (kg/yr)",
    csv: ({ display }) => display.pm25.toFixed(2),
    report: {
      label: "PM2.5 kg/yr",
      width: 62,
      align: "right",
      value: ({ display }) => display.pm25.toFixed(1),
    },
  },
  {
    label: "PHP per ΔGI",
    csv: ({ display }) =>
      Number.isFinite(display.costPerImpact)
        ? Math.round(display.costPerImpact)
        : "n/a",
    report: {
      label: "Cost per GI",
      width: 92,
      align: "right",
      value: ({ display }) => formatPeso(display.costPerImpact),
    },
  },
  {
    label: "Status",
    csv: ({ display }) => display.status,
    report: { label: "Status", width: 56, value: ({ display }) => display.status },
  },
  {
    label: "Recommended Strategy",
    csv: ({ display }) => display.strategyLabel,
    report: {
      label: "Recommended strategy",
      width: 138,
      value: ({ display }) => display.strategyLabel,
    },
  },
  {
    label: "AI Headline",
    csv: ({ display }) => display.aiRec?.name ?? "",
  },
  {
    label: "Overall Rating",
    csv: ({ display }) => display.overallRating.toFixed(0),
  },
];

export function buildInterventionCsv(entries: readonly ExportEntry[]): string {
  const header = COLUMNS.map((c) => c.label);
  const rows = entries.map((entry) => COLUMNS.map((c) => c.csv(entry)));
  return [header, ...rows]
    .map((line) =>
      line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
}

export type DashboardReport = {
  title: string;
  generatedLabel: string;
  datasetLabel: string | null;
  summary: Array<[label: string, value: string]>;
  tableCaption: string;
  columns: Array<Pick<ReportColumn, "label" | "width" | "align">>;
  rows: string[][];
};

/**
 * What the dashboard's "Export Report" PDF contains: the city-wide indicator
 * cards plus the intervention table rows currently shown (filters and sort
 * included). Kept free of jsPDF so it can be unit-tested.
 */
export function buildDashboardReport({
  city,
  entries,
  totalRows,
  generatedAt,
}: {
  city: CityMetricAggregates | null;
  entries: readonly ExportEntry[];
  totalRows: number;
  generatedAt: Date;
}): DashboardReport {
  const reportColumns = COLUMNS.flatMap((c) => (c.report ? [c.report] : []));

  const summary: DashboardReport["summary"] = city
    ? [
        ["Greenery Index (city mean, 0-1)", String(roundTo2Decimals(clamp01(city.meanGreeneryIndex)))],
        ["NDVI (city mean)", String(roundTo2Decimals(clamp01(city.meanNdvi)))],
        ["Tree canopy (city mean, 0-1)", String(roundTo2Decimals(clamp01(city.meanTreeCanopy)))],
        ["Surface temperature (city mean)", `${roundTo2Decimals(city.meanLst)} °C`],
        ["Barangays measured", String(city.barangayCount)],
      ]
    : [];

  return {
    title: "Mandaue City Greening Report",
    generatedLabel: `Generated ${generatedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    datasetLabel: city?.datasetDate
      ? `Metrics last updated ${formatDatasetDate(city.datasetDate)}`
      : null,
    summary,
    tableCaption:
      entries.length === totalRows
        ? `Barangay intervention analysis (${totalRows} ${totalRows === 1 ? "barangay" : "barangays"})`
        : `Barangay intervention analysis (${entries.length} of ${totalRows} barangays, filtered)`,
    columns: reportColumns.map(({ label, width, align }) => ({ label, width, align })),
    rows: entries.map((entry) => reportColumns.map((c) => c.value(entry))),
  };
}

/**
 * jsPDF's built-in fonts only cover Latin-1, so anything else (₱, Δ, smart
 * quotes, dashes) would print as garbage. Map the common ones and drop the rest.
 */
export function toPdfText(text: string): string {
  return text
    .replaceAll("₱", "PHP ")
    .replaceAll("Δ", "d")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replaceAll("…", "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

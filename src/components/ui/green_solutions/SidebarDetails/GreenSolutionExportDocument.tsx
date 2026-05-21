"use client";

import { forwardRef } from "react";
import { type BarangayData } from "@/context/BarangayContext";
import { SPECIES_INFO } from "@/lib/green-solutions/species-info";
import { type UIRecommendation } from "@/lib/recommendations";
import { type CostEstimate } from "@/types/green_solutions";
import { type SelectedFeature } from "@/types/metrics";
import {
  EXPORT_AVOID_BREAK_ATTR,
  EXPORT_GROUP_TITLE_ATTR,
  EXPORT_SECTION_ATTR,
} from "@/lib/export/html-to-pdf";
import {
  formatLocationMetricValue,
  LOCATION_METRIC_LABELS,
  resolveLocationMetrics,
  type LocationMetricKey,
} from "@/lib/green-solutions/location-metrics";
import { daysBetween } from "@/lib/timeline/plan";
import type { TimelinePlan } from "./TimelineTab/types";

const avoidPageBreak = {
  [EXPORT_AVOID_BREAK_ATTR]: "true",
  style: { breakInside: "avoid", pageBreakInside: "avoid" } as const,
};

/** Keeps a section heading and its body on the same page when possible. */
function ExportSection({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      {...{ [EXPORT_SECTION_ATTR]: "true" }}
      {...avoidPageBreak}
      className={className}
      style={{ ...avoidPageBreak.style, ...style }}
    >
      {children}
    </div>
  );
}

function ExportSectionHeading({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <h2
      {...{ [EXPORT_GROUP_TITLE_ATTR]: "true" }}
      className={className}
      style={style}
    >
      {children}
    </h2>
  );
}

interface GreenSolutionExportDocumentProps {
  recommendation: UIRecommendation;
  selectedFeature: SelectedFeature;
  selectedBarangayData: BarangayData | null;
  timelinePlan: TimelinePlan;
  costEstimate: CostEstimate | null;
  timelineRisks?: string[];
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function specColor(
  value: number,
  thresholds: [number, number],
  higherIsBetter: boolean,
) {
  const isGood = higherIsBetter
    ? value >= thresholds[0]
    : value <= thresholds[0];
  const isMid = higherIsBetter
    ? value >= thresholds[1] && value < thresholds[0]
    : value > thresholds[0] && value <= thresholds[1];
  if (isGood) return "#16a34a";
  if (isMid) return "#ca8a04";
  return "#dc2626";
}

function locationMetricColor(key: LocationMetricKey, value: number) {
  if (key === "lst") {
    if (value >= 34) return "#dc2626";
    if (value >= 32) return "#ea580c";
    if (value >= 30) return "#ca8a04";
    return "#525252";
  }
  if (key === "ndvi") {
    if (value >= 0.5) return "#16a34a";
    if (value >= 0.3) return "#22c55e";
    if (value >= 0.15) return "#ca8a04";
    return "#dc2626";
  }
  if (key === "treeCanopy") {
    if (value >= 0.5) return "#16a34a";
    if (value >= 0.3) return "#22c55e";
    if (value >= 0.15) return "#84cc16";
    return "#ca8a04";
  }
  if (value >= 0.6) return "#16a34a";
  if (value >= 0.4) return "#22c55e";
  if (value >= 0.25) return "#84cc16";
  if (value >= 0.1) return "#ca8a04";
  return "#dc2626";
}

const GreenSolutionExportDocument = forwardRef<
  HTMLDivElement,
  GreenSolutionExportDocumentProps
>(function GreenSolutionExportDocument(
  {
    recommendation,
    selectedFeature,
    selectedBarangayData,
    timelinePlan,
    costEstimate,
    timelineRisks = [],
  },
  ref,
) {
  const siteLabel = selectedFeature.name?.trim() || "Selected site";
  const locationParts = [
    selectedFeature.address?.trim(),
    selectedFeature.barangay?.trim(),
    selectedBarangayData?.name,
  ].filter(Boolean);
  const locationLabel = locationParts.join(" · ");
  const areaLabel =
    selectedFeature.customSelectionAreaHectares != null
      ? `${selectedFeature.customSelectionAreaHectares.toFixed(2)} ha`
      : null;

  const firstPhase = timelinePlan.phases[0]?.startDate;
  const lastPhase =
    timelinePlan.phases[timelinePlan.phases.length - 1]?.endDate;
  const durationDays =
    firstPhase && lastPhase ? daysBetween(firstPhase, lastPhase) : 0;

  const exportedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const locationMetrics = resolveLocationMetrics(
    selectedFeature,
    selectedBarangayData,
  );
  const locationMetricEntries: { key: LocationMetricKey; value: number }[] =
    locationMetrics
      ? (
          [
            {
              key: "greeneryIndex" as const,
              value: locationMetrics.greeneryIndex,
            },
            { key: "ndvi" as const, value: locationMetrics.ndvi },
            { key: "treeCanopy" as const, value: locationMetrics.treeCanopy },
            { key: "lst" as const, value: locationMetrics.lst },
          ] as { key: LocationMetricKey; value: number | null }[]
        ).filter(
          (entry): entry is { key: LocationMetricKey; value: number } =>
            entry.value !== null,
        )
      : [];

  const showLocationMetricsSection =
    locationMetrics !== null &&
    (locationMetricEntries.length > 0 ||
      locationMetrics.customAreaHectares !== null);

  return (
    <div
      ref={ref}
      data-export-root="green-solution-report"
      className="bg-white text-neutral-900"
      style={{ width: 720, fontFamily: "Helvetica, Arial, sans-serif" }}
    >
      <div className="space-y-5 p-8">
        <header
          className="rounded-xl border p-5"
          style={{
            borderColor: "#d4d4d4",
            backgroundColor: "#f0fdf4",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "#737373" }}
          >
            GreenPoint Greening Solution Report
          </p>
          <h1
            className="mt-2 text-2xl font-bold leading-tight"
            style={{ color: "#171717" }}
          >
            {recommendation.solutionTitle}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#525252" }}>
            {recommendation.solutionDescription}
          </p>
          <div
            className="mt-4 grid gap-2 text-xs"
            style={{ color: "#525252" }}
          >
            <p>
              <span className="font-semibold" style={{ color: "#404040" }}>
                Site:
              </span>{" "}
              {siteLabel}
            </p>
            {locationLabel ? <p>{locationLabel}</p> : null}
            {areaLabel &&
            !(
              showLocationMetricsSection &&
              locationMetrics?.customAreaHectares != null
            ) ? (
              <p>
                <span className="font-semibold" style={{ color: "#404040" }}>
                  Selected area:
                </span>{" "}
                {areaLabel}
              </p>
            ) : null}
            <p>
              <span className="font-semibold" style={{ color: "#404040" }}>
                Exported:
              </span>{" "}
              {exportedAt}
            </p>
          </div>
        </header>

        {showLocationMetricsSection && locationMetrics ? (
          <section
            className="rounded-xl border p-4"
            style={{ borderColor: "#bbf7d0", backgroundColor: "#f0fdf4" }}
          >
            <ExportSection className="space-y-3">
              <ExportSectionHeading
                className="text-sm font-bold"
                style={{ color: "#166534" }}
              >
                {locationMetrics.sectionTitle}
              </ExportSectionHeading>

              {locationMetrics.customAreaHectares !== null ? (
                <div
                  className="rounded-lg border px-4 py-3 text-center"
                  style={{
                    borderColor: "#86efac",
                    backgroundColor: "#ffffff",
                  }}
                >
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#15803d" }}
                >
                  Selected Area
                </p>
                <p
                  className="mt-1 text-xl font-bold"
                  style={{ color: "#14532d" }}
                >
                  {locationMetrics.customAreaHectares.toFixed(2)} ha
                </p>
              </div>
            ) : null}

              {locationMetricEntries.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {locationMetricEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: "#e5e5e5",
                        backgroundColor: "#ffffff",
                      }}
                    >
                    <p className="text-[10px]" style={{ color: "#737373" }}>
                      {LOCATION_METRIC_LABELS[entry.key]}
                    </p>
                    <p
                      className="mt-1 text-xl font-bold"
                      style={{
                        color: locationMetricColor(entry.key, entry.value),
                      }}
                    >
                      {formatLocationMetricValue(entry.key, entry.value)}
                    </p>
                  </div>
                  ))}
                </div>
              ) : null}
            </ExportSection>
          </section>
        ) : null}

        <section
          className="rounded-xl border p-4"
          style={{ borderColor: "#e5e5e5" }}
        >
          <ExportSection>
            <ExportSectionHeading
              className="text-sm font-bold"
              style={{ color: "#262626" }}
            >
              Solution Overview
            </ExportSectionHeading>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: "#e5e5e5",
                  backgroundColor: "#fafafa",
                }}
              >
              <p style={{ color: "#737373" }}>Efficiency</p>
              <p className="mt-1 text-lg font-bold" style={{ color: "#171717" }}>
                {recommendation.value}%
              </p>
              <p className="mt-0.5" style={{ color: "#525252" }}>
                {recommendation.efficiencyLevel}
              </p>
            </div>
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: "#e5e5e5",
                  backgroundColor: "#fafafa",
                }}
              >
              <p style={{ color: "#737373" }}>Overall Rating</p>
              <p className="mt-1 text-lg font-bold" style={{ color: "#171717" }}>
                {recommendation.overallRating}
              </p>
              <p className="mt-0.5" style={{ color: "#525252" }}>
                Composite score
              </p>
            </div>
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: "#e5e5e5",
                  backgroundColor: "#fafafa",
                }}
              >
              <p style={{ color: "#737373" }}>Timeline</p>
              <p className="mt-1 text-lg font-bold" style={{ color: "#171717" }}>
                {durationDays}
              </p>
              <p className="mt-0.5" style={{ color: "#525252" }}>
                days · {timelinePlan.phases.length} phases
              </p>
              </div>
            </div>
          </ExportSection>
        </section>

        <section
          className="rounded-xl border p-4"
          style={{
            borderColor: "#e5e5e5",
            backgroundColor: "#fafafa",
          }}
        >
          <ExportSection className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <ExportSectionHeading
                className="text-sm font-bold"
                style={{ color: "#262626" }}
              >
                About This Solution
              </ExportSectionHeading>
              {recommendation.interventionType ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    backgroundColor: "#ecfdf5",
                    color: "#047857",
                    border: "1px solid #a7f3d0",
                  }}
                >
                  {recommendation.interventionType}
                </span>
              ) : null}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#525252" }}>
              {recommendation.detailedDescription}
            </p>
            {(recommendation.sourceStudy ?? recommendation.source) && (
              <p className="text-[10px] pt-2" style={{ color: "#737373" }}>
                Source:{" "}
                <span className="font-medium" style={{ color: "#404040" }}>
                  {recommendation.sourceStudy ?? recommendation.source}
                </span>
              </p>
            )}
          </ExportSection>
        </section>

        {recommendation.justification ? (
          <section
            className="rounded-xl border p-4"
            style={{ borderColor: "#e5e5e5" }}
          >
            <ExportSection className="space-y-3">
              <ExportSectionHeading
                className="text-sm font-bold"
                style={{ color: "#262626" }}
              >
                Why This Site?
              </ExportSectionHeading>
              <div
                className="rounded-lg border p-3"
                style={{
                  borderColor: "#fde68a",
                  backgroundColor: "#fffbeb",
                }}
              >
              <p
                className="text-[10px] font-bold uppercase tracking-wide mb-1.5"
                style={{ color: "#d97706" }}
              >
                Site Conditions
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#404040" }}>
                {recommendation.justification}
              </p>
            </div>
              {recommendation.rationale ? (
                <div
                  className="rounded-lg border p-3"
                  style={{
                    borderColor: "#bae6fd",
                    backgroundColor: "#f0f9ff",
                  }}
                >
                <p
                  className="text-[10px] font-bold uppercase tracking-wide mb-1.5"
                  style={{ color: "#0284c7" }}
                >
                  Why This Approach Works
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "#404040" }}
                >
                  {recommendation.rationale}
                </p>
                </div>
              ) : null}
            </ExportSection>
          </section>
        ) : null}

        {recommendation.recommendedSpecies ? (
          <section
            className="rounded-xl border p-4"
            style={{ borderColor: "#e5e5e5" }}
          >
            <ExportSection className="space-y-3">
              <ExportSectionHeading
                className="text-sm font-bold"
                style={{ color: "#262626" }}
              >
                Recommended Species
              </ExportSectionHeading>
              <div className="space-y-2">
              {recommendation.recommendedSpecies
                .split(/,\s*(?![^()]*\))/)
                .map((rawSpecies) => {
                  const cleanName = rawSpecies
                    .trim()
                    .replace(/\s*\(.*?\)/g, "")
                    .trim();
                  const info = SPECIES_INFO[cleanName.toLowerCase()];
                  return (
                    <div
                      key={rawSpecies}
                      className="rounded-lg border p-3"
                      style={{
                        borderColor: "#e5e5e5",
                        backgroundColor: "#ffffff",
                      }}
                    >
                      <p
                        className="text-xs font-bold"
                        style={{ color: "#262626" }}
                      >
                        {cleanName}
                      </p>
                      {info ? (
                        <>
                          <p
                            className="text-[10px] italic"
                            style={{ color: "#737373" }}
                          >
                            {info.scientific}
                          </p>
                          <p
                            className="mt-2 text-[11px] leading-relaxed"
                            style={{ color: "#525252" }}
                          >
                            {info.description}
                          </p>
                          <p
                            className="mt-1.5 text-[10px]"
                            style={{ color: "#737373" }}
                          >
                            {info.tags.join(" · ")}
                          </p>
                        </>
                      ) : (
                        <p
                          className="mt-1 text-[11px] leading-relaxed"
                          style={{ color: "#525252" }}
                        >
                          A suitable species for urban greening in this context.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ExportSection>
          </section>
        ) : null}

        <section
          className="rounded-xl border p-4"
          style={{ borderColor: "#e5e5e5" }}
        >
          <ExportSection>
            <ExportSectionHeading
              className="text-sm font-bold mb-3"
              style={{ color: "#262626" }}
            >
              Technical Specs
            </ExportSectionHeading>
            <div className="grid grid-cols-3 gap-3 text-center">
            {[
              {
                label: "Equity Index",
                value: recommendation.equityIndex,
                thresholds: [0.7, 0.4] as [number, number],
                higherIsBetter: true,
              },
              {
                label: "Cost Index",
                value: recommendation.cost,
                thresholds: [0.3, 0.6] as [number, number],
                higherIsBetter: false,
              },
              {
                label: "Impact Score",
                value: recommendation.impact,
                thresholds: [0.7, 0.4] as [number, number],
                higherIsBetter: true,
              },
            ].map((spec) => (
              <div
                key={spec.label}
                className="rounded-lg border p-3"
                style={{
                  borderColor: "#e5e5e5",
                  backgroundColor: "#ffffff",
                }}
              >
                <p className="text-[10px]" style={{ color: "#737373" }}>
                  {spec.label}
                </p>
                <p
                  className="mt-1 text-xl font-bold"
                  style={{
                    color: specColor(
                      spec.value,
                      spec.thresholds,
                      spec.higherIsBetter,
                    ),
                  }}
                >
                  {spec.value.toFixed(2)}
                </p>
              </div>
            ))}
            </div>
          </ExportSection>
        </section>

        {costEstimate ? (
          <section
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "#86efac" }}
          >
            <ExportSection>
              <div
                className="px-4 py-3 text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #059669 0%, #16a34a 50%, #65a30d 100%)",
                }}
              >
                <h2
                  {...{ [EXPORT_GROUP_TITLE_ATTR]: "true" }}
                  className="text-sm font-bold"
                >
                  Project Cost Estimate
                </h2>
              <p className="text-xs text-white/85 mt-0.5">{siteLabel}</p>
              <p className="mt-2 text-xl font-bold">
                {formatCurrency(costEstimate.totalEstimate)}
              </p>
              <p className="text-[10px] text-white/75">{costEstimate.perUnit}</p>
            </div>
            <div className="space-y-3 p-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <CostStat label="Base Cost" value={formatCurrency(costEstimate.basePrice)} />
                <CostStat
                  label="Location Multiplier"
                  value={`${costEstimate.locationMultiplier.toFixed(2)}x`}
                />
              </div>
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-wide mb-2"
                  style={{ color: "#737373" }}
                >
                  Cost Breakdown
                </p>
                <div className="space-y-1.5">
                  <BreakdownRow
                    label="Materials"
                    amount={costEstimate.breakdown.materials}
                    total={costEstimate.totalEstimate}
                  />
                  <BreakdownRow
                    label="Labor"
                    amount={costEstimate.breakdown.labor}
                    total={costEstimate.totalEstimate}
                  />
                  {typeof costEstimate.breakdown.maintenance === "number" &&
                  costEstimate.breakdown.maintenance > 0 ? (
                    <BreakdownRow
                      label="Maintenance"
                      amount={costEstimate.breakdown.maintenance}
                      total={costEstimate.totalEstimate}
                    />
                  ) : null}
                  <BreakdownRow
                    label="Contingency"
                    amount={costEstimate.breakdown.contingency}
                    total={costEstimate.totalEstimate}
                  />
                </div>
              </div>
              {costEstimate.estimateBasis ? (
                <p className="text-[10px] leading-relaxed" style={{ color: "#737373" }}>
                  {costEstimate.estimateBasis}
                </p>
              ) : null}
              </div>
            </ExportSection>
          </section>
        ) : null}

        <section className="space-y-4">
          <ExportSection className="space-y-4">
            <header className="space-y-1">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#a3a3a3" }}
              >
                Implementation Timeline
              </p>
              <ExportSectionHeading
                className="text-xl font-bold"
                style={{ color: "#171717" }}
              >
                {timelinePlan.objective}
              </ExportSectionHeading>
              <p className="text-sm" style={{ color: "#525252" }}>
                Location: {timelinePlan.locationLabel}
              </p>
              <p className="text-xs" style={{ color: "#737373" }}>
                Plan generated: {formatDate(timelinePlan.generatedAt)}
              </p>
            </header>

            {timelinePlan.constraints.length > 0 ? (
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{ borderColor: "#e5e5e5" }}
            >
              <h3
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "#737373" }}
              >
                AI-Aligned Constraints
              </h3>
              <ul
                className="list-disc pl-5 space-y-1 text-sm"
                style={{ color: "#404040" }}
              >
                {timelinePlan.constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {timelineRisks.length > 0 ? (
            <div
              className="rounded-xl border p-4 space-y-2"
              style={{
                borderColor: "#fecaca",
                backgroundColor: "#fef2f2",
              }}
            >
              <h3
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "#b91c1c" }}
              >
                Identified Risks
              </h3>
              <ul
                className="list-disc pl-5 space-y-1 text-sm"
                style={{ color: "#7f1d1d" }}
              >
                {timelineRisks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
            ) : null}
          </ExportSection>

          {timelinePlan.phases.map((phase, phaseIndex) => (
            <div
              key={phase.id}
              className="rounded-xl border p-4 space-y-2"
              {...avoidPageBreak}
              style={{ borderColor: "#e5e5e5", ...avoidPageBreak.style }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold" style={{ color: "#171717" }}>
                  {phaseIndex + 1}. {phase.title}
                </h3>
                <span className="text-[10px] shrink-0" style={{ color: "#737373" }}>
                  {formatDate(phase.startDate)} – {formatDate(phase.endDate)}
                </span>
              </div>
              <p className="text-xs" style={{ color: "#525252" }}>
                {phase.subtitle}
              </p>
              <ol
                className="list-decimal pl-5 space-y-1.5 text-xs"
                style={{ color: "#404040" }}
              >
                {phase.tasks.map((task) => (
                  <li key={task.id}>
                    <span className="font-semibold" style={{ color: "#262626" }}>
                      {task.title}:{" "}
                    </span>
                    {task.description}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
});

export default GreenSolutionExportDocument;

function CostStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{
        borderColor: "#e5e5e5",
        backgroundColor: "#fafafa",
      }}
    >
      <p className="text-[10px]" style={{ color: "#737373" }}>
        {label}
      </p>
      <p className="mt-0.5 font-bold" style={{ color: "#171717" }}>
        {value}
      </p>
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  total,
}: {
  label: string;
  amount: number;
  total: number;
}) {
  const share = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "#525252" }}>{label}</span>
      <span className="font-semibold" style={{ color: "#171717" }}>
        {formatCurrency(amount)}{" "}
        <span className="font-normal" style={{ color: "#737373" }}>
          ({share}%)
        </span>
      </span>
    </div>
  );
}

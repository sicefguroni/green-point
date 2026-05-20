"use client";

import type { ReactNode } from "react";
import { DollarSign, Package, Wrench, AlertCircle, Sprout } from "lucide-react";
import type { CostEstimate } from "@/types/green_solutions";

interface CostEstimateCardProps {
  costEstimate: CostEstimate;
  isLoading?: boolean;
  siteName?: string;
  siteAddress?: string;
  barangayName?: string;
  areaHectares?: number | null;
}

export default function CostEstimateCard({
  costEstimate,
  isLoading = false,
  siteName,
  siteAddress,
  barangayName,
  areaHectares,
}: CostEstimateCardProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-[28px] border border-neutral-100 bg-white shadow-sm animate-pulse dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/20">
        <div className="bg-gradient-to-r from-neutral-100 to-neutral-50 px-5 py-5 dark:from-neutral-900 dark:to-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-700/60" />
            <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-700/60" />
          </div>
          <div className="h-8 w-52 rounded bg-neutral-200 dark:bg-neutral-700/60" />
          <div className="mt-2 h-4 w-64 rounded bg-neutral-200 dark:bg-neutral-700/60" />
        </div>
        <div className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
            <div className="h-20 rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
          </div>
          <div className="h-40 rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
        </div>
      </div>
    );
  }

  const totalForShares = costEstimate.totalEstimate || 1;
  const siteAreaSqm = costEstimate.area;
  const displayAreaHectares =
    areaHectares ?? (siteAreaSqm !== null ? siteAreaSqm / 10000 : null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatArea = () => {
    if (siteAreaSqm === null) {
      return displayAreaHectares !== null
        ? `${displayAreaHectares.toFixed(2)} ha`
        : "Not provided";
    }

    const areaFormatter = new Intl.NumberFormat("en-PH", {
      maximumFractionDigits: 0,
    });

    const hectaresLabel =
      displayAreaHectares !== null
        ? ` (${displayAreaHectares.toFixed(2)} ha)`
        : "";

    return `${areaFormatter.format(siteAreaSqm)} m²${hectaresLabel}`;
  };

  const siteLabel = siteName?.trim().length ? siteName.trim() : "Selected site";
  const locationLabel = [siteAddress?.trim(), barangayName?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(" • ");
  const locationAdjustment = (costEstimate.locationMultiplier - 1) * 100;

  const formatQuantity = (
    value: number,
    unit: CostEstimate["unit"] | undefined,
  ) => {
    const integerOnly = unit === "tree" || unit === "installation";
    const formatter = new Intl.NumberFormat("en-PH", {
      maximumFractionDigits: integerOnly ? 0 : 2,
    });
    const labelMap: Record<NonNullable<CostEstimate["unit"]>, string> = {
      tree: "trees",
      sqm: "m²",
      "linear-m": "linear m",
      hectare: "ha",
      installation: "installations",
    };
    const label = unit ? labelMap[unit] : "units";
    return `${formatter.format(value)} ${label}`;
  };

  const summaryCards = [
    {
      label: "Base Cost",
      value: formatCurrency(costEstimate.basePrice),
      note: costEstimate.perUnit,
    },
    {
      label: "Site Area",
      value: formatArea(),
      note:
        costEstimate.area === null
          ? "Area not supplied (1 ha reference)"
          : "Area from selected feature",
    },
    {
      label:
        costEstimate.unit === "tree"
          ? "Trees Planted"
          : costEstimate.unit === "installation"
            ? "Installations"
            : costEstimate.unit === "linear-m"
              ? "Corridor Length"
              : costEstimate.unit === "hectare"
                ? "Restored Area"
                : "Treated Area",
      value:
        typeof costEstimate.quantity === "number"
          ? formatQuantity(costEstimate.quantity, costEstimate.unit)
          : "—",
      note:
        typeof costEstimate.effectivePricePerSqm === "number"
          ? `≈ ${formatCurrency(costEstimate.effectivePricePerSqm)}/m² effective`
          : "Quantity from area × density",
    },
    {
      label: "Location Multiplier",
      value: `${costEstimate.locationMultiplier.toFixed(2)}x`,
      note:
        locationAdjustment === 0
          ? "No location adjustment applied"
          : `${locationAdjustment > 0 ? "+" : ""}${locationAdjustment.toFixed(0)}% from base`,
    },
  ];

  return (
    <article
      className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm 
    dark:border-emerald-900/60 dark:bg-neutral-900 dark:shadow-black/20"
    >
      <header
        className="bg-gradient-to-br from-emerald-600 via-green-600 to-lime-500 px-4 py-3 
      text-white dark:from-emerald-950 dark:via-green-900 dark:to-lime-800"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0 flex-1 flex flex-col justify-center h-full">
            <h4 className="text-sm font-bold font-poppins leading-tight">
              Project Cost Estimate
            </h4>
            <p className="text-xs text-white/80 ">{siteLabel}</p>
            {locationLabel ? (
              <p className="text-[10px] text-white/65 text-wrap wrap-anywhere">
                {locationLabel}
              </p>
            ) : null}
          </div>

          <div
            className="rounded-xl border border-white/20 bg-white/15 px-2.5 py-2 text-right shadow-lg 
          shadow-emerald-950/10 dark:border-white/10 dark:bg-black/20 shrink-0 items-end max-w-44"
          >
            <p className="text-[8px] uppercase tracking-[0.14em] text-white/65 leading-tight">
              {costEstimate.lifecycleYears
                ? `${costEstimate.lifecycleYears}yr Total`
                : "Est. Total"}
            </p>
            <p className="mt-0.5 text-base font-bold font-poppins whitespace-nowrap">
              {formatCurrency(costEstimate.totalEstimate)}
            </p>
            {typeof costEstimate.capitalCost === "number" && (
              <p className="text-[9px] text-white/80 mt-0.5">
                CAPEX {formatCurrency(costEstimate.capitalCost)}
              </p>
            )}
            <p className="text-[10px] text-white/65 wrap-anywhere text-wrap">
              {costEstimate.perUnit}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-3 text-neutral-900 dark:text-neutral-100">
        <div className="grid gap-2 grid-cols-2">
          {summaryCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              note={card.note}
            />
          ))}
        </div>

        <section className="space-y-2 rounded-lg border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950/50">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-100 bg-white shrink-0 dark:border-neutral-800 dark:bg-neutral-900">
              <DollarSign size={12} className="text-green-700" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
                Cost Breakdown
              </h4>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Materials, labor, maintenance &amp; contingency.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <BreakdownItem
              icon={<Package size={14} className="text-blue-600" />}
              label="Materials"
              amount={costEstimate.breakdown.materials}
              shareLabel={formatShare(
                costEstimate.breakdown.materials,
                totalForShares,
              )}
              sharePercent={
                (costEstimate.breakdown.materials / totalForShares) * 100
              }
              barClassName="bg-blue-500"
            />

            <BreakdownItem
              icon={<Wrench size={14} className="text-purple-600" />}
              label="Labor"
              amount={costEstimate.breakdown.labor}
              shareLabel={formatShare(
                costEstimate.breakdown.labor,
                totalForShares,
              )}
              sharePercent={
                (costEstimate.breakdown.labor / totalForShares) * 100
              }
              barClassName="bg-purple-500"
            />

            {typeof costEstimate.breakdown.maintenance === "number" &&
              costEstimate.breakdown.maintenance > 0 && (
                <BreakdownItem
                  icon={<Sprout size={14} className="text-emerald-600" />}
                  label={
                    costEstimate.lifecycleYears
                      ? `Maintenance (${costEstimate.lifecycleYears}-yr)`
                      : "Maintenance"
                  }
                  amount={costEstimate.breakdown.maintenance}
                  shareLabel={formatShare(
                    costEstimate.breakdown.maintenance,
                    totalForShares,
                  )}
                  sharePercent={
                    (costEstimate.breakdown.maintenance / totalForShares) * 100
                  }
                  barClassName="bg-emerald-500"
                />
              )}

            <BreakdownItem
              icon={<AlertCircle size={14} className="text-orange-600" />}
              label="Contingency"
              amount={costEstimate.breakdown.contingency}
              shareLabel={formatShare(
                costEstimate.breakdown.contingency,
                totalForShares,
              )}
              sharePercent={
                (costEstimate.breakdown.contingency / totalForShares) * 100
              }
              barClassName="bg-orange-500"
            />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <section className="space-y-1.5 rounded-lg border border-neutral-100 bg-white p-2.5 dark:border-neutral-800 dark:bg-neutral-950/50">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">
              Context
            </h4>
            <div className="space-y-1">
              <DetailRow
                label="Intervention"
                value={costEstimate.interventionType}
              />
              <DetailRow label="For" value={siteLabel} />
              <DetailRow
                label="Location"
                value={locationLabel || "Selected area"}
              />
              <DetailRow label="Area" value={formatArea()} />
              <DetailRow label="Currency" value={costEstimate.currencyUnit} />
            </div>
          </section>

          <section className="space-y-1 rounded-lg border border-amber-100 bg-amber-50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/40">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              Notes
            </h4>
            <p className="text-[10px] leading-relaxed text-amber-900/80 dark:text-amber-100/80">
              Assumes current pricing &amp; standard site access. Confirm final
              cost during detailed assessment.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}

function formatShare(amount: number, total: number) {
  return `${((amount / total) * 100).toFixed(0)}%`;
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/50 dark:shadow-black/20">
      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500 line-clamp-2">
        {label}
      </p>
      <p className="mt-1 break-words text-xs font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
        {value}
      </p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
        {note}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-neutral-50 px-2 py-1.5 dark:bg-neutral-900/70">
      <span className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500">
        {label}
      </span>
      <span className="break-words text-xs font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
      </span>
    </div>
  );
}

function BreakdownItem({
  icon,
  label,
  amount,
  shareLabel,
  sharePercent,
  barClassName,
}: {
  icon: ReactNode;
  label: string;
  amount: number;
  shareLabel: string;
  sharePercent: number;
  barClassName: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-neutral-100 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/50 dark:shadow-black/20">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 break-words">
              {label}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {shareLabel} of total
            </p>
          </div>
        </div>

        <p className="whitespace-nowrap text-xs font-bold text-neutral-900 dark:text-neutral-100 shrink-0">
          {new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(amount)}
        </p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${Math.max(0, Math.min(100, sharePercent))}%` }}
        />
      </div>
    </div>
  );
}

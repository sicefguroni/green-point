"use client";

import type { ReactNode } from "react";
import { DollarSign, Package, Wrench, AlertCircle } from "lucide-react";
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
      <div className="overflow-hidden rounded-[28px] border border-neutral-100 bg-white animate-pulse shadow-sm">
        <div className="bg-gradient-to-r from-neutral-100 to-neutral-50 px-5 py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-neutral-200 rounded-lg" />
            <div className="h-4 w-40 bg-neutral-200 rounded" />
          </div>
          <div className="h-8 w-52 bg-neutral-200 rounded" />
          <div className="mt-2 h-4 w-64 bg-neutral-200 rounded" />
        </div>
        <div className="space-y-3 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-20 rounded-2xl bg-neutral-100" />
            <div className="h-20 rounded-2xl bg-neutral-100" />
            <div className="h-20 rounded-2xl bg-neutral-100" />
            <div className="h-20 rounded-2xl bg-neutral-100" />
          </div>
          <div className="h-40 rounded-2xl bg-neutral-100" />
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
      displayAreaHectares !== null ? ` (${displayAreaHectares.toFixed(2)} ha)` : "";

    return `${areaFormatter.format(siteAreaSqm)} m²${hectaresLabel}`;
  };

  const siteLabel = siteName?.trim().length ? siteName.trim() : "Selected site";
  const locationLabel = [siteAddress?.trim(), barangayName?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(" • ");
  const locationAdjustment = (costEstimate.locationMultiplier - 1) * 100;

  const summaryCards = [
    {
      label: "Base Cost",
      value: formatCurrency(costEstimate.basePrice),
      note: "Before location and project adjustments",
    },
    {
      label: "Site Area",
      value: formatArea(),
      note:
        costEstimate.area === null
          ? "Area not supplied"
          : "Area from selected feature",
    },
    {
      label: "Location Multiplier",
      value: `${costEstimate.locationMultiplier.toFixed(2)}x`,
      note:
        locationAdjustment === 0
          ? "No location adjustment applied"
          : `${locationAdjustment > 0 ? "+" : ""}${locationAdjustment.toFixed(0)}% from base`,
    },
    {
      label: "Unit Basis",
      value: costEstimate.perUnit,
      note: costEstimate.currencyUnit,
    },
  ];

  return (
    <article className="overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-sm">
      <header className="bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500 px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/70">
              GreenPoint Cost Estimate
            </p>
            <h4 className="text-2xl font-black font-poppins leading-tight">
              Project Cost Estimate
            </h4>
            <p className="text-sm text-white/80">Prepared for {siteLabel}</p>
            {locationLabel ? (
              <p className="text-xs text-white/70">{locationLabel}</p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-3 text-right shadow-lg shadow-emerald-950/10">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">
              Estimated Total
            </p>
            <p className="mt-1 text-3xl font-black font-poppins">
              {formatCurrency(costEstimate.totalEstimate)}
            </p>
            <p className="text-xs text-white/75">{costEstimate.perUnit}</p>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              note={card.note}
            />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <section className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-lg border border-neutral-100 flex items-center justify-center">
                <DollarSign size={18} className="text-green-700" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
                  Cost Breakdown
                </h4>
                <p className="text-xs text-neutral-500">
                  Materials, labor, and contingency contributions.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <BreakdownItem
                icon={<Package size={16} className="text-blue-600" />}
                label="Materials"
                amount={costEstimate.breakdown.materials}
                shareLabel={formatShare(costEstimate.breakdown.materials, totalForShares)}
                sharePercent={(costEstimate.breakdown.materials / totalForShares) * 100}
                barClassName="bg-blue-500"
              />

              <BreakdownItem
                icon={<Wrench size={16} className="text-purple-600" />}
                label="Labor"
                amount={costEstimate.breakdown.labor}
                shareLabel={formatShare(costEstimate.breakdown.labor, totalForShares)}
                sharePercent={(costEstimate.breakdown.labor / totalForShares) * 100}
                barClassName="bg-purple-500"
              />

              <BreakdownItem
                icon={<AlertCircle size={16} className="text-orange-600" />}
                label="Contingency"
                amount={costEstimate.breakdown.contingency}
                shareLabel={formatShare(costEstimate.breakdown.contingency, totalForShares)}
                sharePercent={(costEstimate.breakdown.contingency / totalForShares) * 100}
                barClassName="bg-orange-500"
              />
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-neutral-100 bg-white p-4 space-y-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
                Estimate Context
              </h4>

              <div className="space-y-2">
                <DetailRow label="Intervention" value={costEstimate.interventionType} />
                <DetailRow label="Prepared for" value={siteLabel} />
                <DetailRow
                  label="Location"
                  value={locationLabel || "Selected area"}
                />
                <DetailRow label="Area basis" value={formatArea()} />
                <DetailRow label="Currency" value={costEstimate.currencyUnit} />
              </div>
            </section>

            <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4 space-y-2">
              <h4 className="text-xs font-bold text-amber-700 uppercase tracking-[0.2em]">
                Notes
              </h4>
              <p className="text-sm leading-relaxed text-amber-900/80">
                Estimate assumes current material pricing, standard site access,
                and the location adjustment shown above. Final pricing should be
                confirmed during detailed site assessment.
              </p>
            </section>
          </aside>
        </div>

        <div className="rounded-2xl border border-neutral-100 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
                Document Summary
              </h4>
              <p className="mt-1 text-sm text-neutral-500">
                This estimate combines the base cost, location adjustment, and
                contingency into a single project figure.
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                Contingency
              </p>
              <p className="mt-1 text-lg font-bold text-neutral-900">
                {formatCurrency(costEstimate.breakdown.contingency)}
              </p>
            </div>
          </div>
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
    <div className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-neutral-900 leading-snug break-words">
        {value}
      </p>
      <p className="mt-2 text-xs text-neutral-500">{note}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-400">
        {label}
      </span>
      <span className="max-w-[55%] text-right text-sm font-semibold text-neutral-900 break-words">
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
    <div className="rounded-2xl border border-neutral-100 bg-white p-3.5 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">{label}</p>
            <p className="text-xs text-neutral-500">{shareLabel} of total</p>
          </div>
        </div>

        <p className="font-bold text-neutral-900 whitespace-nowrap">
          {new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(amount)}
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full ${barClassName}`}
          style={{ width: `${Math.max(0, Math.min(100, sharePercent))}%` }}
        />
      </div>
    </div>
  );
}
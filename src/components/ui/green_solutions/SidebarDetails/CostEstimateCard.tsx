"use client";

import { DollarSign, Package, Wrench, AlertCircle } from 'lucide-react';
import type { CostEstimate } from '@/types/green_solutions';

interface CostEstimateCardProps {
  costEstimate: CostEstimate;
  isLoading?: boolean;
}

export default function CostEstimateCard({ costEstimate, isLoading = false }: CostEstimateCardProps) {
  if (isLoading) {
    return (
      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-neutral-200 rounded-lg" />
          <div className="h-4 w-32 bg-neutral-200 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-6 w-24 bg-neutral-200 rounded" />
          <div className="h-4 w-40 bg-neutral-200 rounded" />
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const percentOfTotal = (amount: number) => {
    if (!costEstimate.totalEstimate) return '0';
    return ((amount / costEstimate.totalEstimate) * 100).toFixed(0);
  };

  const extraLineItems = (costEstimate.lineItems ?? []).filter(
    (item) => !['materials', 'labor', 'contingency'].includes(item.category),
  );

  return (
    <div className="space-y-4">
      {/* Main cost card */}
      <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign size={18} className="text-green-700" />
          </div>
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
            Cost Estimate
          </h4>
        </div>
        
        <div className="space-y-2">
          <p className="text-3xl font-bold font-poppins text-green-700">
            {formatCurrency(costEstimate.totalEstimate)}
          </p>
          <p className="text-xs text-neutral-600">
            {costEstimate.perUnit} {costEstimate.area ? `• ${costEstimate.area.toFixed(2)} m²` : ''}
          </p>
          {costEstimate.locationMultiplier !== 1 && (
            <p className="text-xs text-neutral-500">
              Location adjustment: {((costEstimate.locationMultiplier - 1) * 100).toFixed(0)}%
            </p>
          )}
          {costEstimate.confidence && (
            <p className="text-xs text-neutral-500 capitalize">
              Confidence: {costEstimate.confidence}
            </p>
          )}
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
          Cost Breakdown
        </h4>
        
        <div className="space-y-2">
          {/* Materials */}
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-50 rounded flex items-center justify-center">
                <Package size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Materials</p>
                <p className="text-xs text-neutral-500">
                  {percentOfTotal(costEstimate.breakdown.materials)}%
                </p>
              </div>
            </div>
            <p className="font-bold text-neutral-900">
              {formatCurrency(costEstimate.breakdown.materials)}
            </p>
          </div>

          {/* Labor */}
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-50 rounded flex items-center justify-center">
                <Wrench size={16} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Labor</p>
                <p className="text-xs text-neutral-500">
                  {percentOfTotal(costEstimate.breakdown.labor)}%
                </p>
              </div>
            </div>
            <p className="font-bold text-neutral-900">
              {formatCurrency(costEstimate.breakdown.labor)}
            </p>
          </div>

          {/* Contingency */}
          <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-orange-50 rounded flex items-center justify-center">
                <AlertCircle size={16} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Contingency</p>
                <p className="text-xs text-neutral-500">
                  {percentOfTotal(costEstimate.breakdown.contingency)}%
                </p>
              </div>
            </div>
            <p className="font-bold text-neutral-900">
              {formatCurrency(costEstimate.breakdown.contingency)}
            </p>
          </div>
        </div>

        {/* Cost info */}
        <div className="pt-2 border-t border-neutral-200">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Base cost: {formatCurrency(costEstimate.basePrice)} • {costEstimate.estimateBasis || 'Estimate may vary based on site conditions'}
          </p>
        </div>
      </div>

      {extraLineItems.length > 0 && (
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
            Additional Cost Drivers
          </h4>
          <div className="space-y-2">
            {extraLineItems.map((item) => (
              <div key={`${item.category}-${item.label}`} className="rounded-xl border border-neutral-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
                    {item.rationale && (
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{item.rationale}</p>
                    )}
                    {item.sourceStudy && (
                      <p className="mt-1 text-[11px] italic text-neutral-400">{item.sourceStudy}</p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-neutral-900">{formatCurrency(item.estimatedCost)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {costEstimate.technicalConsiderations && costEstimate.technicalConsiderations.length > 0 && (
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
            Technical Considerations
          </h4>
          <div className="space-y-2">
            {costEstimate.technicalConsiderations.map((item) => (
              <div key={`${item.phaseHint}-${item.title}`} className="rounded-xl border border-neutral-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    {item.phaseHint}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-neutral-600">{item.detail}</p>
                {item.sourceStudy && (
                  <p className="mt-2 text-[11px] italic text-neutral-400">{item.sourceStudy}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(costEstimate.assumptions?.length || costEstimate.citations?.length) && (
        <div className="grid gap-4 md:grid-cols-2">
          {costEstimate.assumptions && costEstimate.assumptions.length > 0 && (
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
                Planning Assumptions
              </h4>
              <ul className="space-y-2 text-xs leading-relaxed text-neutral-600">
                {costEstimate.assumptions.map((assumption) => (
                  <li key={assumption}>• {assumption}</li>
                ))}
              </ul>
            </div>
          )}

          {costEstimate.citations && costEstimate.citations.length > 0 && (
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
              <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
                Research Grounding
              </h4>
              <ul className="space-y-2 text-xs leading-relaxed text-neutral-600">
                {costEstimate.citations.map((citation) => (
                  <li key={citation}>• {citation}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {costEstimate.marketReferences && costEstimate.marketReferences.length > 0 && (
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-[0.2em]">
            Local Market References
          </h4>
          <div className="space-y-3">
            {costEstimate.marketReferences.map((reference) => (
              <div key={reference.url} className="rounded-xl border border-neutral-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      {reference.title}
                    </a>
                    {reference.locality && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                        {reference.locality}
                      </p>
                    )}
                    <p className="text-xs leading-relaxed text-neutral-600">{reference.snippet}</p>
                  </div>
                  {typeof reference.score === 'number' && (
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-500">
                      {(reference.score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

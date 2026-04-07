"use client";

import { DollarSign, Package, Wrench, AlertCircle, Clock3 } from 'lucide-react';
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

  const totalEstimate = Math.max(costEstimate.totalEstimate, 1);

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
            {costEstimate.perUnit}
            {costEstimate.quantity && costEstimate.quantity > 1
              ? ` • ${costEstimate.quantity.toFixed(0)} units`
              : ''}
            {costEstimate.area ? ` • ${costEstimate.area.toFixed(2)} m²` : ''}
          </p>
          {costEstimate.lifecycleYears ? (
            <p className="text-xs text-neutral-500 flex items-center gap-1.5">
              <Clock3 size={12} />
              Lifecycle horizon: {costEstimate.lifecycleYears} years
            </p>
          ) : null}
          {costEstimate.locationMultiplier !== 1 && (
            <p className="text-xs text-neutral-500">
              Location adjustment: {((costEstimate.locationMultiplier - 1) * 100).toFixed(0)}%
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
                  {((costEstimate.breakdown.materials / totalEstimate) * 100).toFixed(0)}%
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
                  {((costEstimate.breakdown.labor / totalEstimate) * 100).toFixed(0)}%
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
                  {((costEstimate.breakdown.contingency / totalEstimate) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <p className="font-bold text-neutral-900">
              {formatCurrency(costEstimate.breakdown.contingency)}
            </p>
          </div>

          {typeof costEstimate.breakdown.maintenance === 'number' && (
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-50 rounded flex items-center justify-center">
                  <Clock3 size={16} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Lifecycle Maintenance</p>
                  <p className="text-xs text-neutral-500">
                    {((costEstimate.breakdown.maintenance / totalEstimate) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              <p className="font-bold text-neutral-900">
                {formatCurrency(costEstimate.breakdown.maintenance)}
              </p>
            </div>
          )}
        </div>

        {/* Cost info */}
        <div className="pt-2 border-t border-neutral-200">
          <p className="text-xs text-neutral-500">
            Reference unit cost: {formatCurrency(costEstimate.basePrice)} • Estimate may vary based on site conditions
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { SimulationInputsState, SimulationIntent, SimulationBaselineData, SimulationStepId } from "./simulation-types";
import { ClimateStep } from "./components/ClimateStep";
import { StrategyStep } from "./components/StrategyStep";
import { AmbitionBudgetStep } from "./components/AmbitionBudgetStep";
import { ReviewStep } from "./components/ReviewStep";
import { AdvancedDrawer } from "./components/AdvancedDrawer";
import { BarangayDetailMap, BaselineCard } from "./components/SimulationSidebar";

export type { SimulationStepId };

export type SimulationInputsProps = {
  step: SimulationStepId;
  intent: SimulationIntent;
  inputs: SimulationInputsState;
  baseline: SimulationBaselineData;
  onIntentChange: (partial: Partial<SimulationIntent>) => void;
  onAdvancedChange: <K extends keyof SimulationInputsState>(
    key: K,
    value: SimulationInputsState[K],
  ) => void;
};

const SimulationInputs = (props: SimulationInputsProps) => {
  const { step, baseline } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {step === "climate" && <ClimateStep intent={props.intent} baseline={props.baseline} onIntentChange={props.onIntentChange} />}
        {step === "strategy" && <StrategyStep intent={props.intent} baseline={props.baseline} onIntentChange={props.onIntentChange} />}
        {step === "ambitionBudget" && <AmbitionBudgetStep intent={props.intent} baseline={props.baseline} onIntentChange={props.onIntentChange} />}
        {step === "review" && <ReviewStep intent={props.intent} baseline={props.baseline} inputs={props.inputs} />}

        <AdvancedDrawer inputs={props.inputs} onAdvancedChange={props.onAdvancedChange} />
      </div>

      <div className="lg:col-span-1 space-y-4">
        <BarangayDetailMap />
        <BaselineCard baseline={baseline} />
      </div>
    </div>
  );
};

export default SimulationInputs;

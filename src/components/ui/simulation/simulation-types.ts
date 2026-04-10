export type SimulationInputsState = {
  temperature_increase_rate: number;
  flooding_severity: string;
  rainfall_change_rate: number;
  canopy_target_percent: number;
  ndvi_target: number;
  intervention_type: string;
  total_budget_cap: number;
  cost_per_sqm: number;
  maintenance_cost_rate: number;
  time_horizon: number;
};

export type SimulationBaselineData = {
  ndvi: number;
  lst: number;
  floodExposure: string;
  greeneryIndex: number;
  canopyCover: number;
  currentIntervention: string;
};

export type SimulationResultsState = {
  environmental: {
    cooling_potential: number;
    canopy_gain: number;
    stormwater_retention: number;
    pm25_removal: number;
    no2_removal: number;
  };
  giEvolution: {
    year: number;
    gi_score: number;
    quantity_score: number;
    environmental_quality_score: number;
  }[];
  finalGI: {
    gi_score: number;
    gi_level: string;
  };
  recommendation: {
    strategy: string;
    priority: string;
    rationale: string;
  };
};

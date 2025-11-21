export type HazardStat = {
  min: number;
  max: number;
  dominant: number;
  values: number[]; 
};

export type BarangayHazardSummary = {
  name: string;
  id?: string | number;
  flood5yr?: HazardStat | null;
  flood25yr?: HazardStat | null;
  flood100yr?: HazardStat | null;
  stormAdv1?: HazardStat | null;
  stormAdv2?: HazardStat | null;
  stormAdv3?: HazardStat | null;
  stormAdv4?: HazardStat | null;
};

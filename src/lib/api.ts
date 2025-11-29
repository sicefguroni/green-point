import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_MODEL_API_URL || 'http://localhost:8000';

// Clean barangay name for display (remove (Pob.) suffix)
function cleanBarangayName(name: string): string {
  return name.replace(/\s*\(Pob\.\)\s*$/i, '').trim();
}

export interface BarangayResult {
  brgy_name: string;
  gi_score: number;
  gi_level: string;
  gi_rank: number;
  ndvi_mean: number;
  canopy_cover_pct: number;
  mean_lst: number;
  [key: string]: string | number;
}

export interface Recommendation {
  barangay_name: string;
  intervention_type: string;
  intervention_name: string;
  priority_rank: number;
  estimated_cost_per_sqm: number;
  cooling_potential: number;
  stormwater_retention: number;
  pm25_removal: number;
  efficiency_score?: number;
  explanation?: string;
}

export const api = {
  async getFinalResults(): Promise<BarangayResult[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/final_results`);
      // Clean barangay names in the response
      return response.data.map((item: BarangayResult) => ({
        ...item,
        brgy_name: cleanBarangayName(item.brgy_name)
      }));
    } catch (error) {
      console.error('Error fetching final results:', error);
      return [];
    }
  },

  async getRecommendations(): Promise<Recommendation[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/data/recommendations`);
      // Clean barangay names in the response
      return response.data.map((item: Recommendation) => ({
        ...item,
        barangay_name: cleanBarangayName(item.barangay_name)
      }));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      return [];
    }
  },

  async getBarangayData(name: string): Promise<BarangayResult | null> {
    try {
      const results = await this.getFinalResults();
      const normalizeName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      const target = normalizeName(name);
      return results.find(r => normalizeName(r.brgy_name) === target) || null;
    } catch (error) {
      console.error(`Error fetching data for ${name}:`, error);
      return null;
    }
  },

  async getBarangayRecommendations(name: string): Promise<Recommendation[]> {
    try {
      const recs = await this.getRecommendations();
      const normalizeName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      const target = normalizeName(name);
      return recs.filter(r => normalizeName(r.barangay_name) === target);
    } catch (error) {
      console.error(`Error fetching recommendations for ${name}:`, error);
      return [];
    }
  }
};

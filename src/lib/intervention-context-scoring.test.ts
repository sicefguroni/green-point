import { describe, expect, it } from "vitest";
import {
  adjustRecommendationForContext,
  analyzeInterventionContext,
  classifyIntervention,
} from "./intervention-context-scoring";

describe("intervention context scoring", () => {
  it("de-emphasizes broad tree planting where canopy is already high", () => {
    const rec = {
      name: "Street Tree Planting Campaign",
      interventionType: "Urban Canopy Enhancement",
      relevancy: 0.85,
      feasibility: 0.8,
      impact: 0.75,
      priority: "high",
    };

    const adjusted = adjustRecommendationForContext(rec, {
      treeCanopy: 0.62,
      greeneryIndex: 0.75,
      ndvi: 0.58,
      lst: 31,
      taggedTreeCount: 18,
      inventoryCanopyFraction: 0.34,
    });

    expect(classifyIntervention(rec).isBroadTreePlanting).toBe(true);
    expect(adjusted.relevancy).toBeLessThan(rec.relevancy);
    expect(adjusted.feasibility).toBeLessThan(rec.feasibility);
    expect(adjusted.priority).toBe("medium");
  });

  it("boosts envelope greening in likely tight hot ground contexts", () => {
    const rec = {
      name: "Green Roof and Vertical Wall Retrofits",
      interventionType: "Building Envelope Green",
      relevancy: 0.55,
      feasibility: 0.55,
      impact: 0.5,
      priority: "medium",
    };

    const context = {
      treeCanopy: 0.12,
      ndvi: 0.19,
      greeneryIndex: 0.3,
      lst: 35.5,
      areaHectares: 1.2,
    };

    expect(analyzeInterventionContext(context).likelyTightGround).toBe(true);
    const adjusted = adjustRecommendationForContext(rec, context);

    expect(adjusted.relevancy).toBeGreaterThan(rec.relevancy);
    expect(adjusted.feasibility).toBeGreaterThan(rec.feasibility);
    expect(adjusted.priority).toBe("high");
  });

  it("boosts stormwater interventions for flood-prone areas", () => {
    const rec = {
      name: "Bioswale and Rain Garden Network",
      interventionType: "Stormwater Retention",
      relevancy: 0.5,
      feasibility: 0.55,
      impact: 0.55,
      priority: "medium",
    };

    const adjusted = adjustRecommendationForContext(rec, {
      floodHazard: 3,
      stormHazard: 2,
      treeCanopy: 0.45,
      greeneryIndex: 0.62,
      lst: 32,
    });

    expect(adjusted.relevancy).toBeGreaterThan(0.8);
    expect(adjusted.impact).toBeGreaterThan(rec.impact);
    expect(adjusted.priority).toBe("high");
  });

  it("ranks targeted infill above stewardship in already-greened areas", () => {
    const stewardship = {
      name: "Tree Stewardship and Maintenance Program",
      interventionType: "Tree care and pruning",
      relevancy: 0.7,
      feasibility: 0.7,
      impact: 0.55,
      priority: "high",
    };
    const targetedInfill = {
      name: "Targeted Infill Tree Planting",
      interventionType: "Targeted street-tree infill where shade gaps exist",
      relevancy: 0.7,
      feasibility: 0.7,
      impact: 0.55,
      priority: "medium",
    };

    const context = {
      treeCanopy: 0.55,
      greeneryIndex: 0.7,
      ndvi: 0.55,
      lst: 31,
      taggedTreeCount: 25,
      inventoryCanopyFraction: 0.32,
    };

    const adjStewardship = adjustRecommendationForContext(stewardship, context);
    const adjTargeted = adjustRecommendationForContext(targetedInfill, context);

    // Creation must outrank stewardship even when canopy is already healthy:
    // stewardship is valuable, but adding new greenery is the headline action.
    expect(adjTargeted.relevancy).toBeGreaterThan(adjStewardship.relevancy);
    expect(adjTargeted.impact).toBeGreaterThan(adjStewardship.impact);
  });

  it("ranks creation interventions above stewardship in tight hot ground contexts", () => {
    const stewardship = {
      name: "Tree Care and Preservation",
      interventionType: "Stewardship",
      relevancy: 0.7,
      feasibility: 0.7,
      impact: 0.55,
      priority: "high",
    };
    const envelope = {
      name: "Green Roofs and Vertical Greening",
      interventionType: "Building envelope greening",
      relevancy: 0.55,
      feasibility: 0.55,
      impact: 0.5,
      priority: "medium",
    };
    const pocket = {
      name: "Pocket Park and Community Garden",
      interventionType: "Community greening",
      relevancy: 0.55,
      feasibility: 0.55,
      impact: 0.5,
      priority: "medium",
    };

    const context = {
      treeCanopy: 0.12,
      ndvi: 0.19,
      greeneryIndex: 0.3,
      lst: 35.5,
      areaHectares: 1.2,
    };

    const adjStewardship = adjustRecommendationForContext(stewardship, context);
    const adjEnvelope = adjustRecommendationForContext(envelope, context);
    const adjPocket = adjustRecommendationForContext(pocket, context);

    expect(adjEnvelope.relevancy).toBeGreaterThan(adjStewardship.relevancy);
    expect(adjPocket.relevancy).toBeGreaterThan(adjStewardship.relevancy);
    // In a green-deficit / heat-stressed context, stewardship is explicitly
    // demoted in priority too: a "high"-priority AI tag gets soft-demoted to
    // "medium" (matching the existing soft-demote behavior used for broad
    // tree planting in green-rich areas).
    expect(adjStewardship.priority).toBe("medium");
  });

  it("never bumps stewardship to high priority on its own, even with high canopy", () => {
    const rec = {
      name: "Tree Stewardship Program",
      interventionType: "Maintenance",
      relevancy: 0.6,
      feasibility: 0.6,
      impact: 0.5,
      priority: "medium",
    };

    const adjusted = adjustRecommendationForContext(rec, {
      treeCanopy: 0.62,
      greeneryIndex: 0.75,
      ndvi: 0.58,
      lst: 30,
      taggedTreeCount: 30,
      inventoryCanopyFraction: 0.4,
    });

    expect(adjusted.priority).not.toBe("high");
  });

  it("identifies the biggest challenge and ranks the alleviating intervention highest", () => {
    // Severe-flooding barangay: stormwater interventions should outrank
    // a generic urban-canopy planting on relevancy and impact, even when
    // both are presented to the engine with the same starting scores.
    const stormwater = {
      name: "Bioswales and Rain Gardens",
      interventionType: "Stormwater Management",
      relevancy: 0.55,
      feasibility: 0.55,
      impact: 0.5,
      priority: "medium",
    };
    const broadTrees = {
      name: "Citywide Tree Planting Drive",
      interventionType: "Urban Canopy Enhancement",
      relevancy: 0.55,
      feasibility: 0.55,
      impact: 0.5,
      priority: "medium",
    };

    const floodHeavy = {
      treeCanopy: 0.4,
      ndvi: 0.45,
      greeneryIndex: 0.55,
      lst: 31,
      floodHazard: 3,
      stormHazard: 1,
    };

    const adjStormwater = adjustRecommendationForContext(stormwater, floodHeavy);
    const adjBroadTrees = adjustRecommendationForContext(broadTrees, floodHeavy);

    expect(adjStormwater.relevancy).toBeGreaterThan(adjBroadTrees.relevancy);
    expect(adjStormwater.impact).toBeGreaterThan(adjBroadTrees.impact);
    expect(adjStormwater.priority).toBe("high");
  });

  it("routes air-quality challenges toward buffer / corridor planting", () => {
    // High AQI but moderate everything else — the biggest challenge is
    // poor air quality, so a buffer-planting intervention should outscore
    // an unrelated stormwater retrofit despite both adding greenery.
    const buffer = {
      name: "Roadside Buffer Planting",
      interventionType: "Buffer Planting",
      relevancy: 0.55,
      feasibility: 0.55,
      impact: 0.5,
      priority: "medium",
    };
    const stormwater = {
      name: "Bioswales and Rain Gardens",
      interventionType: "Stormwater Management",
      relevancy: 0.55,
      feasibility: 0.55,
      impact: 0.5,
      priority: "medium",
    };

    const dirtyAir = {
      treeCanopy: 0.4,
      ndvi: 0.45,
      greeneryIndex: 0.55,
      lst: 31,
      floodHazard: 1,
      aqi: 130,
    };

    const adjBuffer = adjustRecommendationForContext(buffer, dirtyAir);
    const adjStormwater = adjustRecommendationForContext(stormwater, dirtyAir);

    expect(adjBuffer.relevancy).toBeGreaterThan(adjStormwater.relevancy);
  });
});

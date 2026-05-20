"use client";

import { useState, useCallback, useEffect } from "react";
import type { SavePayload } from "@/types/green_solutions";

interface GenerationParams {
  modelVersion: string;
  promptHash?: string;
  temperature?: number;
}

interface SolutionContext {
  mapState?: unknown;
  filters?: unknown;
  generationParams?: GenerationParams;
}

export interface SavedSolutionRow {
  id: string;
  locationType: string;
  locationId: string | null;
  locationName: string | null;
  locationMetadata: unknown;
  solutionSnapshot: Record<string, unknown>;
  contextSnapshot: {
    mapState?: unknown;
    filters?: unknown;
    generationParams?: {
      modelVersion: string;
      promptHash?: string;
      temperature?: number;
    };
  };
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  previousVersionId?: string;
}

interface SaveSolutionParams extends SavePayload {
  isUpdate?: boolean;
  previousVersionId?: string;
  version?: number;
  tags?: string[];
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function useSavedSolutions() {
  const [saves, setSaves] = useState<SavedSolutionRow[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSaves = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-solutions", {
        credentials: "same-origin",
      });
      if (res.status === 401) {
        setError("Sign in to save solutions.");
        return;
      }
      const json = await res.json();
      if (json.success) setSaves(json.data ?? []);
    } catch {
      setError("Failed to load saves.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSaves();
  }, [fetchSaves]);

  const getSolutionVersions = useCallback(
    async (solutionId: string): Promise<SavedSolutionRow[]> => {
      try {
        const res = await fetch(`/api/saved-solutions?versionOf=${solutionId}`, {
        credentials: "same-origin",
      });
        const json = await res.json();
        if (json.success) return json.data ?? [];
        return [];
      } catch {
        return [];
      }
    },
    []
  );

  const saveSolution = useCallback(
    async (params: SaveSolutionParams) => {
      try {
        const payload = {
          ...params,
          contextSnapshot: {
            ...params.contextSnapshot,
            generationParams: {
              modelVersion: process.env.NEXT_PUBLIC_AI_MODEL_VERSION || '1.0',
              ...params.contextSnapshot?.generationParams,
            },
          },
          createdAt: params.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: params.isUpdate ? (params.version || 0) + 1 : 1,
        };
        const safePayload = JSON.parse(JSON.stringify(payload));

        const res = await fetch("/api/saved-solutions", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(safePayload),
        });

        const json = await res.json();
        if (json.success) {
          setSaves((prev) => [json.data, ...prev]);
          return { success: true, id: json.data.id };
        }
        return { success: false, error: json.error };
      } catch (error) {
        return { success: false, error: 'Network error' };
      }
    },
    []
  );

  const updateSolution = useCallback(
    async (solutionId: string, updates: Partial<SaveSolutionParams>) => {
      const existingSolution = saves.find((s) => s.id === solutionId);
      if (!existingSolution) {
        return { success: false, error: 'Solution not found' };
      }

      return saveSolution({
        locationType: existingSolution.locationType as SavePayload["locationType"],
        locationId: existingSolution.locationId,
        locationName: existingSolution.locationName,
        locationMetadata: existingSolution.locationMetadata as Record<string, unknown>,
        solutionSnapshot: existingSolution.solutionSnapshot,
        contextSnapshot: existingSolution.contextSnapshot as SolutionContext,
        ...updates,
        isUpdate: true,
        version: existingSolution.version,
        previousVersionId: solutionId
      });
    },
    [saves, saveSolution]
  );

  const removeSolution = useCallback(
    async (id: string) => {
      setSaves((prev) => prev.filter((s) => s.id !== id));
      try {
        await fetch(`/api/saved-solutions?id=${id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
      } catch {
        void fetchSaves();
      }
    },
    [fetchSaves]
  );

  const addTags = useCallback(
    async (solutionId: string, newTags: string[]) => {
      const solution = saves.find((s) => s.id === solutionId);
      if (!solution) return { success: false, error: 'Solution not found' };

      const updatedTags = Array.from(new Set([...solution.tags, ...newTags]));
      return updateSolution(solutionId, { tags: updatedTags });
    },
    [saves, updateSolution]
  );

  const addNotes = useCallback(
    async (solutionId: string, notes: string) => {
      return updateSolution(solutionId, { notes });
    },
    [updateSolution]
  );

  return {
    saves,
    selectedVersion,
    setSelectedVersion,
    isLoading,
    error,
    saveSolution,
    updateSolution,
    removeSolution,
    fetchSaves,
    getSolutionVersions,
    addTags,
    addNotes
  };
}

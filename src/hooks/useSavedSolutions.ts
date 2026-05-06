"use client";

import { useState, useCallback, useEffect } from "react";
import type { SavePayload } from "@/types/green_solutions";

interface SavedSolutionRow {
  id: string;
  locationType: string;
  locationId: string | null;
  locationName: string | null;
  locationMetadata: unknown;
  solutionSnapshot: Record<string, unknown>;
  contextSnapshot: Record<string, unknown>;
  notes: string | null;
  tags: string[];
  createdAt: string;
}

export function useSavedSolutions() {
  const [saves, setSaves] = useState<SavedSolutionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSaves = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-solutions");
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

  const saveSolution = useCallback(
    async (payload: SavePayload) => {
      try {
        const res = await fetch("/api/saved-solutions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          setSaves((prev) => [json.data, ...prev]);
          return true;
        } else {
          return false;
        }
      } catch {
        return false;
      }
    },
    []
  );

  const removeSolution = useCallback(
    async (id: string) => {
      setSaves((prev) => prev.filter((s) => s.id !== id));
      try {
        await fetch(`/api/saved-solutions?id=${id}`, { method: "DELETE" });
      } catch {
        void fetchSaves();
      }
    },
    [fetchSaves]
  );

  return { saves, isLoading, error, saveSolution, removeSolution, fetchSaves };
}

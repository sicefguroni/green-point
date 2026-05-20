'use client';

import React, { useMemo } from 'react';
import { create } from 'jsondiffpatch';
import { SavedSolutionRow } from '@/hooks/useSavedSolutions';

type SolutionDiffViewerProps = {
  oldSolution: SavedSolutionRow;
  newSolution: SavedSolutionRow;
};

export function SolutionDiffViewer({ oldSolution, newSolution }: SolutionDiffViewerProps) {
  const jdp = useMemo(() => create(), []);

  const diff = useMemo(() => {
    return jdp.diff(
      oldSolution.solutionSnapshot,
      newSolution.solutionSnapshot
    );
  }, [oldSolution, newSolution, jdp]);

  if (!diff) {
    return (
      <div className="solution-diff">
        <p>No changes between these versions</p>
      </div>
    );
  }

  return (
    <div className="solution-diff">
      <h3>Changes between versions</h3>
      <div className="diff-container">
        <div className="diff-header">
          <span>From: {new Date(oldSolution.updatedAt).toLocaleString()}</span>
          <span>To: {new Date(newSolution.updatedAt).toLocaleString()}</span>
        </div>
        <pre className="diff-content">
          <code>
            {JSON.stringify(diff, null, 2)}
          </code>
        </pre>
      </div>
    </div>
  );
}
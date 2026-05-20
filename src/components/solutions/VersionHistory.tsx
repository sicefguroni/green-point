'use client';

import React from 'react';
import { SavedSolutionRow } from '@/hooks/useSavedSolutions';

type VersionHistoryProps = {
  solutions: SavedSolutionRow[];
  onVersionSelect: (versionId: string) => void;
  selectedVersionId?: string;
};

export function VersionHistory({
  solutions,
  onVersionSelect,
  selectedVersionId
}: VersionHistoryProps) {
  const versions = solutions.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="version-history">
      <h3>Version History</h3>
      <ul className="version-list">
        {versions.map((solution) => (
          <li
            key={solution.id}
            className={`version-item ${selectedVersionId === solution.id ? 'selected' : ''}`}
            onClick={() => onVersionSelect(solution.id)}
          >
            <div className="version-header">
              <span className="version-number">Version {solution.version}</span>
              <span className="version-time">
                {new Date(solution.updatedAt).toLocaleString()}
              </span>
            </div>
            {solution.contextSnapshot?.generationParams?.modelVersion && (
              <div className="version-model">
                Model: {solution.contextSnapshot.generationParams.modelVersion}
              </div>
            )}
            {solution.notes && (
              <div className="version-notes">
                {solution.notes.substring(0, 50)}
                {solution.notes.length > 50 ? '...' : ''}
              </div>
            )}
            {solution.tags.length > 0 && (
              <div className="version-tags">
                {solution.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
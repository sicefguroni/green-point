export interface DraftRecencyInput {
  baselineGeneratedAt: string;
  draftSavedAt?: number | null;
  draftGeneratedAt?: string | null;
}

export function isDraftStale({
  baselineGeneratedAt,
  draftSavedAt,
  draftGeneratedAt,
}: DraftRecencyInput): boolean {
  const baselineTime = Date.parse(baselineGeneratedAt);
  if (Number.isNaN(baselineTime)) return false;

  const draftTime =
    typeof draftSavedAt === "number"
      ? draftSavedAt
      : draftGeneratedAt
        ? Date.parse(draftGeneratedAt)
        : null;

  if (draftTime === null || Number.isNaN(draftTime)) return false;

  return draftTime < baselineTime;
}

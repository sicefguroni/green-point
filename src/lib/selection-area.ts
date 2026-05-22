export const POINT_SELECTION_AREA_HECTARES = 0.75;

export function resolveSelectedAreaHectares(input: {
  customSelectionAreaHectares?: number | null;
  pointSelectionAreaHectares?: number | null;
  barangayAreaHectares?: number | null;
}): number | null {
  return (
    input.customSelectionAreaHectares ??
    input.pointSelectionAreaHectares ??
    input.barangayAreaHectares ??
    null
  );
}
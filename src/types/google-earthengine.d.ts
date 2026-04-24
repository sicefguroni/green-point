/**
 * Minimal typings for @google/earthengine (the package ships without types).
 * Covers the API surface used in this codebase.
 */

declare module "@google/earthengine" {
  /** Opaque handle returned by `Geometry.*` helpers. */
  type EEGeometry = object;

  interface EEImage {
    normalizedDifference(bands: readonly string[]): EEImage;
    select(...bands: string[]): EEImage;
    multiply(multiplier: number): EEImage;
    subtract(value: number): EEImage;
    unmask(value: number): EEImage;
    rename(name: string): EEImage;
    addBands(image: EEImage): EEImage;
    clip(geometry: EEGeometry): EEImage;
    gt(threshold: number): EEImage;
    lt(threshold: number): EEImage;
    lte(threshold: number): EEImage;
    and(other: EEImage): EEImage;
    divide(divisor: number): EEImage;
    clamp(min: number, max: number): EEImage;
    where(condition: EEImage, value: number | EEImage): EEImage;
    reduceRegion(options: {
      reducer: unknown;
      geometry: EEGeometry;
      scale: number;
    }): EEEvaluable;
    reduceRegions(options: {
      collection: EEFeatureCollection;
      reducer: unknown;
      scale: number;
      tileScale: number;
    }): EEEvaluable;
    getMap(
      vizParams: Record<string, unknown>,
      callback: (
        mapObj: { urlFormat: string } | undefined,
        err: unknown,
      ) => void,
    ): void;
  }

  interface EEImageCollection {
    filterBounds(geometry: unknown): EEImageCollection;
    filterDate(start: string, end: string): EEImageCollection;
    filter(filterArg: unknown): EEImageCollection;
    select(...bands: string[]): EEImageCollection;
    median(): EEImage;
  }

  /** Opaque feature handle. */
  type EEFeature = object;

  interface EEFeatureCollection {
    geometry(): EEGeometry;
  }

  interface EEEvaluable {
    evaluate(callback: (result: unknown, error?: unknown) => void): void;
  }

  interface EarthEngineApi {
    data: {
      authenticateViaPrivateKey(
        privateKey: Record<string, unknown>,
        onSuccess: () => void,
        onFailure: (err: unknown) => void,
      ): void;
    };
    initialize(
      _baseUrl: null,
      _tileUrl: null,
      onSuccess: () => void,
      onFailure: (err: unknown) => void,
      _opt: null,
      projectId: string,
    ): void;
    Filter: {
      lt(field: string, value: number): unknown;
    };
    Reducer: {
      first(): unknown;
    };
    Geometry: {
      Point(coordinates: readonly number[]): EEGeometry;
      Rectangle(bounds: readonly number[]): EEGeometry;
    };
    Image(constant: number): EEImage;
    Feature(
      geometry: EEGeometry,
      properties: Record<string, unknown>,
    ): EEFeature;
    FeatureCollection(features: readonly EEFeature[]): EEFeatureCollection;
    ImageCollection(id: string): EEImageCollection;
  }

  const ee: EarthEngineApi;
  export default ee;
}

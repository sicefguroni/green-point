"use client";

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";

const DEFAULT_CENTER: [number, number] = [123.939, 10.351];
const DEFAULT_ZOOM = 12;

export interface MapLifecycleRefs {
  mapContainerRef: React.RefObject<HTMLDivElement | null>;
  mapRef: React.MutableRefObject<mapboxgl.Map | null>;
  markerRef: React.MutableRefObject<mapboxgl.Marker | null>;
  currentStyleRef: React.MutableRefObject<string>;
  centerRef: React.MutableRefObject<[number, number]>;
  zoomRef: React.MutableRefObject<number>;
  onMapReadyRef: React.MutableRefObject<
    ((map: mapboxgl.Map, removeMarker: () => void) => void) | undefined
  >;
}

interface UseMapLifecycleOptions {
  styleUrl: string;
  center?: [number, number];
  zoom?: number;
}

export function useMapLifecycle(
  opts: UseMapLifecycleOptions,
): MapLifecycleRefs & { removeMarker: () => void } {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const currentStyleRef = useRef(opts.styleUrl);
  const centerRef = useRef<[number, number]>(opts.center ?? DEFAULT_CENTER);
  const zoomRef = useRef(opts.zoom ?? DEFAULT_ZOOM);
  const onMapReadyRef = useRef<
    ((map: mapboxgl.Map, removeMarker: () => void) => void) | undefined
  >(undefined);

  const removeMarker = useCallback(() => {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, []);

  useEffect(() => {
    centerRef.current = opts.center ?? DEFAULT_CENTER;
  }, [opts.center]);

  useEffect(() => {
    zoomRef.current = opts.zoom ?? DEFAULT_ZOOM;
  }, [opts.zoom]);

  // --- Map creation ---
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: currentStyleRef.current,
      center: centerRef.current,
      zoom: zoomRef.current,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl(), "bottom-right");

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Resize observer ---
  useEffect(() => {
    if (!mapContainerRef.current || !mapRef.current) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // --- Style switching ---
  useEffect(() => {
    if (mapRef.current && currentStyleRef.current !== opts.styleUrl) {
      currentStyleRef.current = opts.styleUrl;
      mapRef.current.setStyle(opts.styleUrl);
    }
  }, [opts.styleUrl]);

  // --- Center / zoom jump ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.jumpTo({
      center: opts.center ?? DEFAULT_CENTER,
      zoom: opts.zoom ?? DEFAULT_ZOOM,
    });
  }, [opts.center, opts.zoom]);

  return {
    mapContainerRef,
    mapRef,
    markerRef,
    currentStyleRef,
    centerRef,
    zoomRef,
    onMapReadyRef,
    removeMarker,
  };
}

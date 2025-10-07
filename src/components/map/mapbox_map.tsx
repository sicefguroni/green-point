"use client"

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

interface MapboxMapProps {
    center?: [number, number]; 
    zoom?: number;
    className?: string;
}

export default function MapboxMap({
    center = [123.9427, 10.3279], //default mandaue city
    zoom = 12,
    className = 'w-full h-full overflow-hidden',
}: MapboxMapProps) {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const map = useRef<mapboxgl.Map | null>(null);

    useEffect(() => {
        if(map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current as HTMLDivElement,
            style: "mapbox://styles/mapbox/streets-v12",
            center,
            zoom,
        });

        return() => {
            map.current?.remove();
            map.current = null;
        };
    }, [center, zoom]);

    return <div ref={mapContainer} className={className}/>
}
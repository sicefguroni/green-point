"use client"

import { useEffect, useRef, useState } from "react";
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
    const mapRef = useRef<mapboxgl.Map | null>(null);

    const [colors, setColors] = useState({
        3: "#023E8A", 
        2: "#0096C7", 
        1: "#48CAE4", 
    });

    useEffect(() => {
        if(mapRef.current) return;
        
        const map = new mapboxgl.Map({
            container: mapContainer.current as HTMLDivElement,
            style: "mapbox://styles/ishah-bautista/cmgoy4lim00ne01riagge2hm7",
            center,
            zoom,
        });
        
        mapRef.current = map
        
        map.on("load", () => {
            console.log("Map and styles loaded");
            console.log(map.getStyle().layers.map((l) => l.id));
        
            const floodLayerId = "cebu100yrflood-cieuwj"

            if(map.getLayer(floodLayerId)) {
                map.setPaintProperty(floodLayerId, "fill-color", [
                    "match",
                    ["get", "Var"],
                    1, colors[1],
                    2, colors[2],
                    3, colors[3],
                    "#48CAE4"
                ]);
                map.setPaintProperty(floodLayerId, "fill-opacity", 0.30);
            }
        })        

        return() => {
            map.remove();
            mapRef.current = null;
        };
    }, [center, zoom]);

    return <div ref={mapContainer} className={className}/>
}
"use client"

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

interface LayerVisibility { 
    [layerId: string]: boolean;
}

interface LayerColors {
    [layerId: string]: string[];
}

interface MapboxMapProps {
    center?: [number, number]; 
    zoom?: number;
    className?: string;
    styleUrl: string;
    layerVisibility: LayerVisibility;
    layerColors: LayerColors;
}

export default function MapboxMap({
    center = [123.9427, 10.3279], //default mandaue city
    zoom = 12,
    className = 'w-full h-full overflow-hidden',
    styleUrl,
    layerVisibility,
    layerColors,
}: MapboxMapProps) {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);

    
    useEffect(() => {
        if(mapRef.current) return;
        
        const map = new mapboxgl.Map({
            container: mapContainer.current as HTMLDivElement,
            style: styleUrl,
            center,
            zoom,
        });
        
        mapRef.current = map
        
        map.on('load', () => {
            // FLOOD LAYER
            map.addSource("floodSource", {
                type: "vector",
                url: "mapbox://ishah-bautista.1ok5a1p3"
            });
            
            map.addLayer({
                id: "floodLayer",
                type: "fill",
                source: "floodSource","source-layer": "Cebu100yrFlood-cieuwj",
                layout: {'visibility': layerVisibility.floodLayer ? 'visible' : 'none'},
                paint: {
                    "fill-color": [
                        "match",
                        ["get", "Var"], 
                        1, layerColors.floodLayer[0],
                        2, layerColors.floodLayer[1],
                        3, layerColors.floodLayer[2],
                        "#0096C7"
                    ],
                    "fill-opacity": 0.4
                }
            });
        
            // STORM SURGE LAYER
            map.addSource("stormSource", {
                type: "vector",
                url: "mapbox://ishah-bautista.b6msnt87"
            });

            map.addLayer({
                id: "stormLayer",
                type: "fill",
                source: "stormSource","source-layer": "Cebu-cmq2hs",
                layout: {'visibility': layerVisibility.stormLayer ? 'visible' : 'none'},
                paint: {
                    "fill-color": [
                        "match",
                        ["get", "HAZ"], 
                        1, layerColors.stormLayer[0],
                        2, layerColors.stormLayer[1],
                        3, layerColors.stormLayer[2],
                        "#9333ea"
                    ],
                    "fill-opacity": 0.4
                }
            });
        })
                
        return() => {
            map.remove();
            mapRef.current = null;
        };
    }, [center, zoom]);


    return <div ref={mapContainer} className={className}/>
}
"use client"

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

interface LayerVisibility { 
    [layerId: string]: boolean;
}

interface LayerSpecificSelected {
    [layerId: string]: string;
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
    layerSpecificSelected: LayerSpecificSelected;
}

export default function MapboxMap({
    center = [123.9427, 10.3279], //default mandaue city
    zoom = 12,
    className = 'w-full h-full overflow-hidden',
    styleUrl,
    layerVisibility,
    layerColors,
    layerSpecificSelected,
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
            const floodLayers = [
                {id: "floodLayer5Yr", source: "flood5YrSource", sourcelayer: "CebuFlood5Yr-94pdig", url: "mapbox://ishah-bautista.0dovx0j1"},
                {id: "floodLayer25Yr", source: "flood25YrSource", sourcelayer: "CebuFlood25Yr-78cmai", url: "mapbox://ishah-bautista.3vk3xhh6"},
                {id: "floodLayer100Yr", source: "flood100YrSource", sourcelayer: "Cebu100yrFlood-cieuwj", url: "mapbox://ishah-bautista.1ok5a1p3"},           
            ]
            
            floodLayers.forEach(({id, source, sourcelayer, url}) => {                
                map.addSource(source, {
                    type: "vector",
                    url: url,
                });            
    
                map.addLayer({
                    id: id,
                    type: "fill",
                    source: source,"source-layer": sourcelayer,
                    layout: {'visibility': (layerVisibility.floodLayer && layerSpecificSelected.floodLayer == id) ? 'visible' : 'none'},
                    paint: {
                        "fill-color": [
                            "match",
                            ["get", "Var"], 
                            1, layerColors.floodLayer[0],
                            2, layerColors.floodLayer[1],
                            3, layerColors.floodLayer[2],
                            "#0096C7"
                        ],
                        "fill-opacity": 0.45
                    },
                });
            })
            
            // STORM SURGE LAYER
            const stormLayers = [
                {id: "stormLayerAdv1", source: "stormLayerAdv1Source", sourcelayer: "Cebu-cmq2hs", url: "mapbox://ishah-bautista.b6msnt87"},
                {id: "stormLayerAdv2", source: "stormLayerAdv2Source", sourcelayer: "CebuStormAdv2-48ipdj", url: "mapbox://ishah-bautista.60kjmx60"},
                {id: "stormLayerAdv3", source: "stormLayerAdv3Source", sourcelayer: "CebuStormAdv3-cdzon5", url: "mapbox://ishah-bautista.5di27ycb"},           
                {id: "stormLayerAdv4", source: "stormLayerAdv4Source", sourcelayer: "CebuStormAdv4-980nqk", url: "mapbox://ishah-bautista.8nkmgnnn"},                   
            ]
            
            stormLayers.forEach(({id, source, sourcelayer, url}) => {                
                map.addSource(source, {
                    type: "vector",
                    url: url,
                });            
    
                map.addLayer({
                    id: id,
                    type: "fill",
                    source: source,"source-layer": sourcelayer,
                    layout: {'visibility': (layerVisibility.stormLayer && layerSpecificSelected.stormLayer == id) ? 'visible' : 'none'},
                    paint: {
                        "fill-color": [
                            "match",
                            ["get", "HAZ"], 
                            1, layerColors.stormLayer[0],
                            2, layerColors.stormLayer[1],
                            3, layerColors.stormLayer[2],
                            "#9333ea"
                        ],
                        "fill-opacity": 0.45
                    }
                });
            })
        })
        
        map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
        map.addControl(new mapboxgl.ScaleControl(), 'bottom-right')

        return() => {
            map.remove();
            mapRef.current = null;
        };
    }, [center, zoom]);


    return <div ref={mapContainer} className={className}/>
}
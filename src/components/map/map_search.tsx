"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, Navigation, Loader2 } from "lucide-react";
import type mapboxgl from "mapbox-gl";
import { useSearchSuggestions, type SearchSuggestion } from "@/hooks/useSearchSuggestions";

interface MapSearchBarProps {
  map: mapboxgl.Map | null;
  accessToken: string;
  onRetrieve?: (feature: {
    geometry: { type: string; coordinates: number[] };
    properties: Record<string, unknown>;
  }) => void;
}

export default function MapSearchBar({
  map,
  accessToken,
  onRetrieve,
}: MapSearchBarProps) {
  const {
    query,
    setQuery,
    suggestions,
    setSuggestions,
    isOpen,
    setIsOpen,
    isLoading,
    activeSuggestionIndex,
    setActiveSuggestionIndex,
    onQueryChange,
    retrieve,
    clear,
  } = useSearchSuggestions(accessToken);

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const mapRef = useRef<mapboxgl.Map | null>(map);
  useEffect(() => { mapRef.current = map; }, [map]);

  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopContainerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (desktopContainerRef.current && !desktopContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [setIsOpen]);

  const handleSelectSuggestion = useCallback(async (suggestion: SearchSuggestion) => {
    setQuery(suggestion.name);
    setIsOpen(false);
    setSuggestions([]);
    setIsMobileExpanded(false);

    const retrieveResult = await retrieve(suggestion);
    if (!retrieveResult) return;

    const features = retrieveResult.features;
    if (features && features.length > 0) {
      const feature = features[0] as unknown as {
        geometry: { type: string; coordinates: number[] };
        properties: Record<string, unknown>;
      };

      if (onRetrieve) {
        onRetrieve(feature);
      } else if (mapRef.current && feature.geometry.type === "Point" && feature.geometry.coordinates) {
        const [lng, lat] = feature.geometry.coordinates;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 2000 });
      }
    }
  }, [onRetrieve, retrieve, setQuery, setIsOpen, setSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((prev: number) => prev < suggestions.length - 1 ? prev + 1 : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((prev: number) => prev > 0 ? prev - 1 : suggestions.length - 1);
    } else if (e.key === "Enter" && activeSuggestionIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeSuggestionIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsMobileExpanded(false);
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case "poi": return <MapPin size={14} className="text-primary-green" />;
      default: return <Navigation size={14} className="text-neutral-400" />;
    }
  };

  const SuggestionsList = ({ isMobile = false }: { isMobile?: boolean }) => {
    if (!isOpen || suggestions.length === 0) return null;
    return (
      <div className={`bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${isMobile ? "mt-1" : "mt-2"}`}>
        {suggestions.map((s: SearchSuggestion, i: number) => (
          <button
            key={s.mapbox_id || i}
            onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all duration-150 group ${i === activeSuggestionIndex ? "bg-primary-green/10" : "hover:bg-neutral-50 active:bg-primary-green/10"} ${i !== suggestions.length - 1 ? "border-b border-neutral-100/80" : ""}`}
          >
            <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${i === activeSuggestionIndex ? "bg-primary-green/20" : "bg-neutral-100 group-hover:bg-neutral-200/60"}`}>
              {getTypeIcon(s.feature_type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-800 truncate leading-tight">{s.name}</p>
              <p className="text-[11px] text-neutral-400 font-medium truncate mt-0.5 leading-tight">{s.place_formatted || s.full_address || ""}</p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <div ref={desktopContainerRef} className="hidden lg:block relative w-full">
        <div className="relative">
          <div className="relative flex items-center bg-white/90 backdrop-blur-2xl rounded-2xl shadow-lg border border-white/60 transition-all duration-300 hover:shadow-xl focus-within:shadow-xl focus-within:bg-white/95 group">
            <div className="pl-4 pr-2 flex items-center justify-center">
              {isLoading ? <Loader2 size={16} className="text-primary-green animate-spin" /> : <Search size={16} className="text-neutral-400 group-focus-within:text-primary-green transition-colors" />}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
              placeholder="Search for a location..."
              className="flex-1 py-3 pr-2 bg-transparent text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none font-roboto"
            />
            {query && (
              <button onClick={clear} className="pr-3 pl-1 text-neutral-300 hover:text-neutral-500 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
          <SuggestionsList />
        </div>
      </div>

      <div ref={mobileContainerRef} className="lg:hidden">
        {!isMobileExpanded ? (
          <button
            onClick={() => { setIsMobileExpanded(true); setTimeout(() => mobileInputRef.current?.focus(), 100); }}
            className="flex items-center gap-2.5 bg-white/95 backdrop-blur-xl px-3.5 py-2 rounded-xl shadow-lg border border-white/30 hover:scale-105 transition-all duration-200 group active:scale-95"
          >
            <div className="w-6 h-6 rounded-lg bg-primary-green/10 flex items-center justify-center group-hover:bg-primary-green/15 transition-colors">
              <Search size={15} className="text-primary-green group-hover:rotate-12 transition-transform" />
            </div>
            <span className="font-bold text-xs text-neutral-700">Search</span>
          </button>
        ) : (
          <div className="w-[calc(100vw-7rem)] max-w-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/60 px-3 py-2">
              <div className="flex items-center justify-center w-8 shrink-0">
                {isLoading ? <Loader2 size={16} className="text-primary-green animate-spin" /> : <Search size={16} className="text-primary-green" />}
              </div>
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search for a location..."
                className="flex-1 py-1.5 bg-transparent text-sm font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none font-roboto"
              />
              <button
                onClick={() => { setIsMobileExpanded(false); setIsOpen(false); clear(); }}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {isOpen && suggestions.length > 0 && (
              <div className="mt-2 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                {suggestions.map((s: SearchSuggestion, i: number) => (
                  <button
                    key={s.mapbox_id || i}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                    onTouchEnd={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all duration-150 ${i === activeSuggestionIndex ? "bg-primary-green/10" : "active:bg-primary-green/10"} ${i !== suggestions.length - 1 ? "border-b border-neutral-100/80" : ""}`}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${i === activeSuggestionIndex ? "bg-primary-green/20" : "bg-neutral-100"}`}>
                      {getTypeIcon(s.feature_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-800 truncate leading-tight">{s.name}</p>
                      <p className="text-[11px] text-neutral-400 font-medium truncate mt-0.5 leading-tight">{s.place_formatted || s.full_address || ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { SearchBoxCore, SessionToken } from "@mapbox/search-js-core";

export interface SearchSuggestion {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
  feature_type?: string;
}

type SuggestionLike = {
  mapbox_id?: string;
  name?: string;
  full_address?: string;
  place_formatted?: string;
  feature_type?: string;
};

export function useSearchSuggestions(accessToken: string) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const searchBoxRef = useRef<SearchBoxCore | null>(null);
  const sessionTokenRef = useRef<SessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchBoxRef.current = new SearchBoxCore({ accessToken });
    sessionTokenRef.current = new SessionToken();
  }, [accessToken]);

  const handleSearch = useCallback(async (value: string) => {
    if (!searchBoxRef.current || !sessionTokenRef.current) return;
    if (value.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await searchBoxRef.current.suggest(value, {
        sessionToken: sessionTokenRef.current,
        limit: 5,
      });

      const mapped: SearchSuggestion[] = (result.suggestions || []).map(
        (s: SuggestionLike) => ({
          mapbox_id: s.mapbox_id || "",
          name: s.name || "",
          full_address: s.full_address || "",
          place_formatted: s.place_formatted || "",
          feature_type: s.feature_type || "",
        }),
      );
      setSuggestions(mapped);
      setIsOpen(mapped.length > 0);
      setActiveSuggestionIndex(-1);
    } catch (err) {
      console.error("Search suggest error:", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => handleSearch(value), 300);
    },
    [handleSearch],
  );

  const retrieve = useCallback(async (suggestion: SearchSuggestion) => {
    if (!searchBoxRef.current || !sessionTokenRef.current) return null;
    try {
      const result = await searchBoxRef.current.retrieve(suggestion as never, {
        sessionToken: sessionTokenRef.current,
      });
      sessionTokenRef.current = new SessionToken();
      return result;
    } catch (err) {
      console.error("Search retrieve error:", err);
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setActiveSuggestionIndex(-1);
  }, []);

  return {
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
  };
}

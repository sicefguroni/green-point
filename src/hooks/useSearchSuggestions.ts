import { useState, useRef, useEffect, useCallback } from "react";
import { SearchBoxCore, SessionToken } from "@mapbox/search-js-core";
import { MANDAUE_SEARCH_AREA } from "@/config/mapConfig";

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
  /** The query whose search found nothing in Mandaue, for the empty state. */
  const [noResultsFor, setNoResultsFor] = useState<string | null>(null);

  const searchBoxRef = useRef<SearchBoxCore | null>(null);
  const sessionTokenRef = useRef<SessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumped per search so a slow, older response can't overwrite a newer one. */
  const searchSeqRef = useRef(0);

  useEffect(() => {
    searchBoxRef.current = new SearchBoxCore({ accessToken });
    sessionTokenRef.current = new SessionToken();
  }, [accessToken]);

  const handleSearch = useCallback(async (value: string) => {
    if (!searchBoxRef.current || !sessionTokenRef.current) return;
    const seq = ++searchSeqRef.current;
    if (value.trim().length < 2) {
      setSuggestions([]);
      setNoResultsFor(null);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      // Search only around Mandaue: without these, "Mandaue City Hall" ranked
      // a Makati address first.
      const result = await searchBoxRef.current.suggest(value, {
        sessionToken: sessionTokenRef.current,
        limit: 5,
        proximity: MANDAUE_SEARCH_AREA.proximity,
        bbox: MANDAUE_SEARCH_AREA.bbox,
        country: MANDAUE_SEARCH_AREA.country,
      });
      if (seq !== searchSeqRef.current) return;

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
      setNoResultsFor(mapped.length === 0 ? value.trim() : null);
      setIsOpen(true);
      setActiveSuggestionIndex(-1);
    } catch (err) {
      if (seq !== searchSeqRef.current) return;
      console.error("Search suggest error:", err);
      setSuggestions([]);
      setNoResultsFor(null);
    } finally {
      if (seq === searchSeqRef.current) setIsLoading(false);
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
    searchSeqRef.current++;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsLoading(false);
    setQuery("");
    setSuggestions([]);
    setNoResultsFor(null);
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
    noResultsFor,
    onQueryChange,
    retrieve,
    clear,
  };
}

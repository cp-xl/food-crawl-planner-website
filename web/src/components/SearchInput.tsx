"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, MapPin } from "lucide-react";
import { searchPlaces } from "@/lib/api";
import { isGoogleMapsURL, parseURL } from "@/lib/parseURL";
import { fireEvent } from "@/lib/analytics";
import type { SearchResult } from "@/types/place";

interface SearchInputProps {
  onSelectPlace: (placeId: string) => void;
}

export default function SearchInput({ onSelectPlace }: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const doSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const { results: searchResults } = await searchPlaces(searchQuery);
        setResults(searchResults);
        setIsOpen(searchResults.length > 0);
        setActiveIndex(-1);
        fireEvent({
          event: "search_performed",
          searchQuery,
          suburb: searchResults[0]?.suburb,
        });
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleInputChange = (value: string) => {
    setQuery(value);

    // If it's a URL, skip dropdown — resolve directly
    if (isGoogleMapsURL(value)) {
      if (value.length > 500) return;
      setIsOpen(false);
      setResults([]);
      const parsed = parseURL(value);
      if (parsed) {
        setIsLoading(true);
        // For short links, we'd resolve via proxy — for now, search by extracted name
        searchPlaces(parsed.query)
          .then(({ results: searchResults }) => {
            if (searchResults.length > 0) {
              onSelectPlace(searchResults[0].placeId);
              setQuery("");
            }
          })
          .catch(() => {})
          .finally(() => setIsLoading(false));
      }
      return;
    }

    // Debounced search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value.trim()), 300);
  };

  const handleSelect = (placeId: string) => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    onSelectPlace(placeId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelect(results[activeIndex].placeId);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative group">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-terracotta/20 via-terracotta-muted/30 to-terracotta/20 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-100" />
        <div className="glass-card-elevated relative flex items-center rounded-2xl">
          <Search className="ml-4 size-5 shrink-0 text-stone-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            maxLength={500}
            placeholder="Search cafes and restaurants..."
            className="w-full bg-transparent py-4 pl-3 pr-4 text-stone-800 placeholder:text-stone-400 outline-none"
          />
          {isLoading && (
            <Loader2 className="mr-4 size-5 shrink-0 animate-spin text-terracotta" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="glass-card-elevated absolute z-50 mt-2 w-full overflow-hidden rounded-2xl"
          >
            {results.map((result, index) => (
              <button
                key={result.placeId}
                onClick={() => handleSelect(result.placeId)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                  index === activeIndex
                    ? "bg-terracotta-50/80"
                    : "hover:bg-stone-50/60"
                } ${index > 0 ? "border-t border-stone-100/60" : ""}`}
              >
                <MapPin
                  className={`mt-0.5 size-4 shrink-0 ${
                    index === activeIndex
                      ? "text-terracotta"
                      : "text-stone-300"
                  }`}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium text-stone-800">
                    {result.name}
                  </div>
                  <div className="truncate text-sm text-stone-400">
                    {result.suburb}
                    {result.suburb && result.address ? " · " : ""}
                    {result.address}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

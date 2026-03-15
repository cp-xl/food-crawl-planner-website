"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { MapPin, Utensils } from "lucide-react";
import SearchInput from "@/components/SearchInput";
import PlaceCard from "@/components/PlaceCard";
import CrawlList from "@/components/CrawlList";
import { getPlaceDetails } from "@/lib/api";
import { fireEvent } from "@/lib/analytics";
import { purgeStaleCache } from "@/lib/cache";
import { getSessionId } from "@/lib/session";
import type { PlaceCard as PlaceCardType } from "@/types/place";

const MAX_CRAWL = 8;

export default function Home() {
  const [selectedPlace, setSelectedPlace] = useState<PlaceCardType | null>(
    null
  );
  const [crawlList, setCrawlList] = useState<PlaceCardType[]>([]);
  const [isLoadingPlace, setIsLoadingPlace] = useState(false);

  // Initialize session and purge stale cache on mount
  useEffect(() => {
    getSessionId();
    purgeStaleCache();
  }, []);

  const handleSelectPlace = useCallback(async (placeId: string) => {
    setIsLoadingPlace(true);
    try {
      const place = await getPlaceDetails(placeId);
      setSelectedPlace(place);
    } catch {
      toast.error("Failed to load place details. Please try again.");
    } finally {
      setIsLoadingPlace(false);
    }
  }, []);

  const handleAddToCrawl = useCallback(
    (place: PlaceCardType) => {
      if (crawlList.length >= MAX_CRAWL) {
        toast.error(`Maximum ${MAX_CRAWL} spots per crawl.`);
        return;
      }
      if (crawlList.some((p) => p.placeId === place.placeId)) return;

      setCrawlList((prev) => [...prev, place]);
      fireEvent({ event: "place_added", suburb: place.suburb });
    },
    [crawlList]
  );

  const handleRemove = useCallback((placeId: string) => {
    setCrawlList((prev) => prev.filter((p) => p.placeId !== placeId));
  }, []);

  const handleReorder = useCallback(
    (oldIndex: number, newIndex: number) => {
      setCrawlList((prev) => arrayMove(prev, oldIndex, newIndex));
    },
    []
  );

  const hasStarted = selectedPlace !== null || crawlList.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Warm gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50/40" />
        {/* Decorative gradient orbs */}
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-terracotta/[0.04] blur-3xl" />
        <div className="absolute top-1/3 -left-60 h-[600px] w-[600px] rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-[400px] w-[400px] rounded-full bg-terracotta-muted/20 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="glass-card sticky top-0 z-40 border-b border-white/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-terracotta shadow-sm">
              <Utensils className="size-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-stone-800">
              Food Crawl
            </span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-terracotta-50/80 px-3 py-1 sm:flex">
            <MapPin className="size-3.5 text-terracotta" />
            <span className="text-xs font-medium text-terracotta-dark">
              Melbourne &amp; Sydney
            </span>
          </div>
        </div>
      </nav>

      {/* Hero — visible before user starts searching */}
      <AnimatePresence>
        {!hasStarted && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-2xl px-6 pt-20 pb-4 text-center"
          >
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-bold tracking-tight text-stone-800 sm:text-5xl"
            >
              Plan your perfect{" "}
              <span className="bg-gradient-to-r from-terracotta to-terracotta-light bg-clip-text text-transparent">
                food crawl
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-4 text-lg text-stone-500"
            >
              Search for cafes and restaurants, build your list, and get the
              best route to hit them all.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search bar — hero-centered before interaction, docked top-left after */}
      <div
        className={`mx-auto transition-all duration-500 ${
          hasStarted
            ? "max-w-6xl px-6 pt-6"
            : "max-w-xl px-6 pt-4 pb-8"
        }`}
      >
        {!hasStarted ? (
          <SearchInput onSelectPlace={handleSelectPlace} />
        ) : null}
      </div>

      {/* Workspace — appears once user has started */}
      {hasStarted && (
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-6xl px-6 pb-16"
        >
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Left Panel — Search + Result Card */}
            <div className="w-full shrink-0 lg:w-[400px]">
              <div className="sticky top-20 flex flex-col gap-5">
                <SearchInput onSelectPlace={handleSelectPlace} />

                <AnimatePresence mode="wait">
                  {isLoadingPlace && (
                    <motion.div
                      key="loader"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="glass-card flex items-center justify-center rounded-2xl py-16"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div className="size-7 animate-spin rounded-full border-[2.5px] border-terracotta-muted border-t-terracotta" />
                        <span className="text-sm text-stone-400">
                          Loading place details...
                        </span>
                      </div>
                    </motion.div>
                  )}

                  {selectedPlace && !isLoadingPlace && (
                    <PlaceCard
                      key={selectedPlace.placeId}
                      place={selectedPlace}
                      onAdd={handleAddToCrawl}
                      isInCrawl={crawlList.some(
                        (p) => p.placeId === selectedPlace.placeId
                      )}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Panel — Crawl List */}
            <div className="flex-1 lg:pt-0">
              <div className="glass-card-elevated rounded-2xl p-5">
                <CrawlList
                  items={crawlList}
                  onRemove={handleRemove}
                  onReorder={handleReorder}
                />
              </div>
            </div>
          </div>
        </motion.main>
      )}

      {/* Footer — subtle, only on hero state */}
      {!hasStarted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="fixed bottom-6 left-0 right-0 text-center"
        >
          <p className="text-xs text-stone-400">
            Search a name, or paste a Google Maps link to get started
          </p>
        </motion.div>
      )}
    </div>
  );
}

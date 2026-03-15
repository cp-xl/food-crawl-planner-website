"use client";

import { motion } from "framer-motion";
import { Star, Clock, Plus, Check, UtensilsCrossed } from "lucide-react";
import type { PlaceCard as PlaceCardType } from "@/types/place";

interface PlaceCardProps {
  place: PlaceCardType;
  onAdd: (place: PlaceCardType) => void;
  isInCrawl: boolean;
}

function PriceDots({ level }: { level: number }) {
  return (
    <span className="text-sm tracking-wide">
      {Array.from({ length: 4 }, (_, i) => (
        <span
          key={i}
          className={i < level ? "text-stone-600" : "text-stone-300"}
        >
          $
        </span>
      ))}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`size-3.5 ${
              i < full
                ? "fill-terracotta text-terracotta"
                : i === full && hasHalf
                  ? "fill-terracotta/50 text-terracotta"
                  : "fill-stone-200 text-stone-200"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-stone-600">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

export default function PlaceCard({ place, onAdd, isInCrawl }: PlaceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="glass-card-elevated overflow-hidden rounded-2xl"
    >
      {/* Photo with gradient overlay */}
      <div className="relative h-48 w-full overflow-hidden">
        {place.photoUrl ? (
          <>
            <img
              src={place.photoUrl}
              alt={place.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-terracotta-muted to-terracotta-50">
            <UtensilsCrossed className="size-12 text-white/80" />
          </div>
        )}
        {place.sponsored && (
          <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-terracotta shadow-sm backdrop-blur-sm">
            Featured
          </span>
        )}
        {/* Open/closed badge on photo */}
        <div className="absolute bottom-3 left-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-sm ${
              place.isOpenNow
                ? "bg-green-500/90 text-white"
                : "bg-white/90 text-stone-600"
            }`}
          >
            <Clock className="size-3" />
            {place.isOpenNow ? "Open now" : "Closed"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-stone-800">
              {place.name}
            </h3>
            <p className="mt-0.5 text-sm text-stone-400">{place.suburb}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <StarRating rating={place.rating} />
          {place.priceLevel > 0 && <PriceDots level={place.priceLevel} />}
        </div>

        <button
          onClick={() => onAdd(place)}
          disabled={isInCrawl}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
            isInCrawl
              ? "bg-green-50 text-green-600 ring-1 ring-green-200"
              : "bg-terracotta text-white shadow-md shadow-terracotta/20 hover:bg-terracotta-light hover:shadow-lg hover:shadow-terracotta/25 active:scale-[0.98]"
          }`}
        >
          {isInCrawl ? (
            <>
              <Check className="size-4" />
              Added to crawl
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Add to crawl
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

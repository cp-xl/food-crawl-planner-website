"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, MapPin, Star, Utensils } from "lucide-react";
import type { PlaceCard } from "@/types/place";

interface CrawlListProps {
  items: PlaceCard[];
  onRemove: (placeId: string) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
}

function SortableItem({
  place,
  index,
  onRemove,
}: {
  place: PlaceCard;
  index: number;
  onRemove: (placeId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: place.placeId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ duration: 0.15 }}
      layout
      className={`glass-card group flex items-center gap-3 rounded-xl p-3 transition-shadow ${
        isDragging ? "z-50 shadow-lg shadow-stone-200/50" : "hover:shadow-md hover:shadow-stone-200/30"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-stone-300 transition-colors hover:text-stone-500 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-terracotta to-terracotta-light text-xs font-bold text-white shadow-sm shadow-terracotta/20">
        {index + 1}
      </div>

      {/* Thumbnail */}
      <div className="size-10 shrink-0 overflow-hidden rounded-lg">
        {place.photoUrl ? (
          <img
            src={place.photoUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-terracotta-50">
            <Utensils className="size-4 text-terracotta-muted" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-stone-800">
          {place.name}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs text-stone-400">
            {place.suburb}
          </span>
          {place.rating > 0 && (
            <>
              <span className="text-stone-300">·</span>
              <Star className="size-3 fill-terracotta text-terracotta" />
              <span className="text-xs text-stone-500">
                {place.rating.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={() => onRemove(place.placeId)}
        className="shrink-0 rounded-lg p-1.5 text-stone-300 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

export default function CrawlList({
  items,
  onRemove,
  onReorder,
}: CrawlListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.placeId === active.id);
    const newIndex = items.findIndex((i) => i.placeId === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-800">
          <MapPin className="size-5 text-terracotta" />
          Your Crawl
        </h2>
        {items.length > 0 && (
          <span className="rounded-full bg-terracotta-50 px-2.5 py-0.5 text-xs font-medium text-terracotta">
            {items.length}/{MAX_ITEMS} spots
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-200/60 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-terracotta-50">
            <Utensils className="size-5 text-terracotta-muted" />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-500">
              No spots yet
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              Search for cafes and restaurants to build your crawl
            </p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.placeId)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              {items.map((place, index) => (
                <SortableItem
                  key={place.placeId}
                  place={place}
                  index={index}
                  onRemove={onRemove}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

const MAX_ITEMS = 8;

export interface PlaceCard {
  placeId: string;
  name: string;
  suburb: string;
  address: string;
  rating: number;
  priceLevel: number; // 1–4
  isOpenNow: boolean;
  photoUrl: string | null;
  lat: number;
  lng: number;
  sponsored: boolean; // always false for now — renders "Featured" badge when true
}

export interface SearchResult {
  placeId: string;
  name: string;
  suburb: string;
  address: string;
}

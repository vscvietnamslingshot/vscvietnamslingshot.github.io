import { DistanceConfig, Athlete, MatchHistoryItem, StoredAthleteList } from "./types";

export const DEFAULT_DISTANCES: DistanceConfig[] = [
  { id: "d1", distance: "10 Met", multiplier: 10 },
  { id: "d2", distance: "15 Met", multiplier: 15 },
];

export const DEFAULT_SHOTS_COUNT = 10;

export const DEFAULT_ATHLETES: Athlete[] = [];

export const DEFAULT_HISTORY: MatchHistoryItem[] = [];

export const DEFAULT_STORED_LISTS: StoredAthleteList[] = [];


import type { BookLevelKey, NormalizationKey, OverlayKey } from "./types";

export const DEFAULT_MAX_VISIBLE_QUOTE_POINTS = 4000;
export const DEFAULT_MIN_VOLUME_THRESHOLD = 0;

export const INDICATOR_OPTIONS: Array<{ label: string; value: OverlayKey }> = [
  { label: "Mid Price", value: "midPrice" },
  { label: "Wall Mid", value: "wallMid" },
  { label: "Micro Price", value: "microPrice" },
  { label: "Spread", value: "spread" },
  { label: "Bid Depth Sum", value: "bidDepth" },
  { label: "Ask Depth Sum", value: "askDepth" },
];

export const BOOK_LEVEL_OPTIONS: Array<{ label: string; value: BookLevelKey }> = [
  { label: "Bid 1", value: "bid1" },
  { label: "Bid 2", value: "bid2" },
  { label: "Bid 3", value: "bid3" },
  { label: "Ask 1", value: "ask1" },
  { label: "Ask 2", value: "ask2" },
  { label: "Ask 3", value: "ask3" },
];

export const NORMALIZATION_OPTIONS: Array<{
  label: string;
  value: NormalizationKey;
}> = [
  { label: "Raw prices", value: "none" },
  { label: "Mid Price", value: "midPrice" },
  { label: "Wall Mid", value: "wallMid" },
  { label: "Micro Price", value: "microPrice" },
  { label: "Best Bid", value: "bestBid" },
  { label: "Best Ask", value: "bestAsk" },
];

export const TRADER_GROUPS: Record<string, string[]> = {};

export const LOG_OVERLAY_COLORS = [
  "#e7f0ff",
  "#ffd8c5",
  "#97ecd4",
  "#f5cf8b",
  "#c9b9ef",
  "#8bd1ff",
];

export const COLORS = {
  askDots: "#d4837a",
  askLine: "rgba(255, 216, 190, 0.72)",
  bidDots: "#679cc4",
  bidLine: "rgba(176, 223, 255, 0.72)",
  bookLevels: {
    ask1: "#ff9c8f",
    ask2: "#e26457",
    ask3: "#b74c47",
    bid1: "#8dc7f3",
    bid2: "#4d91dd",
    bid3: "#2f6bad",
  } satisfies Record<BookLevelKey, string>,
  bookLevelMarkers: {
    ask1: "#ffd2cb",
    bid1: "#d6efff",
  } satisfies Partial<Record<BookLevelKey, string>>,
  grid: "rgba(158, 184, 214, 0.13)",
  indicator: {
    askDepth: "#e4b071",
    bestAsk: "#ffd0b7",
    bestBid: "#c2e3ff",
    bidDepth: "#79cdbc",
    microPrice: "#86dcc7",
    midPrice: "rgba(214, 226, 239, 0.78)",
    spread: "#c7b6eb",
    wallMid: "rgba(125, 193, 181, 0.74)",
  },
  ownTrade: "#f1bf72",
  pnl: "#8ed9c0",
  position: "#bca7e6",
  publicBuyTrade: "#88c9f4",
  publicSellTrade: "#ff8d7a",
  publicUnknownTrade: "#9aa9b9",
};

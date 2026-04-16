import { create } from "zustand";
import {
  DEFAULT_MAX_VISIBLE_QUOTE_POINTS,
  DEFAULT_MIN_VOLUME_THRESHOLD,
} from "../lib/constants";
import {
  EMPTY_DATASET,
  mergeImportedBatch,
  removeImportedFilesFromDataset,
} from "../lib/csv";
import type {
  BookLevelKey,
  ImportedDataset,
  NormalizationKey,
  OverlayKey,
} from "../lib/types";

interface DashboardState extends ImportedDataset {
  addImportedBatch: (batch: ImportedDataset) => void;
  selectedBookLevels: BookLevelKey[];
  clearAllData: () => void;
  removeImportedFiles: (fileIds: string[], nextSelectedFileIds?: string[]) => void;
  hoveredTimestamp: number | null;
  maxVisibleQuotePoints: number;
  minVolumeThreshold: number;
  normalization: NormalizationKey;
  quantityRange: [number, number];
  selectedDays: number[];
  selectedFileIds: string[];
  selectedIndicators: OverlayKey[];
  selectedLogIndicators: string[];
  selectedProduct: string | null;
  setHoveredTimestamp: (timestamp: number | null) => void;
  setMaxVisibleQuotePoints: (points: number) => void;
  setMinVolumeThreshold: (value: number) => void;
  setNormalization: (value: NormalizationKey) => void;
  setQuantityRange: (range: [number, number]) => void;
  setSelectedDays: (days: number[]) => void;
  setSelectedFileIds: (fileIds: string[]) => void;
  setSelectedBookLevels: (levels: BookLevelKey[]) => void;
  setSelectedIndicators: (indicators: OverlayKey[]) => void;
  setSelectedLogIndicators: (indicators: string[]) => void;
  setSelectedProduct: (product: string | null) => void;
  setShowBestAskLine: (value: boolean) => void;
  setShowBestBidLine: (value: boolean) => void;
  setShowBookLevelCircles: (value: boolean) => void;
  setShowOrderBook: (value: boolean) => void;
  setShowOwnTrades: (value: boolean) => void;
  setShowPublicTrades: (value: boolean) => void;
  setVisibleRange: (range: [number, number] | null) => void;
  showBestAskLine: boolean;
  showBestBidLine: boolean;
  showBookLevelCircles: boolean;
  showOrderBook: boolean;
  showOwnTrades: boolean;
  showPublicTrades: boolean;
  visibleRange: [number, number] | null;
}

function rangesEqual(
  left: [number, number] | null,
  right: [number, number] | null,
) {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return left[0] === right[0] && left[1] === right[1];
}

function clampRange(
  range: [number, number],
  extent: [number, number],
): [number, number] {
  const orderedLower = Math.min(range[0], range[1]);
  const orderedUpper = Math.max(range[0], range[1]);
  const lower = Math.max(extent[0], orderedLower);
  const upper = Math.min(extent[1], orderedUpper);
  return lower <= upper ? [lower, upper] : extent;
}

function pickDefaultDay(days: number[]) {
  if (days.length === 0) {
    return [];
  }

  if (days.includes(0)) {
    return [0];
  }

  return [days[0]];
}

function pickPersistedOrDefaultDay(days: number[], selectedDays: number[]) {
  const currentDay = selectedDays[0];
  if (currentDay !== undefined && days.includes(currentDay)) {
    return [currentDay];
  }

  return pickDefaultDay(days);
}

const INITIAL_EXTENT: [number, number] = [0, 10];
const DEFAULT_BOOK_LEVELS: BookLevelKey[] = ["bid1", "ask1"];

export const useDashboardStore = create<DashboardState>((set) => ({
  ...EMPTY_DATASET,
  addImportedBatch(batch) {
    set((state) => {
      const merged = mergeImportedBatch(state, batch);
      const nextProduct =
        state.selectedProduct !== null && merged.products.includes(state.selectedProduct)
          ? state.selectedProduct
          : (merged.products[0] ?? null);

      const extent = merged.quantityExtent.length === 2 ? merged.quantityExtent : INITIAL_EXTENT;
      const quantityRange =
        state.tradeRecords.length === 0 ? extent : clampRange(state.quantityRange, extent);

      return {
        ...merged,
        hoveredTimestamp: null,
        quantityRange,
        selectedDays: pickDefaultDay(merged.days),
        selectedFileIds: merged.fileSummaries
          .filter((summary) => summary.kind !== "unknown")
          .map((summary) => summary.fileId),
        selectedLogIndicators: state.selectedLogIndicators.filter((indicator) =>
          merged.logNumericKeys.includes(indicator),
        ),
        selectedProduct: nextProduct,
        visibleRange: null,
      };
    });
  },
  clearAllData() {
    set(() => ({
      ...EMPTY_DATASET,
      hoveredTimestamp: null,
      maxVisibleQuotePoints: DEFAULT_MAX_VISIBLE_QUOTE_POINTS,
      minVolumeThreshold: DEFAULT_MIN_VOLUME_THRESHOLD,
      normalization: "none",
      quantityRange: INITIAL_EXTENT,
      selectedBookLevels: DEFAULT_BOOK_LEVELS,
      selectedDays: [],
      selectedFileIds: [],
      selectedIndicators: ["midPrice"],
      selectedLogIndicators: [],
      selectedProduct: null,
      showBestAskLine: true,
      showBestBidLine: true,
      showBookLevelCircles: false,
      showOrderBook: true,
      showOwnTrades: true,
      showPublicTrades: true,
      visibleRange: null,
    }));
  },
  removeImportedFiles(fileIds, nextSelectedFileIds) {
    set((state) => {
      const remaining = removeImportedFilesFromDataset(state, fileIds);
      const nextProduct =
        state.selectedProduct !== null && remaining.products.includes(state.selectedProduct)
          ? state.selectedProduct
          : (remaining.products[0] ?? null);
      const extent = remaining.quantityExtent.length === 2 ? remaining.quantityExtent : INITIAL_EXTENT;
      const quantityRange =
        remaining.tradeRecords.length === 0 ? extent : clampRange(state.quantityRange, extent);
      const validFileIds = new Set(
        remaining.fileSummaries
          .filter((summary) => summary.kind !== "unknown")
          .map((summary) => summary.fileId),
      );
      const retainedSelection =
        nextSelectedFileIds?.filter((fileId) => validFileIds.has(fileId)) ??
        state.selectedFileIds.filter((fileId) => validFileIds.has(fileId));

      return {
        ...remaining,
        hoveredTimestamp: null,
        quantityRange,
        selectedDays: pickPersistedOrDefaultDay(remaining.days, state.selectedDays),
        selectedFileIds:
          retainedSelection.length > 0 ? retainedSelection : Array.from(validFileIds),
        selectedLogIndicators: state.selectedLogIndicators.filter((indicator) =>
          remaining.logNumericKeys.includes(indicator),
        ),
        selectedProduct: nextProduct,
        visibleRange: null,
      };
    });
  },
  hoveredTimestamp: null,
  maxVisibleQuotePoints: DEFAULT_MAX_VISIBLE_QUOTE_POINTS,
  minVolumeThreshold: DEFAULT_MIN_VOLUME_THRESHOLD,
  normalization: "none",
  quantityRange: INITIAL_EXTENT,
  selectedBookLevels: DEFAULT_BOOK_LEVELS,
  selectedDays: [],
  selectedFileIds: [],
  selectedIndicators: ["midPrice"],
  selectedLogIndicators: [],
  selectedProduct: null,
  setHoveredTimestamp(timestamp) {
    set((state) =>
      state.hoveredTimestamp === timestamp ? state : { hoveredTimestamp: timestamp },
    );
  },
  setMaxVisibleQuotePoints(points) {
    set(() => ({ maxVisibleQuotePoints: points }));
  },
  setMinVolumeThreshold(value) {
    set(() => ({ minVolumeThreshold: value }));
  },
  setNormalization(value) {
    set(() => ({ normalization: value }));
  },
  setQuantityRange(range) {
    set((state) => ({ quantityRange: clampRange(range, state.quantityExtent) }));
  },
  setSelectedDays(days) {
    set(() => ({
      hoveredTimestamp: null,
      selectedDays: days.length > 0 ? [days[0]] : [],
      visibleRange: null,
    }));
  },
  setSelectedFileIds(fileIds) {
    set(() => ({ hoveredTimestamp: null, selectedFileIds: fileIds, visibleRange: null }));
  },
  setSelectedBookLevels(levels) {
    set(() => ({ selectedBookLevels: levels }));
  },
  setSelectedIndicators(indicators) {
    set(() => ({ selectedIndicators: indicators }));
  },
  setSelectedLogIndicators(indicators) {
    set(() => ({ selectedLogIndicators: indicators }));
  },
  setSelectedProduct(product) {
    set(() => ({ hoveredTimestamp: null, selectedProduct: product, visibleRange: null }));
  },
  setShowBestAskLine(value) {
    set(() => ({ showBestAskLine: value }));
  },
  setShowBestBidLine(value) {
    set(() => ({ showBestBidLine: value }));
  },
  setShowBookLevelCircles(value) {
    set(() => ({ showBookLevelCircles: value }));
  },
  setShowOrderBook(value) {
    set(() => ({ showOrderBook: value }));
  },
  setShowOwnTrades(value) {
    set(() => ({ showOwnTrades: value }));
  },
  setShowPublicTrades(value) {
    set(() => ({ showPublicTrades: value }));
  },
  setVisibleRange(range) {
    set((state) => (rangesEqual(state.visibleRange, range) ? state : { visibleRange: range }));
  },
  showBestAskLine: true,
  showBestBidLine: true,
  showBookLevelCircles: false,
  showOrderBook: true,
  showOwnTrades: true,
  showPublicTrades: true,
  visibleRange: null,
}));


import type {
  ClassifiedTrade,
  LogRecord,
  MetricPoint,
  NormalizationKey,
  OverlayKey,
  PriceSnapshot,
  TimeFilter,
  TradeClassification,
  TradeRecord,
} from "./types";

interface TimestampedRecord {
  timestamp: number;
}

const PRICE_LIKE_LOG_KEYWORDS = [
  "ask",
  "bid",
  "edge",
  "fair",
  "mid",
  "premium",
  "price",
  "spread",
  "value",
  "wall",
];

const NON_PRICE_LIKE_LOG_KEYWORDS = [
  "buy_levels",
  "capacity",
  "count",
  "max_buy",
  "max_sell",
  "order_count",
  "position",
  "quantity",
  "result",
  "sell_levels",
];

function inSelectedFiles(fileId: string, selectedFileIds: string[]) {
  return selectedFileIds.length === 0 || selectedFileIds.includes(fileId);
}

function inSelectedDays(day: number | null, selectedDays: number[]) {
  if (selectedDays.length === 0) {
    return true;
  }

  return day !== null && selectedDays.includes(day);
}

export function filterSnapshots(
  snapshots: PriceSnapshot[],
  { selectedProduct, selectedFileIds, selectedDays }: Omit<TimeFilter, "knownProducts">,
) {
  return snapshots.filter(
    (snapshot) =>
      (selectedProduct === null || snapshot.product === selectedProduct) &&
      inSelectedFiles(snapshot.fileId, selectedFileIds) &&
      inSelectedDays(snapshot.day, selectedDays),
  );
}

export function filterTrades(trades: TradeRecord[], filter: TimeFilter) {
  return trades.filter(
    (trade) =>
      filter.knownProducts.includes(trade.symbol) &&
      (filter.selectedProduct === null || trade.symbol === filter.selectedProduct) &&
      inSelectedFiles(trade.fileId, filter.selectedFileIds) &&
      inSelectedDays(trade.day, filter.selectedDays),
  );
}

export function filterLogs(logs: LogRecord[], filter: Omit<TimeFilter, "knownProducts">) {
  return logs.filter(
    (record) =>
      (filter.selectedProduct === null || record.product === filter.selectedProduct) &&
      inSelectedFiles(record.fileId, filter.selectedFileIds) &&
      inSelectedDays(record.day, filter.selectedDays),
  );
}

export function getMetricValue(snapshot: PriceSnapshot, key: OverlayKey | NormalizationKey) {
  switch (key) {
    case "bestAsk":
      return snapshot.bestAsk;
    case "bestBid":
      return snapshot.bestBid;
    case "midPrice":
      return snapshot.midPrice;
    case "microPrice":
      return snapshot.microPrice;
    case "spread":
      return snapshot.spread;
    case "wallMid":
      return snapshot.wallMid;
    case "bidDepth":
      return snapshot.bidDepthSum;
    case "askDepth":
      return snapshot.askDepthSum;
    case "none":
      return null;
    default:
      return null;
  }
}

export function normalizeAgainst(
  value: number | null,
  snapshot: PriceSnapshot,
  normalization: NormalizationKey,
) {
  if (value === null) {
    return null;
  }

  if (normalization === "none") {
    return value;
  }

  const baseline = getMetricValue(snapshot, normalization);
  return baseline === null ? null : value - baseline;
}

function findSnapshotIndexAtOrBefore(snapshots: PriceSnapshot[], timestamp: number) {
  let left = 0;
  let right = snapshots.length - 1;
  let answer = -1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const snapshot = snapshots[middle];

    if (snapshot.timestamp <= timestamp) {
      answer = middle;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return answer;
}

function findNearestTimestampIndex<T extends TimestampedRecord>(
  records: T[],
  timestamp: number,
) {
  if (records.length === 0) {
    return -1;
  }

  const atOrBeforeIndex = findLastTimestampIndexAtOrBefore(records, timestamp);
  if (atOrBeforeIndex < 0) {
    return 0;
  }

  if (atOrBeforeIndex === records.length - 1) {
    return atOrBeforeIndex;
  }

  const current = records[atOrBeforeIndex];
  const next = records[atOrBeforeIndex + 1];
  return Math.abs(current.timestamp - timestamp) <= Math.abs(next.timestamp - timestamp)
    ? atOrBeforeIndex
    : atOrBeforeIndex + 1;
}

function findFirstTimestampIndexAtOrAfter<T extends TimestampedRecord>(
  records: T[],
  timestamp: number,
) {
  let left = 0;
  let right = records.length - 1;
  let answer = records.length;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const record = records[middle];

    if (record.timestamp >= timestamp) {
      answer = middle;
      right = middle - 1;
    } else {
      left = middle + 1;
    }
  }

  return answer;
}

function findLastTimestampIndexAtOrBefore<T extends TimestampedRecord>(
  records: T[],
  timestamp: number,
) {
  let left = 0;
  let right = records.length - 1;
  let answer = -1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const record = records[middle];

    if (record.timestamp <= timestamp) {
      answer = middle;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return answer;
}

function inferTradeClassification(
  trade: TradeRecord,
  referenceSnapshot: PriceSnapshot | null,
): TradeClassification {
  if (trade.ownSide === "buy") {
    return "own-buy";
  }

  if (trade.ownSide === "sell") {
    return "own-sell";
  }

  if (referenceSnapshot === null) {
    return "unknown";
  }

  if (referenceSnapshot.bestAsk !== null && trade.price >= referenceSnapshot.bestAsk) {
    return "buy-aggressor";
  }

  if (referenceSnapshot.bestBid !== null && trade.price <= referenceSnapshot.bestBid) {
    return "sell-aggressor";
  }

  if (referenceSnapshot.bestBid !== null && referenceSnapshot.bestAsk !== null) {
    const midpoint = (referenceSnapshot.bestBid + referenceSnapshot.bestAsk) / 2;
    if (trade.price > midpoint) {
      return "buy-aggressor";
    }
    if (trade.price < midpoint) {
      return "sell-aggressor";
    }
  }

  return "unknown";
}

export function classifyTrades(
  trades: TradeRecord[],
  snapshots: PriceSnapshot[],
): ClassifiedTrade[] {
  return trades.map((trade) => {
    const snapshotIndex = findSnapshotIndexAtOrBefore(snapshots, trade.timestamp);
    const referenceSnapshot = snapshotIndex >= 0 ? snapshots[snapshotIndex] : null;
    return {
      ...trade,
      classification: inferTradeClassification(trade, referenceSnapshot),
    };
  });
}

export function applyVisibleRange<T extends { timestamp: number }>(
  records: T[],
  range: [number, number] | null,
) {
  if (range === null) {
    return records;
  }

  return records.filter(
    (record) => record.timestamp >= range[0] && record.timestamp <= range[1],
  );
}

export function downsampleSnapshots(
  snapshots: PriceSnapshot[],
  maxVisibleQuotePoints: number,
  minVolumeThreshold: number,
) {
  const totalVisiblePoints = snapshots.reduce((sum, snapshot) => {
    const bidCount = snapshot.bids.filter((level) => level.volume >= minVolumeThreshold).length;
    const askCount = snapshot.asks.filter((level) => level.volume >= minVolumeThreshold).length;
    return sum + bidCount + askCount;
  }, 0);

  if (totalVisiblePoints <= maxVisibleQuotePoints) {
    return snapshots;
  }

  const snapshotStride = Math.max(
    1,
    Math.ceil(totalVisiblePoints / maxVisibleQuotePoints),
  );

  return snapshots.filter((_, index) => index % snapshotStride === 0);
}

export function buildPnlSeries(snapshots: PriceSnapshot[]) {
  const points = snapshots
    .filter((snapshot) => snapshot.profitAndLoss !== null)
    .map(
      (snapshot) =>
        ({
          timestamp: snapshot.timestamp,
          value: snapshot.profitAndLoss ?? 0,
        }) satisfies MetricPoint,
    );

  return {
    isAllZero: points.length > 0 && points.every((point) => point.value === 0),
    points,
  };
}

export function buildPositionSeries(trades: TradeRecord[]) {
  let runningPosition = 0;

  const points = trades
    .filter((trade) => trade.ownSide !== null)
    .map((trade) => {
      runningPosition += trade.ownSide === "buy" ? trade.quantity : -trade.quantity;
      return {
        timestamp: trade.timestamp,
        value: runningPosition,
      } satisfies MetricPoint;
    });

  return {
    hasData: points.length > 0,
    points,
  };
}

export function findNearestSnapshot(
  snapshots: PriceSnapshot[],
  timestamp: number | null,
) {
  if (timestamp === null || snapshots.length === 0) {
    return null;
  }

  const nearestIndex = findNearestTimestampIndex(snapshots, timestamp);
  return nearestIndex >= 0 ? snapshots[nearestIndex] : null;
}

export function findNearestLogRecord(logs: LogRecord[], timestamp: number | null) {
  if (timestamp === null || logs.length === 0) {
    return null;
  }

  const nearestIndex = findNearestTimestampIndex(logs, timestamp);
  return nearestIndex >= 0 ? logs[nearestIndex] : null;
}

export function buildLogIndicatorSeries(logs: LogRecord[], indicator: string) {
  return logs.flatMap((record) => {
    const value = record.numericValues[indicator];
    if (value === undefined || !Number.isFinite(value)) {
      return [];
    }

    return [
      {
        timestamp: record.timestamp,
        value,
      } satisfies MetricPoint,
    ];
  });
}

export function isPriceLikeLogIndicator(indicator: string) {
  const normalized = indicator.toLowerCase();

  if (NON_PRICE_LIKE_LOG_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return false;
  }

  return PRICE_LIKE_LOG_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function findTradesAtTimestamp(
  trades: ClassifiedTrade[],
  timestamp: number | null,
) {
  if (timestamp === null || trades.length === 0) {
    return [];
  }

  const startIndex = findFirstTimestampIndexAtOrAfter(trades, timestamp);
  if (startIndex >= trades.length || trades[startIndex].timestamp !== timestamp) {
    return [];
  }

  const endIndex = findLastTimestampIndexAtOrBefore(trades, timestamp);
  return trades.slice(startIndex, endIndex + 1);
}

export function findNearestPoint(points: MetricPoint[], timestamp: number | null) {
  if (timestamp === null || points.length === 0) {
    return null;
  }

  const nearestIndex = findNearestTimestampIndex(points, timestamp);
  return nearestIndex >= 0 ? points[nearestIndex] : null;
}

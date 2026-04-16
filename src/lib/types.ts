export type OverlayKey =
  | "midPrice"
  | "wallMid"
  | "microPrice"
  | "spread"
  | "bestBid"
  | "bestAsk"
  | "bidDepth"
  | "askDepth";

export type BookLevelKey =
  | "bid1"
  | "bid2"
  | "bid3"
  | "ask1"
  | "ask2"
  | "ask3";

export type NormalizationKey =
  | "none"
  | "midPrice"
  | "wallMid"
  | "microPrice"
  | "bestBid"
  | "bestAsk";

export type FileKind = "prices" | "trades" | "log" | "unknown";

export type TradeClassification =
  | "buy-aggressor"
  | "sell-aggressor"
  | "unknown"
  | "own-buy"
  | "own-sell";

export interface QuoteLevel {
  side: "bid" | "ask";
  level: number;
  price: number;
  volume: number;
}

export interface PriceSnapshot {
  asks: QuoteLevel[];
  askDepthSum: number;
  bestAsk: number | null;
  bestAskVolume: number | null;
  bestBid: number | null;
  bestBidVolume: number | null;
  bidDepthSum: number;
  bids: QuoteLevel[];
  day: number | null;
  fileId: string;
  id: string;
  midPrice: number | null;
  microPrice: number | null;
  product: string;
  profitAndLoss: number | null;
  sourceFile: string;
  spread: number | null;
  timestamp: number;
  wallMid: number | null;
}

export interface TradeRecord {
  buyer: string | null;
  currency: string | null;
  day: number | null;
  fileId: string;
  id: string;
  ownSide: "buy" | "sell" | null;
  price: number;
  quantity: number;
  seller: string | null;
  sourceFile: string;
  symbol: string;
  timestamp: number;
}

export interface ClassifiedTrade extends TradeRecord {
  classification: TradeClassification;
}

export interface FileSummary {
  dayValues: number[];
  fileId: string;
  fileName: string;
  hasOwnTrades: boolean;
  hasTraderIds: boolean;
  kind: FileKind;
  parseWarnings: string[];
  products: string[];
  rowCount: number;
  warnings: string[];
}

export type LogScalar = boolean | number | string | null;

export interface LogOrder {
  price: number;
  quantity: number;
  side: string;
}

export interface LogRecord {
  day: number | null;
  fileId: string;
  flatValues: Record<string, LogScalar>;
  id: string;
  numericValues: Record<string, number>;
  orders: LogOrder[];
  product: string | null;
  rawLambdaLog: string;
  rawSandboxLog: string | null;
  skipReason: string | null;
  sourceFile: string;
  timestamp: number;
}

export interface ImportedDataset {
  days: number[];
  fileSummaries: FileSummary[];
  logNumericKeys: string[];
  logRecords: LogRecord[];
  priceSnapshots: PriceSnapshot[];
  products: string[];
  quantityExtent: [number, number];
  tradeRecords: TradeRecord[];
  warnings: string[];
}

export interface MetricPoint {
  timestamp: number;
  value: number;
}

export interface TimeFilter {
  knownProducts: string[];
  selectedDays: number[];
  selectedFileIds: string[];
  selectedProduct: string | null;
}

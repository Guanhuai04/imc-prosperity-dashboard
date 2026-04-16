import Papa from "papaparse";
import { DEFAULT_MAX_VISIBLE_QUOTE_POINTS } from "./constants";
import type {
  FileKind,
  FileSummary,
  ImportedDataset,
  LogOrder,
  LogRecord,
  LogScalar,
  PriceSnapshot,
  QuoteLevel,
  TradeRecord,
} from "./types";

const DAY_PATTERN = /day_(-?\d+)/i;
const PRICE_FIELD_PATTERN = /^(bid|ask)_(price|volume)_(\d+)$/;

interface ParsedFilePayload {
  fileSummary: FileSummary;
  logRecords: LogRecord[];
  priceSnapshots: PriceSnapshot[];
  tradeRecords: TradeRecord[];
}

interface RawCsvRow {
  [key: string]: string | undefined;
}

export const EMPTY_DATASET: ImportedDataset = {
  days: [],
  fileSummaries: [],
  logNumericKeys: [],
  logRecords: [],
  priceSnapshots: [],
  products: [],
  quantityExtent: [0, DEFAULT_MAX_VISIBLE_QUOTE_POINTS / 400],
  tradeRecords: [],
  warnings: [],
};

function buildFileId(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function normalizeHeader(header: unknown) {
  if (typeof header === "string") {
    return header.trim().toLowerCase();
  }

  if (header === null || header === undefined) {
    return "";
  }

  return String(header).trim().toLowerCase();
}

function normalizeCellValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function hasNonEmptyCellValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => hasNonEmptyCellValue(entry));
  }

  return false;
}

function normalizeRow(row: unknown) {
  const normalized: RawCsvRow = {};

  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return normalized;
  }

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    if (!normalizedKey || normalizedKey === "__parsed_extra") {
      continue;
    }

    normalized[normalizedKey] = normalizeCellValue(value);
  }

  return normalized;
}

function normalizeString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = typeof value === "string" ? value : String(value);
  const trimmed = stringValue.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  const stringValue = typeof value === "string" ? value : String(value);
  const trimmed = stringValue.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferDay(fileName: string) {
  const match = fileName.match(DAY_PATTERN);
  return match ? Number(match[1]) : null;
}

function classifyFile(fields: string[]): FileKind {
  const fieldSet = new Set(fields);
  const hasQuoteColumns = fields.some((field) => PRICE_FIELD_PATTERN.test(field));

  if (fieldSet.has("timestamp") && fieldSet.has("product") && hasQuoteColumns) {
    return "prices";
  }

  if (
    fieldSet.has("timestamp") &&
    fieldSet.has("symbol") &&
    fieldSet.has("price") &&
    fieldSet.has("quantity")
  ) {
    return "trades";
  }

  return "unknown";
}

function detectLevelIds(fields: string[], side: "bid" | "ask") {
  const levelIds = new Set<number>();

  for (const field of fields) {
    const match = field.match(PRICE_FIELD_PATTERN);
    if (match?.[1] === side) {
      levelIds.add(Number(match[3]));
    }
  }

  return Array.from(levelIds).sort((left, right) => left - right);
}

function buildQuoteLevels(
  raw: RawCsvRow,
  side: "bid" | "ask",
  levelIds: number[],
): QuoteLevel[] {
  const levels: QuoteLevel[] = [];

  for (const level of levelIds) {
    const price = parseNumber(raw[`${side}_price_${level}`]);
    const volume = parseNumber(raw[`${side}_volume_${level}`]);

    if (price === null || volume === null || volume <= 0) {
      continue;
    }

    levels.push({
      side,
      level,
      price,
      volume,
    });
  }

  return levels.sort((left, right) =>
    side === "bid" ? right.price - left.price : left.price - right.price,
  );
}

function buildPriceSnapshot(
  raw: RawCsvRow,
  fileId: string,
  fileName: string,
  index: number,
  bidLevelIds: number[],
  askLevelIds: number[],
  fallbackDay: number | null,
): PriceSnapshot | null {
  const timestamp = parseNumber(raw.timestamp);
  const product = normalizeString(raw.product);

  if (timestamp === null || product === null) {
    return null;
  }

  const bids = buildQuoteLevels(raw, "bid", bidLevelIds);
  const asks = buildQuoteLevels(raw, "ask", askLevelIds);

  if (bids.length === 0 && asks.length === 0) {
    return null;
  }

  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const bestBidVolume = bids[0]?.volume ?? null;
  const bestAskVolume = asks[0]?.volume ?? null;
  const bidWall = bids.length ? Math.min(...bids.map((level) => level.price)) : null;
  const askWall = asks.length ? Math.max(...asks.map((level) => level.price)) : null;
  const wallMid =
    bidWall !== null && askWall !== null ? (bidWall + askWall) / 2 : null;
  const microPrice =
    bestBid !== null &&
    bestAsk !== null &&
    bestBidVolume !== null &&
    bestAskVolume !== null &&
    bestBidVolume + bestAskVolume > 0
      ? (bestBid * bestAskVolume + bestAsk * bestBidVolume) /
        (bestBidVolume + bestAskVolume)
      : null;
  const spread =
    bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  const derivedMid =
    bestBid !== null && bestAsk !== null ? (bestBid + bestAsk) / 2 : null;

  return {
    asks,
    askDepthSum: asks.reduce((sum, level) => sum + level.volume, 0),
    bestAsk,
    bestAskVolume,
    bestBid,
    bestBidVolume,
    bidDepthSum: bids.reduce((sum, level) => sum + level.volume, 0),
    bids,
    day: parseNumber(raw.day) ?? fallbackDay,
    fileId,
    id: `${fileId}:prices:${index}`,
    midPrice: parseNumber(raw.mid_price) ?? derivedMid,
    microPrice,
    product,
    profitAndLoss: parseNumber(raw.profit_and_loss),
    sourceFile: fileName,
    spread,
    timestamp,
    wallMid,
  } satisfies PriceSnapshot;
}

function buildTradeRecord(
  raw: RawCsvRow,
  fileId: string,
  fileName: string,
  index: number,
  fallbackDay: number | null,
): TradeRecord | null {
  const timestamp = parseNumber(raw.timestamp);
  const symbol = normalizeString(raw.symbol);
  const price = parseNumber(raw.price);
  const quantity = parseNumber(raw.quantity);

  if (timestamp === null || symbol === null || price === null || quantity === null) {
    return null;
  }

  const buyer = normalizeString(raw.buyer);
  const seller = normalizeString(raw.seller);
  const ownSide =
    buyer === "SUBMISSION" ? "buy" : seller === "SUBMISSION" ? "sell" : null;

  return {
    buyer,
    currency: normalizeString(raw.currency),
    day: parseNumber(raw.day) ?? fallbackDay,
    fileId,
    id: `${fileId}:trades:${index}`,
    ownSide,
    price,
    quantity,
    seller,
    sourceFile: fileName,
    symbol,
    timestamp,
  } satisfies TradeRecord;
}

function parseCsvTextRows(text: string) {
  const results = Papa.parse<RawCsvRow>(text, {
    delimiter: ";",
    header: true,
    skipEmptyLines: true,
  });

  const fields = results.meta.fields?.map(normalizeHeader) ?? [];
  const rows = (results.data ?? [])
    .map((row) => normalizeRow(row))
    .filter((row) => Object.values(row).some((value) => hasNonEmptyCellValue(value)));

  return {
    errorCount: results.errors.length,
    fields,
    rows,
  };
}

function buildPricePayloadFromRows(
  rows: RawCsvRow[],
  fields: string[],
  fileId: string,
  fileName: string,
  fallbackDay: number | null,
  parseWarnings: string[],
) {
  const bidLevelIds = detectLevelIds(fields, "bid");
  const askLevelIds = detectLevelIds(fields, "ask");

  const priceSnapshots = rows
    .map((row, index) =>
      buildPriceSnapshot(
        row,
        fileId,
        fileName,
        index,
        bidLevelIds,
        askLevelIds,
        fallbackDay,
      ),
    )
    .filter((snapshot): snapshot is PriceSnapshot => snapshot !== null);

  if (priceSnapshots.length !== rows.length) {
    parseWarnings.push(
      `Skipped ${rows.length - priceSnapshots.length} price row(s) without usable order-book levels.`,
    );
  }

  return {
    fileSummary: {
      dayValues: Array.from(
        new Set(
          priceSnapshots
            .map((snapshot) => snapshot.day)
            .filter((day): day is number => day !== null),
        ),
      ).sort((left, right) => left - right),
      fileId,
      fileName,
      hasOwnTrades: false,
      hasTraderIds: false,
      kind: "prices" satisfies FileKind,
      parseWarnings,
      products: Array.from(
        new Set(priceSnapshots.map((snapshot) => snapshot.product)),
      ).sort((left, right) => left.localeCompare(right)),
      rowCount: priceSnapshots.length,
      warnings: [],
    } satisfies FileSummary,
    priceSnapshots,
  };
}

function buildTradePayloadFromRows(
  rows: RawCsvRow[],
  fileId: string,
  fileName: string,
  fallbackDay: number | null,
  parseWarnings: string[],
) {
  const tradeRecords = rows
    .map((row, index) => buildTradeRecord(row, fileId, fileName, index, fallbackDay))
    .filter((trade): trade is TradeRecord => trade !== null);

  if (tradeRecords.length !== rows.length) {
    parseWarnings.push(
      `Skipped ${rows.length - tradeRecords.length} malformed trade row(s).`,
    );
  }

  return {
    fileSummary: {
      dayValues: Array.from(
        new Set(
          tradeRecords
            .map((trade) => trade.day)
            .filter((day): day is number => day !== null),
        ),
      ).sort((left, right) => left - right),
      fileId,
      fileName,
      hasOwnTrades: tradeRecords.some((trade) => trade.ownSide !== null),
      hasTraderIds: tradeRecords.some(
        (trade) =>
          (trade.buyer !== null && trade.buyer !== "SUBMISSION") ||
          (trade.seller !== null && trade.seller !== "SUBMISSION"),
      ),
      kind: "trades" satisfies FileKind,
      parseWarnings,
      products: Array.from(
        new Set(tradeRecords.map((trade) => trade.symbol)),
      ).sort((left, right) => left.localeCompare(right)),
      rowCount: tradeRecords.length,
      warnings: [],
    } satisfies FileSummary,
    tradeRecords,
  };
}

function flattenLogPayload(
  value: unknown,
  prefix: string,
  flatValues: Record<string, LogScalar>,
  numericValues: Record<string, number>,
) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    flatValues[prefix] = value;
    if (typeof value === "number" && Number.isFinite(value)) {
      numericValues[prefix] = value;
    }
    return;
  }

  if (Array.isArray(value)) {
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenLogPayload(nested, nextPrefix, flatValues, numericValues);
  }
}

function buildLogOrders(value: unknown): LogOrder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 3) {
      return [];
    }

    const side = typeof entry[0] === "string" ? entry[0] : null;
    const price =
      typeof entry[1] === "number" && Number.isFinite(entry[1]) ? entry[1] : null;
    const quantity =
      typeof entry[2] === "number" && Number.isFinite(entry[2]) ? entry[2] : null;

    if (side === null || price === null || quantity === null) {
      return [];
    }

    return [
      {
        price,
        quantity,
        side,
      } satisfies LogOrder,
    ];
  });
}

function buildLogRecord(
  raw: Record<string, unknown>,
  fileId: string,
  fileName: string,
  index: number,
  fallbackDay: number | null,
): LogRecord | null {
  const rawLambdaLog = typeof raw.lambdaLog === "string" ? raw.lambdaLog.trim() : "";
  if (!rawLambdaLog) {
    return null;
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawLambdaLog);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const timestamp =
    (typeof payload.timestamp === "number" && Number.isFinite(payload.timestamp)
      ? payload.timestamp
      : parseNumber(String(raw.timestamp ?? ""))) ?? null;
  const product =
    typeof payload.product === "string" ? normalizeString(payload.product) : null;

  if (timestamp === null) {
    return null;
  }

  const flatValues: Record<string, LogScalar> = {};
  const numericValues: Record<string, number> = {};
  flattenLogPayload(payload, "", flatValues, numericValues);

  return {
    day: fallbackDay,
    fileId,
    flatValues,
    id: `${fileId}:log:${index}`,
    numericValues,
    orders: buildLogOrders(payload.orders),
    product,
    rawLambdaLog,
    rawSandboxLog:
      typeof raw.sandboxLog === "string" && raw.sandboxLog.trim().length > 0
        ? raw.sandboxLog
        : null,
    skipReason: typeof payload.skip === "string" ? normalizeString(payload.skip) : null,
    sourceFile: fileName,
    timestamp,
  } satisfies LogRecord;
}

function sortTimeline(
  left: { day: number | null; sourceFile: string; timestamp: number },
  right: { day: number | null; sourceFile: string; timestamp: number },
) {
  const dayLeft = left.day ?? Number.NEGATIVE_INFINITY;
  const dayRight = right.day ?? Number.NEGATIVE_INFINITY;

  if (dayLeft !== dayRight) {
    return dayLeft - dayRight;
  }

  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }

  return left.sourceFile.localeCompare(right.sourceFile);
}

function computeWarnings(
  summaries: FileSummary[],
  logRecords: LogRecord[],
  priceSnapshots: PriceSnapshot[],
  tradeRecords: TradeRecord[],
) {
  const productSet = new Set([
    ...priceSnapshots.map((snapshot) => snapshot.product),
    ...logRecords
      .map((record) => record.product)
      .filter((product): product is string => product !== null),
  ]);

  return summaries.map((summary) => {
    const warnings = [...summary.parseWarnings];

    if (summary.kind === "trades") {
      const symbols = Array.from(
        new Set(
          tradeRecords
            .filter((trade) => trade.fileId === summary.fileId)
            .map((trade) => trade.symbol),
        ),
      );
      const unmatchedSymbols = symbols.filter((symbol) => !productSet.has(symbol));
      if (unmatchedSymbols.length > 0) {
        warnings.push(`Ignored unmatched symbols: ${unmatchedSymbols.join(", ")}`);
      }
    }

    return {
      ...summary,
      warnings: Array.from(new Set(warnings)),
    };
  });
}

function finalizeDataset(partial: {
  fileSummaries: FileSummary[];
  logRecords: LogRecord[];
  priceSnapshots: PriceSnapshot[];
  tradeRecords: TradeRecord[];
}): ImportedDataset {
  const logRecords = [...partial.logRecords].sort(sortTimeline);
  const priceSnapshots = [...partial.priceSnapshots].sort(sortTimeline);
  const tradeRecords = [...partial.tradeRecords].sort(sortTimeline);
  const fileSummaries = computeWarnings(
    partial.fileSummaries,
    logRecords,
    priceSnapshots,
    tradeRecords,
  );
  const products = Array.from(
    new Set([
      ...priceSnapshots.map((snapshot) => snapshot.product),
      ...tradeRecords.map((trade) => trade.symbol),
      ...logRecords
        .map((record) => record.product)
        .filter((product): product is string => product !== null),
    ]),
  ).sort((left, right) => left.localeCompare(right));
  const days = Array.from(
    new Set(
      [...priceSnapshots, ...tradeRecords, ...logRecords]
        .map((item) => item.day)
        .filter((day): day is number => day !== null),
    ),
  ).sort((left, right) => left - right);
  const logNumericKeys = Array.from(
    new Set(
      logRecords.flatMap((record) =>
        Object.keys(record.numericValues).filter((key) => key !== "timestamp"),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const maxQuantity = tradeRecords.length
    ? Math.max(...tradeRecords.map((trade) => trade.quantity))
    : 10;
  const warnings = fileSummaries.flatMap((summary) =>
    summary.warnings.map((warning) => `${summary.fileName}: ${warning}`),
  );

  return {
    days,
    fileSummaries,
    logNumericKeys,
    logRecords,
    priceSnapshots,
    products,
    quantityExtent: [0, Math.max(10, Math.ceil(maxQuantity))],
    tradeRecords,
    warnings,
  };
}

function parseCsvFile(file: File): Promise<ParsedFilePayload> {
  const fileId = buildFileId(file);
  const fallbackDay = inferDay(file.name);

  return new Promise((resolve, reject) => {
    Papa.parse<RawCsvRow>(file, {
      complete(results) {
        const fields = results.meta.fields?.map(normalizeHeader) ?? [];
        const kind = classifyFile(fields);
        const parseWarnings = results.errors.length
          ? [`Parser reported ${results.errors.length} warning(s).`]
          : [];
        const rows = (results.data ?? [])
          .map((row) => normalizeRow(row))
          .filter((row) => Object.values(row).some((value) => hasNonEmptyCellValue(value)));

        if (kind === "unknown") {
          resolve({
            fileSummary: {
              dayValues: fallbackDay === null ? [] : [fallbackDay],
              fileId,
              fileName: file.name,
              hasOwnTrades: false,
              hasTraderIds: false,
              kind,
              parseWarnings: [
                ...parseWarnings,
                "Unsupported schema. Expected a Prosperity prices or trades CSV.",
              ],
              products: [],
              rowCount: rows.length,
              warnings: [],
            },
            logRecords: [],
            priceSnapshots: [],
            tradeRecords: [],
          });
          return;
        }

        if (kind === "prices") {
          const { fileSummary, priceSnapshots } = buildPricePayloadFromRows(
            rows,
            fields,
            fileId,
            file.name,
            fallbackDay,
            parseWarnings,
          );
          resolve({
            fileSummary,
            logRecords: [],
            priceSnapshots,
            tradeRecords: [],
          });
          return;
        }

        const { fileSummary, tradeRecords } = buildTradePayloadFromRows(
          rows,
          fileId,
          file.name,
          fallbackDay,
          parseWarnings,
        );
        resolve({
          fileSummary,
          logRecords: [],
          priceSnapshots: [],
          tradeRecords,
        });
      },
      delimiter: ";",
      error: reject,
      header: true,
      skipEmptyLines: true,
      worker: true,
    });
  });
}

async function parseLogFile(file: File): Promise<ParsedFilePayload> {
  const fileId = buildFileId(file);
  const fallbackDay = inferDay(file.name);
  const rawText = await file.text();

  let parsedEnvelope: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Unsupported log payload.");
    }
    parsedEnvelope = parsed as Record<string, unknown>;
  } catch {
    return {
      fileSummary: {
        dayValues: fallbackDay === null ? [] : [fallbackDay],
        fileId,
        fileName: file.name,
        hasOwnTrades: false,
        hasTraderIds: false,
        kind: "unknown",
        parseWarnings: ["Unsupported log schema. Expected an official IMC backtest log JSON."],
        products: [],
        rowCount: 0,
        warnings: [],
      },
      logRecords: [],
      priceSnapshots: [],
      tradeRecords: [],
    };
  }

  const parseWarnings: string[] = [];

  const activitiesLog =
    typeof parsedEnvelope.activitiesLog === "string" ? parsedEnvelope.activitiesLog : "";
  const activityRowsResult =
    activitiesLog.length > 0 ? parseCsvTextRows(activitiesLog) : { errorCount: 0, fields: [], rows: [] };

  if (activityRowsResult.errorCount > 0) {
    parseWarnings.push(
      `activitiesLog parser reported ${activityRowsResult.errorCount} warning(s).`,
    );
  }

  const pricePayload =
    classifyFile(activityRowsResult.fields) === "prices"
      ? buildPricePayloadFromRows(
          activityRowsResult.rows,
          activityRowsResult.fields,
          fileId,
          file.name,
          fallbackDay,
          parseWarnings,
        )
      : {
          fileSummary: {
            dayValues: fallbackDay === null ? [] : [fallbackDay],
            fileId,
            fileName: file.name,
            hasOwnTrades: false,
            hasTraderIds: false,
            kind: "prices" satisfies FileKind,
            parseWarnings,
            products: [],
            rowCount: 0,
            warnings: [],
          } satisfies FileSummary,
          priceSnapshots: [],
        };

  const derivedDay =
    pricePayload.fileSummary.dayValues.length === 1
      ? pricePayload.fileSummary.dayValues[0]
      : fallbackDay;

  const tradeHistory = Array.isArray(parsedEnvelope.tradeHistory)
    ? parsedEnvelope.tradeHistory
    : [];
  const tradeRows: RawCsvRow[] = tradeHistory.map((entry) => {
    const record =
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : {};

    return {
      buyer: typeof record.buyer === "string" ? record.buyer : undefined,
      currency: typeof record.currency === "string" ? record.currency : undefined,
      day: derivedDay === null ? undefined : String(derivedDay),
      price:
        typeof record.price === "number" && Number.isFinite(record.price)
          ? String(record.price)
          : undefined,
      quantity:
        typeof record.quantity === "number" && Number.isFinite(record.quantity)
          ? String(record.quantity)
          : undefined,
      seller: typeof record.seller === "string" ? record.seller : undefined,
      symbol: typeof record.symbol === "string" ? record.symbol : undefined,
      timestamp:
        typeof record.timestamp === "number" && Number.isFinite(record.timestamp)
          ? String(record.timestamp)
          : undefined,
    };
  });

  const tradePayload = buildTradePayloadFromRows(
    tradeRows,
    fileId,
    file.name,
    derivedDay,
    parseWarnings,
  );

  const rawLogs = Array.isArray(parsedEnvelope.logs) ? parsedEnvelope.logs : [];
  const logRecords = rawLogs
    .map((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        return null;
      }

      return buildLogRecord(
        entry as Record<string, unknown>,
        fileId,
        file.name,
        index,
        derivedDay,
      );
    })
    .filter((record): record is LogRecord => record !== null);

  if (logRecords.length !== rawLogs.length) {
    parseWarnings.push(
      `Skipped ${rawLogs.length - logRecords.length} malformed lambda log entr${rawLogs.length - logRecords.length === 1 ? "y" : "ies"}.`,
    );
  }

  const products = Array.from(
    new Set([
      ...pricePayload.fileSummary.products,
      ...tradePayload.fileSummary.products,
      ...logRecords
        .map((record) => record.product)
        .filter((product): product is string => product !== null),
    ]),
  ).sort((left, right) => left.localeCompare(right));

  const dayValues = Array.from(
    new Set(
      [...pricePayload.priceSnapshots, ...tradePayload.tradeRecords, ...logRecords]
        .map((item) => item.day)
        .filter((day): day is number => day !== null),
    ),
  ).sort((left, right) => left - right);

  return {
    fileSummary: {
      dayValues,
      fileId,
      fileName: file.name,
      hasOwnTrades: tradePayload.fileSummary.hasOwnTrades,
      hasTraderIds: tradePayload.fileSummary.hasTraderIds,
      kind: "log",
      parseWarnings,
      products,
      rowCount: logRecords.length,
      warnings: [],
    },
    logRecords,
    priceSnapshots: pricePayload.priceSnapshots,
    tradeRecords: tradePayload.tradeRecords,
  };
}

export async function parseImportedFiles(files: File[]) {
  const parsedFiles = await Promise.all(
    files.map((file) => {
      const normalizedName = file.name.toLowerCase();
      if (normalizedName.endsWith(".log") || normalizedName.endsWith(".json")) {
        return parseLogFile(file);
      }

      return parseCsvFile(file);
    }),
  );

  return finalizeDataset({
    fileSummaries: parsedFiles.map((file) => file.fileSummary),
    logRecords: parsedFiles.flatMap((file) => file.logRecords),
    priceSnapshots: parsedFiles.flatMap((file) => file.priceSnapshots),
    tradeRecords: parsedFiles.flatMap((file) => file.tradeRecords),
  });
}

export async function parseCsvFiles(files: File[]) {
  return parseImportedFiles(files);
}

export function mergeImportedBatch(
  current: ImportedDataset,
  incoming: ImportedDataset,
): ImportedDataset {
  const incomingIds = new Set(incoming.fileSummaries.map((summary) => summary.fileId));

  return finalizeDataset({
    fileSummaries: [
      ...current.fileSummaries.filter((summary) => !incomingIds.has(summary.fileId)),
      ...incoming.fileSummaries,
    ],
    logRecords: [
      ...current.logRecords.filter((record) => !incomingIds.has(record.fileId)),
      ...incoming.logRecords,
    ],
    priceSnapshots: [
      ...current.priceSnapshots.filter((snapshot) => !incomingIds.has(snapshot.fileId)),
      ...incoming.priceSnapshots,
    ],
    tradeRecords: [
      ...current.tradeRecords.filter((trade) => !incomingIds.has(trade.fileId)),
      ...incoming.tradeRecords,
    ],
  });
}




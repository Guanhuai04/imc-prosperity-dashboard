import { Paper, Stack, Text, Title } from "@mantine/core";
import type { Data, Layout } from "plotly.js";
import { memo, useEffect, useMemo, useRef } from "react";
import { COLORS, LOG_OVERLAY_COLORS } from "../lib/constants";
import { PlotlyLib } from "../lib/plotly";
import {
  applyVisibleRange,
  buildLogIndicatorSeries,
  downsampleSnapshots,
  findNearestSnapshot,
  getMetricValue,
  isPriceLikeLogIndicator,
  normalizeAgainst,
} from "../lib/derived";
import { useDashboardStore } from "../store/dashboard-store";
import type {
  BookLevelKey,
  ClassifiedTrade,
  LogRecord,
  NormalizationKey,
  OverlayKey,
  PriceSnapshot,
} from "../lib/types";

interface MainChartProps {
  isBusy: boolean;
  logRecords: LogRecord[];
  normalization: NormalizationKey;
  onHoverTimestampChange: (timestamp: number | null) => void;
  onVisibleRangeChange: (range: [number, number] | null) => void;
  selectedIndicators: OverlayKey[];
  selectedLogIndicators: string[];
  selectedProduct: string | null;
  snapshots: PriceSnapshot[];
  trades: ClassifiedTrade[];
  visibleRange: [number, number] | null;
}

type PlotDiv = HTMLDivElement & {
  on?: (event: string, handler: (payload: unknown) => void) => void;
  removeAllListeners?: (event?: string) => void;
};

function volumeToSize(volume: number) {
  return Math.max(7, Math.min(17.5, 5.2 + Math.sqrt(volume) * 1.28));
}

function volumeToPrimaryLevelSize(volume: number) {
  return Math.max(9.5, Math.min(24, 5.4 + Math.sqrt(volume) * 2.15));
}

function volumeToTradeMarkerSize(volume: number) {
  return Math.max(10.5, Math.min(23.5, 8.8 + volume * 0.82));
}

function rangesMatch(
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

function buildIndicatorTrace(
  snapshots: PriceSnapshot[],
  indicator: OverlayKey,
  normalization: NormalizationKey,
): Data {
  return {
    connectgaps: false,
    hovertemplate: `${indicator}<br>t=%{x}<br>value=%{y:.2f}<extra></extra>`,
    line: {
      color: COLORS.indicator[indicator],
      width: indicator === "spread" ? 1.4 : 1.8,
    },
    mode: "lines",
    name: indicator,
    type: "scatter",
    x: snapshots.map((snapshot) => snapshot.timestamp),
    y: snapshots.map((snapshot) =>
      normalizeAgainst(getMetricValue(snapshot, indicator), snapshot, normalization),
    ),
  };
}

export const MainChart = memo(function MainChart({
  isBusy,
  logRecords,
  normalization,
  onHoverTimestampChange,
  onVisibleRangeChange,
  selectedIndicators,
  selectedLogIndicators,
  selectedProduct,
  snapshots,
  trades,
  visibleRange,
}: MainChartProps) {
  const plotRef = useRef<PlotDiv | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<number | null>(null);
  const lastHoveredTimestampRef = useRef<number | null>(null);
  const maxVisibleQuotePoints = useDashboardStore((state) => state.maxVisibleQuotePoints);
  const minVolumeThreshold = useDashboardStore((state) => state.minVolumeThreshold);
  const quantityRange = useDashboardStore((state) => state.quantityRange);
  const showBookLevelCircles = useDashboardStore((state) => state.showBookLevelCircles);
  const showOrderBook = useDashboardStore((state) => state.showOrderBook);
  const selectedBookLevels = useDashboardStore((state) => state.selectedBookLevels);
  const showPublicTrades = useDashboardStore((state) => state.showPublicTrades);
  const showOwnTrades = useDashboardStore((state) => state.showOwnTrades);

  const effectiveRange = useMemo<[number, number] | null>(() => {
    if (visibleRange !== null) {
      return visibleRange;
    }

    if (snapshots.length === 0) {
      return null;
    }

    return [snapshots[0].timestamp, snapshots[snapshots.length - 1].timestamp];
  }, [snapshots, visibleRange]);

  const visibleSnapshots = useMemo(
    () => applyVisibleRange(snapshots, effectiveRange),
    [snapshots, effectiveRange],
  );

  const visibleTrades = useMemo(
    () =>
      applyVisibleRange(
        trades.filter(
          (trade) =>
            trade.quantity >= quantityRange[0] && trade.quantity <= quantityRange[1],
        ),
        effectiveRange,
      ),
    [trades, effectiveRange, quantityRange],
  );

  const visibleLogRecords = useMemo(
    () => applyVisibleRange(logRecords, effectiveRange),
    [logRecords, effectiveRange],
  );

  const sampledSnapshots = useMemo(
    () =>
      downsampleSnapshots(
        visibleSnapshots,
        maxVisibleQuotePoints,
        minVolumeThreshold,
      ),
    [visibleSnapshots, maxVisibleQuotePoints, minVolumeThreshold],
  );

  const snapshotByTimestamp = useMemo(
    () => new Map(visibleSnapshots.map((snapshot) => [snapshot.timestamp, snapshot])),
    [visibleSnapshots],
  );

  const traces = useMemo(() => {
    const plotTraces: Data[] = [];
    const primaryLevelTraces: Data[] = [];
    const deeperLevelTraces: Data[] = [];

    if (showOrderBook) {
      const levelBuckets = new Map<
        BookLevelKey,
        {
          customData: Array<[number, number, string]>;
          name: string;
          prices: number[];
          side: "bid" | "ask";
          sizes: number[];
          timestamps: number[];
        }
      >(
        ([
          ["bid1", "Bid 1", "bid"],
          ["bid2", "Bid 2", "bid"],
          ["bid3", "Bid 3", "bid"],
          ["ask1", "Ask 1", "ask"],
          ["ask2", "Ask 2", "ask"],
          ["ask3", "Ask 3", "ask"],
        ] as const).map(([key, name, side]) => [
          key,
          {
            customData: [],
            name,
            prices: [],
            side,
            sizes: [],
            timestamps: [],
          },
        ]),
      );

      for (const snapshot of sampledSnapshots) {
        for (const bid of snapshot.bids) {
          const levelKey = `bid${bid.level}` as BookLevelKey;
          const levelBucket = levelBuckets.get(levelKey);
          if (
            bid.volume < minVolumeThreshold ||
            bid.level > 3 ||
            levelBucket === undefined ||
            !selectedBookLevels.includes(levelKey)
          ) {
            continue;
          }
          const normalized = normalizeAgainst(bid.price, snapshot, normalization);
          if (normalized === null) {
            continue;
          }

          levelBucket.timestamps.push(snapshot.timestamp);
          levelBucket.prices.push(normalized);
          levelBucket.sizes.push(volumeToSize(bid.volume));
          levelBucket.customData.push([bid.volume, bid.level, snapshot.sourceFile]);
        }

        for (const ask of snapshot.asks) {
          const levelKey = `ask${ask.level}` as BookLevelKey;
          const levelBucket = levelBuckets.get(levelKey);
          if (
            ask.volume < minVolumeThreshold ||
            ask.level > 3 ||
            levelBucket === undefined ||
            !selectedBookLevels.includes(levelKey)
          ) {
            continue;
          }
          const normalized = normalizeAgainst(ask.price, snapshot, normalization);
          if (normalized === null) {
            continue;
          }

          levelBucket.timestamps.push(snapshot.timestamp);
          levelBucket.prices.push(normalized);
          levelBucket.sizes.push(volumeToSize(ask.volume));
          levelBucket.customData.push([ask.volume, ask.level, snapshot.sourceFile]);
        }
      }

      for (const [levelKey, bucket] of levelBuckets) {
        if (bucket.timestamps.length === 0) {
          continue;
        }

        const isPrimaryLevel = levelKey === "bid1" || levelKey === "ask1";
        if (isPrimaryLevel) {
          primaryLevelTraces.push({
            connectgaps: false,
            customdata: bucket.customData,
            hovertemplate:
              `${bucket.name}<br>t=%{x}<br>price=%{y:.2f}<br>qty=%{customdata[0]}<br>level=%{customdata[1]}<br>%{customdata[2]}<extra></extra>`,
            legendgroup: bucket.name,
            line: {
              color: COLORS.bookLevels[levelKey],
              width: 2.3,
            },
            mode: "lines",
            name: bucket.name,
            type: "scatter",
            x: bucket.timestamps,
            y: bucket.prices,
          });

          if (showBookLevelCircles) {
            primaryLevelTraces.push({
              customdata: bucket.customData,
              hovertemplate:
                `${bucket.name}<br>t=%{x}<br>price=%{y:.2f}<br>qty=%{customdata[0]}<br>level=%{customdata[1]}<br>%{customdata[2]}<extra></extra>`,
              legendgroup: bucket.name,
              marker: {
                color: COLORS.bookLevelMarkers[levelKey] ?? COLORS.bookLevels[levelKey],
                line: {
                  color: COLORS.bookLevels[levelKey],
                  width: 1.25,
                },
                opacity: 0.96,
                size: bucket.sizes.map((_, index) =>
                  volumeToPrimaryLevelSize(bucket.customData[index][0]),
                ),
              },
              mode: "markers",
              name: bucket.name,
              showlegend: false,
              type: "scatter",
              x: bucket.timestamps,
              y: bucket.prices,
            });
          }
          continue;
        }

        deeperLevelTraces.push({
          connectgaps: false,
          customdata: bucket.customData,
          hovertemplate:
            `${bucket.name}<br>t=%{x}<br>price=%{y:.2f}<br>qty=%{customdata[0]}<br>level=%{customdata[1]}<br>%{customdata[2]}<extra></extra>`,
          line: {
            color: COLORS.bookLevels[levelKey],
            width: levelKey.endsWith("2") ? 1.95 : 1.7,
          },
          legendgroup: bucket.name,
          mode: "lines",
          name: bucket.name,
          type: "scatter",
          x: bucket.timestamps,
          y: bucket.prices,
        });
      }
    }

    for (const indicator of selectedIndicators) {
      if (indicator === "bestBid" || indicator === "bestAsk") {
        continue;
      }

      plotTraces.push(buildIndicatorTrace(visibleSnapshots, indicator, normalization));
    }

    for (const [index, indicator] of selectedLogIndicators.entries()) {
      const points = buildLogIndicatorSeries(visibleLogRecords, indicator);
      if (points.length === 0) {
        continue;
      }

      const isPriceLike = isPriceLikeLogIndicator(indicator);
      plotTraces.push({
        connectgaps: false,
        hovertemplate: `${indicator}<br>t=%{x}<br>value=%{y:.2f}<extra></extra>`,
        line: {
          color: LOG_OVERLAY_COLORS[index % LOG_OVERLAY_COLORS.length],
          dash: isPriceLike ? "dot" : "longdash",
          width: 1.7,
        },
        mode: "lines",
        name: indicator,
        type: "scatter",
        x: points.map((point) => point.timestamp),
        y: points.map((point) => {
          if (!isPriceLike) {
            return point.value;
          }

          const snapshot =
            snapshotByTimestamp.get(point.timestamp) ??
            findNearestSnapshot(visibleSnapshots, point.timestamp);
          return snapshot
            ? normalizeAgainst(point.value, snapshot, normalization)
            : point.value;
        }),
        yaxis: isPriceLike ? "y" : "y2",
      });
    }

    plotTraces.push(...deeperLevelTraces);
    plotTraces.push(...primaryLevelTraces);

    const ownTrades = visibleTrades.filter(
      (trade) =>
        showOwnTrades &&
        (trade.classification === "own-buy" || trade.classification === "own-sell"),
    );

    if (ownTrades.length > 0) {
      plotTraces.push({
        customdata: ownTrades.map((trade) => [
          trade.quantity,
          trade.classification,
          trade.sourceFile,
        ]),
        hovertemplate:
          "Own trade<br>t=%{x}<br>price=%{y:.2f}<br>qty=%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}<extra></extra>",
        marker: {
          color: COLORS.ownTrade,
          line: {
            color: "rgba(61, 36, 10, 0.95)",
            width: 1.6,
          },
          opacity: 0.98,
            size: ownTrades.map((trade) => volumeToTradeMarkerSize(trade.quantity) + 1.5),
            symbol: "x",
          },
        mode: "markers",
        name: "Own trades",
        type: "scatter",
        x: ownTrades.map((trade) => trade.timestamp),
        y: ownTrades.map((trade) => {
          const snapshot =
            snapshotByTimestamp.get(trade.timestamp) ??
            findNearestSnapshot(visibleSnapshots, trade.timestamp);
          return snapshot
            ? normalizeAgainst(trade.price, snapshot, normalization)
            : trade.price;
        }),
      });
    }

    if (showPublicTrades) {
      const classifiedGroups: Record<
        "buy-aggressor" | "sell-aggressor" | "unknown",
        { color: string; name: string; symbol: string; trades: ClassifiedTrade[] }
      > = {
        "buy-aggressor": {
          color: COLORS.publicBuyTrade,
          name: "Public buy aggressor",
          symbol: "triangle-up",
          trades: [],
        },
        "sell-aggressor": {
          color: COLORS.publicSellTrade,
          name: "Public sell aggressor",
          symbol: "triangle-down",
          trades: [],
        },
        unknown: {
          color: COLORS.publicUnknownTrade,
          name: "Unknown public trade",
          symbol: "square",
          trades: [],
        },
      };

      for (const trade of visibleTrades) {
        if (trade.classification === "own-buy" || trade.classification === "own-sell") {
          continue;
        }
        classifiedGroups[trade.classification].trades.push(trade);
      }

      for (const group of Object.values(classifiedGroups)) {
        if (group.trades.length === 0) {
          continue;
        }

        plotTraces.push({
          customdata: group.trades.map((trade) => [
            trade.quantity,
            trade.buyer ?? "n/a",
            trade.seller ?? "n/a",
            trade.sourceFile,
          ]),
          hovertemplate:
            `${group.name}<br>t=%{x}<br>price=%{y:.2f}<br>qty=%{customdata[0]}<br>buyer=%{customdata[1]}<br>seller=%{customdata[2]}<br>%{customdata[3]}<extra></extra>`,
          marker: {
            color: group.color,
            line:
              group.name === "Public sell aggressor"
                ? {
                    color: "rgba(255, 236, 228, 0.92)",
                    width: 1.3,
                  }
                : group.name === "Public buy aggressor"
                  ? {
                      color: "rgba(232, 246, 255, 0.88)",
                      width: 1.1,
                    }
                  : undefined,
            opacity:
              group.name === "Public sell aggressor"
                ? 0.97
                : group.name === "Public buy aggressor"
                  ? 0.92
                  : 0.86,
            size: group.trades.map((trade) =>
              volumeToTradeMarkerSize(trade.quantity) +
              (group.name === "Public sell aggressor"
                ? 2
                : group.name === "Public buy aggressor"
                  ? 1.5
                  : 0.5),
            ),
            symbol: group.symbol,
          },
          mode: "markers",
          name: group.name,
          type: "scatter",
          x: group.trades.map((trade) => trade.timestamp),
          y: group.trades.map((trade) => {
            const snapshot =
              snapshotByTimestamp.get(trade.timestamp) ??
              findNearestSnapshot(visibleSnapshots, trade.timestamp);
            return snapshot
              ? normalizeAgainst(trade.price, snapshot, normalization)
              : trade.price;
          }),
        });
      }
    }

    return plotTraces;
  }, [
    minVolumeThreshold,
    normalization,
    sampledSnapshots,
    selectedIndicators,
    selectedBookLevels,
    showBookLevelCircles,
    showOrderBook,
    showOwnTrades,
    showPublicTrades,
    selectedLogIndicators,
    snapshotByTimestamp,
    visibleSnapshots,
    visibleLogRecords,
    visibleTrades,
  ]);

  const hasSecondaryLogAxis = useMemo(
    () => selectedLogIndicators.some((indicator) => !isPriceLikeLogIndicator(indicator)),
    [selectedLogIndicators],
  );

  const layout = useMemo(
    () => {
      const baseLayout: Partial<Layout> = {
        autosize: true,
        dragmode: "pan",
        font: {
          color: "#eef4fb",
          family: '"IBM Plex Mono", monospace',
          size: 12,
        },
        hoverlabel: {
          bgcolor: "rgba(10, 18, 30, 0.92)",
          bordercolor: "rgba(255,255,255,0.06)",
          font: {
            color: "#eef4fb",
            family: '"IBM Plex Mono", monospace',
          },
        },
        hovermode: "closest",
        legend: {
          bgcolor: "rgba(8, 13, 22, 0.72)",
          bordercolor: "rgba(255,255,255,0.06)",
          borderwidth: 1,
          orientation: "h",
          x: 0,
          xanchor: "left",
          y: 1.08,
        },
        margin: {
          b: 48,
          l: 78,
          r: 22,
          t: 32,
        },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(4, 10, 18, 0.8)",
        uirevision: selectedProduct ?? "dashboard",
        xaxis: {
          automargin: true,
          color: "#a8bbd0",
          gridcolor: COLORS.grid,
          ...(visibleRange !== null ? { range: visibleRange } : {}),
          showspikes: true,
          spikecolor: "rgba(255,255,255,0.26)",
          spikedash: "dot",
          spikemode: "across",
          spikesnap: "cursor",
          spikethickness: 1,
          title: {
            standoff: 16,
            text: "Timestamp",
          },
          zeroline: false,
        },
        yaxis: {
          automargin: true,
          color: "#a8bbd0",
          gridcolor: COLORS.grid,
          title: {
            standoff: 24,
            text:
              normalization === "none"
                ? "Price"
                : `Price - ${normalization}`,
          },
          zeroline: false,
        },
      };

      if (hasSecondaryLogAxis) {
        baseLayout.yaxis2 = {
          automargin: true,
          color: "#c8d2de",
          overlaying: "y",
          showgrid: false,
          side: "right",
          title: {
            standoff: 18,
            text: "Log scale",
          },
          zeroline: false,
        };
      }

      return baseLayout;
    },
    [hasSecondaryLogAxis, normalization, selectedProduct, visibleRange],
  );

  const plotConfig = useMemo(
    () => ({
      displaylogo: false,
      responsive: true,
      scrollZoom: true,
    }),
    [],
  );

  useEffect(() => {
    const plotElement = plotRef.current;
    if (plotElement === null) {
      return;
    }

    let isCancelled = false;

    const handleHover = (payload: unknown) => {
      if (payload === null || typeof payload !== "object") {
        return;
      }

      const points =
        "points" in payload && Array.isArray(payload.points) ? payload.points : [];
      const xValue = points[0]?.x;
      if (typeof xValue !== "number" || xValue === pendingHoverRef.current) {
        return;
      }

      pendingHoverRef.current = xValue;
      if (hoverFrameRef.current !== null) {
        return;
      }

      hoverFrameRef.current = window.requestAnimationFrame(() => {
        hoverFrameRef.current = null;
        const nextTimestamp = pendingHoverRef.current;
        pendingHoverRef.current = null;

        if (
          typeof nextTimestamp === "number" &&
          nextTimestamp !== lastHoveredTimestampRef.current
        ) {
          lastHoveredTimestampRef.current = nextTimestamp;
          onHoverTimestampChange(nextTimestamp);
        }
      });
    };

    const handleRelayout = (payload: unknown) => {
      if (payload === null || typeof payload !== "object") {
        return;
      }

      let nextRange: [number, number] | null | undefined;

      if (
        "xaxis.range[0]" in payload &&
        "xaxis.range[1]" in payload &&
        typeof payload["xaxis.range[0]"] === "number" &&
        typeof payload["xaxis.range[1]"] === "number"
      ) {
        nextRange = [
          payload["xaxis.range[0]"],
          payload["xaxis.range[1]"],
        ];
      } else if ("xaxis.autorange" in payload) {
        nextRange = null;
      }

      if (nextRange === undefined || rangesMatch(visibleRange, nextRange)) {
        return;
      }

      onVisibleRangeChange(nextRange);
    };

    void Promise.resolve(PlotlyLib.react(plotElement, traces, layout, plotConfig))
      .then(() => {
        if (isCancelled) {
          return;
        }

        plotElement.removeAllListeners?.("plotly_hover");
        plotElement.removeAllListeners?.("plotly_relayout");
        plotElement.on?.("plotly_hover", handleHover);
        plotElement.on?.("plotly_relayout", handleRelayout);
      })
      .catch((error) => {
        console.error("Failed to render main plot", error);
      });

    return () => {
      isCancelled = true;
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      pendingHoverRef.current = null;
      plotElement.removeAllListeners?.("plotly_hover");
      plotElement.removeAllListeners?.("plotly_relayout");
    };
  }, [
    layout,
    onHoverTimestampChange,
    onVisibleRangeChange,
    plotConfig,
    traces,
    visibleRange,
  ]);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }

      const plotElement = plotRef.current;
      if (plotElement !== null) {
        PlotlyLib.purge(plotElement);
      }
    },
    [],
  );

  if (snapshots.length === 0) {
    return (
      <Paper className="surface-panel chart-frame main-plot-frame" p="lg" radius="xl" withBorder>
        <Stack gap="sm" justify="center" mih={620}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Main Plot
          </Text>
          <Title order={3}>No product data selected yet.</Title>
          <Text c="dimmed" maw={520} size="sm">
            Import at least one valid prices CSV, then choose a product from the control
            panel to render the order book scatter, trade markers, and overlay lines.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="surface-panel chart-frame main-plot-frame" p="lg" radius="xl" withBorder>
      <Stack gap="sm">
        <Stack gap={4}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Main Plot
          </Text>
          <Title order={3}>{selectedProduct ?? "Product"} · order book and trades</Title>
          <Text c="dimmed" size="sm">
            Level 1 can optionally show circles, and all book levels connect directly across observed timestamps.
          </Text>
        </Stack>

        <div className="plot-wrapper">
          <div ref={plotRef} style={{ height: "640px", width: "100%" }} />
        </div>

        <Text c="dimmed" size="xs">
          {isBusy
            ? "Parsing CSV files..."
            : `${visibleSnapshots.length} visible snapshots · ${visibleTrades.length} visible trades`}
        </Text>
      </Stack>
    </Paper>
  );
});

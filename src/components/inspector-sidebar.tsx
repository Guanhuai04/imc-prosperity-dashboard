import {
  Badge,
  Divider,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { memo, useMemo } from "react";
import { findNearestSnapshot, getMetricValue } from "../lib/derived";
import type {
  ClassifiedTrade,
  LogRecord,
  MetricPoint,
  NormalizationKey,
  OverlayKey,
  PriceSnapshot,
} from "../lib/types";

interface InspectorSidebarProps {
  hoveredTimestamp: number | null;
  indicators: OverlayKey[];
  logRecord: LogRecord | null;
  normalization: NormalizationKey;
  pnlPoint: MetricPoint | null;
  positionPoint: MetricPoint | null;
  snapshots: PriceSnapshot[];
  trades: ClassifiedTrade[];
}

const PRIORITY_KEYS = [
  "position",
  "book.best_bid",
  "book.best_ask",
  "signals.bid_wall",
  "signals.ask_wall",
  "signals.wall_mid",
  "result_order_count",
];

function formatMetric(value: number | null, digits = 2) {
  return value === null ? "n/a" : value.toFixed(digits);
}

function formatScalar(value: unknown) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

export const InspectorSidebar = memo(function InspectorSidebar({
  hoveredTimestamp,
  indicators,
  logRecord,
  normalization,
  pnlPoint,
  positionPoint,
  snapshots,
  trades,
}: InspectorSidebarProps) {
  const snapshot = findNearestSnapshot(snapshots, hoveredTimestamp);

  const orderBookRows = useMemo(() => {
    if (snapshot === null) {
      return [];
    }

    const asks = [...snapshot.asks].slice(0, 3).reverse();
    const bids = [...snapshot.bids].slice(0, 3);
    const maxVolume = Math.max(
      1,
      ...asks.map((level) => level.volume),
      ...bids.map((level) => level.volume),
    );

    return [
      ...asks.map((level) => ({
        key: `ask-${level.level}`,
        label: `Ask ${level.level}`,
        price: level.price,
        side: "ask" as const,
        volume: level.volume,
        width: `${Math.max(18, (level.volume / maxVolume) * 100)}%`,
      })),
      {
        key: "mid",
        label: "Mid",
        price: snapshot.midPrice,
        side: "mid" as const,
        volume: null,
        width: "100%",
      },
      ...bids.map((level) => ({
        key: `bid-${level.level}`,
        label: `Bid ${level.level}`,
        price: level.price,
        side: "bid" as const,
        volume: level.volume,
        width: `${Math.max(18, (level.volume / maxVolume) * 100)}%`,
      })),
    ];
  }, [snapshot]);

  const highlightedEntries = useMemo(() => {
    if (logRecord === null) {
      return [];
    }

    return PRIORITY_KEYS.flatMap((key) => {
      if (!(key in logRecord.flatValues)) {
        return [];
      }

      return [[key, logRecord.flatValues[key]] as const];
    });
  }, [logRecord]);

  return (
    <Paper className="surface-panel inspector-sidebar-frame" p="md" radius="xl" withBorder>
      <Stack className="inspector-sidebar-stack" gap="lg">
        <Stack gap="lg">
          <Stack gap="sm">
            <div>
              <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                Snapshot
              </Text>
              <Title order={3} size="h4">
                {snapshot ? `Timestamp ${snapshot.timestamp}` : "No synchronized point"}
              </Title>
            </div>

            {snapshot ? (
              <Group gap="xs">
                <Badge color="cyan" variant="light">{snapshot.product}</Badge>
                <Badge color="grape" variant="light">
                  {snapshot.day === null ? "Day n/a" : `Day ${snapshot.day}`}
                </Badge>
                <Badge color="gray" variant="outline">{snapshot.sourceFile}</Badge>
              </Group>
            ) : (
              <Text c="dimmed" size="sm">
                Hover the main plot to inspect the book, trades, and logger state here.
              </Text>
            )}
          </Stack>

          {snapshot ? (
            <>
              <SimpleGrid cols={2} spacing="sm">
                <div>
                  <Text c="dimmed" size="xs">Best bid</Text>
                  <Text className="mono" fw={700} size="sm">{formatMetric(snapshot.bestBid)}</Text>
                </div>
                <div>
                  <Text c="dimmed" size="xs">Best ask</Text>
                  <Text className="mono" fw={700} size="sm">{formatMetric(snapshot.bestAsk)}</Text>
                </div>
                <div>
                  <Text c="dimmed" size="xs">PnL</Text>
                  <Text className="mono" fw={700} size="sm">
                    {pnlPoint ? pnlPoint.value.toFixed(2) : formatMetric(snapshot.profitAndLoss)}
                  </Text>
                </div>
                <div>
                  <Text c="dimmed" size="xs">Position</Text>
                  <Text className="mono" fw={700} size="sm">
                    {positionPoint ? positionPoint.value.toFixed(0) : "n/a"}
                  </Text>
                </div>
              </SimpleGrid>

              <Stack className="order-book-card" gap="xs">
                <Group justify="space-between">
                  <Text fw={700} size="sm">Order Book</Text>
                  <Text c="dimmed" size="xs">Mid {formatMetric(snapshot.midPrice)}</Text>
                </Group>
                <Stack gap={8}>
                  {orderBookRows.map((row) =>
                    row.side === "mid" ? (
                      <div className="order-book-midline" key={row.key}>
                        <Text c="dimmed" fw={700} size="xs">{row.label}</Text>
                        <div className="order-book-midbar" />
                        <Text className="mono" fw={700} size="xs">{formatMetric(row.price)}</Text>
                      </div>
                    ) : (
                      <div className={`order-book-row order-book-row-${row.side}`} key={row.key}>
                        <div className="order-book-row-header">
                          <Text c="dimmed" size="xs">{row.label}</Text>
                          <Text className="mono" fw={700} size="xs">{formatMetric(row.price)}</Text>
                        </div>
                        <div className="order-book-bar-shell">
                          <div className="order-book-bar-fill" style={{ width: row.width }} />
                        </div>
                        <Badge color={row.side === "bid" ? "blue" : "red"} radius="sm" size="sm" variant="light">
                          {row.volume}
                        </Badge>
                      </div>
                    ),
                  )}
                </Stack>
              </Stack>

              <Stack gap="xs">
                <Text fw={700} size="sm">Indicators</Text>
                {indicators.length === 0 ? (
                  <Text c="dimmed" size="xs">No overlay indicators selected.</Text>
                ) : (
                  indicators.map((indicator) => (
                    <Group justify="space-between" key={indicator}>
                      <Text c="dimmed" size="xs">{indicator}</Text>
                      <Text className="mono" fw={700} size="xs">
                        {formatMetric(getMetricValue(snapshot, indicator))}
                      </Text>
                    </Group>
                  ))
                )}
                <Text c="dimmed" size="xs">Normalization: {normalization}</Text>
              </Stack>

              <Stack gap="xs">
                <Text fw={700} size="sm">Trades</Text>
                {trades.length === 0 ? (
                  <Text c="dimmed" size="xs">No trades at the hovered timestamp.</Text>
                ) : (
                  trades.map((trade) => (
                    <div className="inspector-trade-row" key={trade.id}>
                      <div>
                        <Text fw={700} size="xs">{trade.classification}</Text>
                        <Text c="dimmed" size="xs">
                          {trade.buyer ?? "n/a"} {"->"} {trade.seller ?? "n/a"}
                        </Text>
                      </div>
                      <Badge color="orange" radius="sm" size="sm" variant="light">
                        {trade.price.toFixed(2)} x {trade.quantity}
                      </Badge>
                    </div>
                  ))
                )}
              </Stack>
            </>
          ) : null}
        </Stack>

        <Divider />

        <Stack className="inspector-logger-section" gap="sm">
          <div>
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Logger
            </Text>
            <Title order={4}>{logRecord ? `Timestamp ${logRecord.timestamp}` : "No log entry here"}</Title>
          </div>

          {logRecord === null ? (
            <Text c="dimmed" size="sm">
              Import a backtest log and hover the chart to inspect `lambdaLog` state.
            </Text>
          ) : (
            <ScrollArea className="inspector-log-scroll" offsetScrollbars scrollbarSize={6}>
              <Stack gap="sm">
                <Group gap="xs">
                  <Badge color="violet" variant="light">{logRecord.product ?? "Unknown"}</Badge>
                  <Badge color="gray" variant="outline">{logRecord.sourceFile}</Badge>
                </Group>

                {highlightedEntries.length > 0 ? (
                  <Stack gap={6}>
                    {highlightedEntries.map(([key, value]) => (
                      <Group justify="space-between" key={key}>
                        <Text c="dimmed" size="xs">{key}</Text>
                        <Text className="mono" fw={700} size="xs">{formatScalar(value)}</Text>
                      </Group>
                    ))}
                  </Stack>
                ) : null}

                <Stack gap="xs">
                  <Text fw={700} size="sm">Orders</Text>
                  {logRecord.orders.length === 0 ? (
                    <Text c="dimmed" size="xs">No orders recorded.</Text>
                  ) : (
                    logRecord.orders.map((order, index) => (
                      <div className="inspector-trade-row" key={`${logRecord.id}:${index}`}>
                        <div>
                          <Text fw={700} size="xs">{order.side}</Text>
                          <Text c="dimmed" size="xs">qty {order.quantity}</Text>
                        </div>
                        <Badge color={order.side === "BUY" ? "blue" : "red"} radius="sm" size="sm" variant="light">
                          {order.price.toFixed(2)}
                        </Badge>
                      </div>
                    ))
                  )}
                </Stack>

                <Stack gap="xs">
                  <Text fw={700} size="sm">Raw lambdaLog</Text>
                  <pre className="log-code-block inspector-log-code">{logRecord.rawLambdaLog}</pre>
                </Stack>
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
});

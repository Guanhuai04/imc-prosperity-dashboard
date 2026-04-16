import {
  Badge,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { memo } from "react";
import { findNearestSnapshot, getMetricValue } from "../lib/derived";
import type {
  ClassifiedTrade,
  MetricPoint,
  NormalizationKey,
  OverlayKey,
  PriceSnapshot,
} from "../lib/types";

interface HoverSnapshotProps {
  hoveredTimestamp: number | null;
  indicators: OverlayKey[];
  normalization: NormalizationKey;
  pnlPoint: MetricPoint | null;
  positionPoint: MetricPoint | null;
  snapshots: PriceSnapshot[];
  trades: ClassifiedTrade[];
}

function formatMetric(value: number | null, digits = 2) {
  return value === null ? "n/a" : value.toFixed(digits);
}

export const HoverSnapshot = memo(function HoverSnapshot({
  hoveredTimestamp,
  indicators,
  normalization,
  pnlPoint,
  positionPoint,
  snapshots,
  trades,
}: HoverSnapshotProps) {
  const snapshot = findNearestSnapshot(snapshots, hoveredTimestamp);

  if (snapshot === null) {
    return (
      <Paper className="surface-panel" p="lg" radius="xl" withBorder>
        <Stack gap="sm">
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Hover Snapshot
          </Text>
          <Title order={4}>No synchronized point yet.</Title>
          <Text c="dimmed" size="sm">
            Once the main chart has data, hovering any timestamp will populate the order
            book ladder, trades, and panel values here.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="surface-panel" p="lg" radius="xl" withBorder>
      <Stack gap="md">
        <Stack gap={4}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Hover Snapshot
          </Text>
          <Title order={3}>Timestamp {snapshot.timestamp}</Title>
          <Group gap="xs">
            <Badge color="cyan" variant="light">
              {snapshot.product}
            </Badge>
            <Badge color="grape" variant="light">
              {snapshot.day === null ? "Day n/a" : `Day ${snapshot.day}`}
            </Badge>
            <Badge color="gray" variant="outline">
              {snapshot.sourceFile}
            </Badge>
          </Group>
        </Stack>

        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Best bid
            </Text>
            <Text className="mono" fw={600}>
              {formatMetric(snapshot.bestBid)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Best ask
            </Text>
            <Text className="mono" fw={600}>
              {formatMetric(snapshot.bestAsk)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Spread
            </Text>
            <Text className="mono" fw={600}>
              {formatMetric(snapshot.spread)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Wall mid
            </Text>
            <Text className="mono" fw={600}>
              {formatMetric(snapshot.wallMid)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              PnL
            </Text>
            <Text className="mono" fw={600}>
              {pnlPoint ? pnlPoint.value.toFixed(2) : formatMetric(snapshot.profitAndLoss)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Position
            </Text>
            <Text className="mono" fw={600}>
              {positionPoint ? positionPoint.value.toFixed(0) : "n/a"}
            </Text>
          </Stack>
        </SimpleGrid>

        <Divider />

        <Stack gap="xs">
          <Text fw={600} size="sm">
            Order book ladder
          </Text>
          <SimpleGrid cols={2}>
            <Stack className="snapshot-ladder" gap={4}>
              <Text c="dimmed" size="xs" tt="uppercase">
                Bids
              </Text>
              {snapshot.bids.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No bid levels
                </Text>
              ) : (
                snapshot.bids.map((level) => (
                  <Group key={`${snapshot.id}:bid:${level.level}`} justify="space-between">
                    <Text className="mono" fw={600} size="sm">
                      {level.price.toFixed(2)}
                    </Text>
                    <Badge color="blue" variant="light">
                      {level.volume}
                    </Badge>
                  </Group>
                ))
              )}
            </Stack>
            <Stack className="snapshot-ladder" gap={4}>
              <Text c="dimmed" size="xs" tt="uppercase">
                Asks
              </Text>
              {snapshot.asks.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No ask levels
                </Text>
              ) : (
                snapshot.asks.map((level) => (
                  <Group key={`${snapshot.id}:ask:${level.level}`} justify="space-between">
                    <Text className="mono" fw={600} size="sm">
                      {level.price.toFixed(2)}
                    </Text>
                    <Badge color="red" variant="light">
                      {level.volume}
                    </Badge>
                  </Group>
                ))
              )}
            </Stack>
          </SimpleGrid>
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600} size="sm">
            Indicator readout
          </Text>
          {indicators.length === 0 ? (
            <Text c="dimmed" size="sm">
              No overlay indicators selected.
            </Text>
          ) : (
            indicators.map((indicator) => (
              <Group key={indicator} justify="space-between">
                <Text c="dimmed" size="sm">
                  {indicator}
                </Text>
                <Text className="mono" fw={600} size="sm">
                  {formatMetric(getMetricValue(snapshot, indicator))}
                </Text>
              </Group>
            ))
          )}
          <Text c="dimmed" size="xs">
            Normalization basis: {normalization}
          </Text>
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600} size="sm">
            Trades at this timestamp
          </Text>
          {trades.length === 0 ? (
            <Text c="dimmed" size="sm">
              No trades occurred exactly at this hovered timestamp.
            </Text>
          ) : (
            trades.map((trade) => (
              <div className="trade-ladder-row" key={trade.id}>
                <div>
                  <Text fw={600} size="sm">
                    {trade.classification}
                  </Text>
                  <Text c="dimmed" size="xs">
                    buyer {trade.buyer ?? "n/a"} · seller {trade.seller ?? "n/a"}
                  </Text>
                </div>
                <Badge color="orange" variant="light">
                  {trade.price.toFixed(2)} × {trade.quantity}
                </Badge>
              </div>
            ))
          )}
        </Stack>
      </Stack>
    </Paper>
  );
});

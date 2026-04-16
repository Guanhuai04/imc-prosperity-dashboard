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
import type { LogRecord, LogScalar } from "../lib/types";

interface LogViewerProps {
  hoveredTimestamp: number | null;
  logRecord: LogRecord | null;
}

const PRIORITY_KEYS = [
  "position",
  "book.best_bid",
  "book.best_ask",
  "signals.bid_wall",
  "signals.ask_wall",
  "signals.wall_mid",
  "result_order_count",
  "capacity.max_buy",
  "capacity.max_sell",
  "capacity_left.max_buy",
  "capacity_left.max_sell",
];

function formatScalarValue(value: LogScalar) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return value;
}

export const LogViewer = memo(function LogViewer({
  hoveredTimestamp,
  logRecord,
}: LogViewerProps) {
  const prettyLog = useMemo(() => {
    if (logRecord === null) {
      return null;
    }

    try {
      return JSON.stringify(JSON.parse(logRecord.rawLambdaLog), null, 2);
    } catch {
      return logRecord.rawLambdaLog;
    }
  }, [logRecord]);

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

  const additionalEntries = useMemo(() => {
    if (logRecord === null) {
      return [];
    }

    const highlightedSet = new Set(PRIORITY_KEYS);
    return Object.entries(logRecord.flatValues)
      .filter(([key]) => !highlightedSet.has(key) && key !== "product" && key !== "timestamp")
      .sort(([left], [right]) => left.localeCompare(right));
  }, [logRecord]);

  if (logRecord === null) {
    return (
      <Paper className="surface-panel" p="lg" radius="xl" withBorder>
        <Stack gap="sm">
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Log Viewer
          </Text>
          <Title order={4}>No parsed log entry at this hover point.</Title>
          <Text c="dimmed" size="sm">
            Import an official IMC backtest `.log` file to inspect `lambdaLog` output
            synchronized to the hovered timestamp.
          </Text>
          {hoveredTimestamp !== null ? (
            <Text c="dimmed" size="xs">
              Current hover timestamp: {hoveredTimestamp}
            </Text>
          ) : null}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper className="surface-panel" p="lg" radius="xl" withBorder>
      <Stack gap="md">
        <Stack gap={4}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Log Viewer
          </Text>
          <Title order={3}>Timestamp {logRecord.timestamp}</Title>
          <Group gap="xs">
            <Badge color="violet" variant="light">
              {logRecord.product ?? "Unknown product"}
            </Badge>
            <Badge color="gray" variant="outline">
              {logRecord.sourceFile}
            </Badge>
            {logRecord.skipReason ? (
              <Badge color="yellow" variant="light">
                skip: {logRecord.skipReason}
              </Badge>
            ) : null}
          </Group>
        </Stack>

        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Position
            </Text>
            <Text className="mono" fw={600}>
              {formatScalarValue(logRecord.flatValues.position ?? null)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Orders
            </Text>
            <Text className="mono" fw={600}>
              {logRecord.orders.length}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Result count
            </Text>
            <Text className="mono" fw={600}>
              {formatScalarValue(logRecord.flatValues.result_order_count ?? null)}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text c="dimmed" size="xs">
              Source
            </Text>
            <Text className="mono" fw={600}>
              {logRecord.fileId.slice(0, 8)}
            </Text>
          </Stack>
        </SimpleGrid>

        {highlightedEntries.length > 0 ? (
          <>
            <Divider />
            <Stack gap="xs">
              <Text fw={600} size="sm">
                Key fields
              </Text>
              {highlightedEntries.map(([key, value]) => (
                <Group key={key} justify="space-between">
                  <Text c="dimmed" size="sm">
                    {key}
                  </Text>
                  <Text className="mono" fw={600} size="sm">
                    {formatScalarValue(value)}
                  </Text>
                </Group>
              ))}
            </Stack>
          </>
        ) : null}

        <Divider />

        <Stack gap="xs">
          <Text fw={600} size="sm">
            Orders
          </Text>
          {logRecord.orders.length === 0 ? (
            <Text c="dimmed" size="sm">
              No orders recorded in this log entry.
            </Text>
          ) : (
            logRecord.orders.map((order, index) => (
              <div className="trade-ladder-row" key={`${logRecord.id}:order:${index}`}>
                <div>
                  <Text fw={600} size="sm">
                    {order.side}
                  </Text>
                  <Text c="dimmed" size="xs">
                    qty {order.quantity}
                  </Text>
                </div>
                <Badge color={order.side === "BUY" ? "blue" : "red"} variant="light">
                  {order.price.toFixed(2)}
                </Badge>
              </div>
            ))
          )}
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600} size="sm">
            Parsed fields
          </Text>
          {additionalEntries.length === 0 ? (
            <Text c="dimmed" size="sm">
              No additional scalar fields were found.
            </Text>
          ) : (
            <ScrollArea.Autosize mah={180} offsetScrollbars>
              <Stack gap={6}>
                {additionalEntries.map(([key, value]) => (
                  <Group key={key} justify="space-between" wrap="nowrap">
                    <Text c="dimmed" size="sm">
                      {key}
                    </Text>
                    <Text className="mono" fw={600} size="sm">
                      {formatScalarValue(value)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text fw={600} size="sm">
            Raw lambdaLog
          </Text>
          <ScrollArea.Autosize mah={220} offsetScrollbars>
            <pre className="log-code-block">{prettyLog}</pre>
          </ScrollArea.Autosize>
        </Stack>
      </Stack>
    </Paper>
  );
});

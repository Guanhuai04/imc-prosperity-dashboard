import { Badge, Group, Paper, Stack, Text } from "@mantine/core";
import { IconAlertTriangle, IconCheck, IconFileAnalytics } from "@tabler/icons-react";
import type { FileSummary } from "../lib/types";

interface FileStatusCardProps {
  summary: FileSummary;
}

export function FileStatusCard({ summary }: FileStatusCardProps) {
  return (
    <Paper className="file-card" p="md" radius="lg" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <IconFileAnalytics size={16} />
            <Text fw={600} lineClamp={1} size="sm">
              {summary.fileName}
            </Text>
          </Group>
          <Badge
            color={
              summary.kind === "prices"
                ? "cyan"
                : summary.kind === "trades"
                  ? "orange"
                  : summary.kind === "log"
                    ? "violet"
                  : "gray"
            }
            variant="light"
          >
            {summary.kind}
          </Badge>
        </Group>

        <Group gap="xs">
          <Badge color="gray" variant="outline">
            {summary.rowCount} rows
          </Badge>
          {summary.dayValues.map((day) => (
            <Badge key={`${summary.fileId}:${day}`} color="grape" variant="outline">
              day {day}
            </Badge>
          ))}
        </Group>

        <Text c="dimmed" size="xs">
          {summary.products.length > 0 ? summary.products.join(", ") : "No recognized products"}
        </Text>

        <Group gap="xs">
          <Badge
            color={summary.hasOwnTrades ? "orange" : "gray"}
            leftSection={summary.hasOwnTrades ? <IconCheck size={12} /> : undefined}
            size="sm"
            variant="light"
          >
            {summary.hasOwnTrades ? "Own trades present" : "No SUBMISSION trades"}
          </Badge>
          <Badge
            color={summary.hasTraderIds ? "cyan" : "gray"}
            size="sm"
            variant="light"
          >
            {summary.hasTraderIds ? "Trader IDs present" : "No trader IDs"}
          </Badge>
        </Group>

        {summary.warnings.length > 0 ? (
          <Stack gap={4}>
            {summary.warnings.map((warning, index) => (
              <Group key={`${summary.fileId}:${index}:${warning}`} gap={6} wrap="nowrap">
                <IconAlertTriangle size={12} />
                <Text c="yellow.2" size="xs">
                  {warning}
                </Text>
              </Group>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

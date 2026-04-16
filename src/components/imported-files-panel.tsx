import { Badge, Group, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { memo } from "react";
import type { FileSummary } from "../lib/types";
import { FileStatusCard } from "./file-status-card";

interface ImportedFilesPanelProps {
  dayCount: number;
  fileSummaries: FileSummary[];
  maxQuantity: number;
  productCount: number;
}

export const ImportedFilesPanel = memo(function ImportedFilesPanel({
  dayCount,
  fileSummaries,
  maxQuantity,
  productCount,
}: ImportedFilesPanelProps) {
  return (
    <Paper className="surface-panel" h="100%" p="lg" radius="xl" withBorder>
      <Stack gap="md">
        <Stack gap={4}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Imported Files
          </Text>
          <Title order={3}>Audit the current session inputs.</Title>
        </Stack>

        <Group className="scope-chip-row" gap="sm">
          <Badge color="blue" variant="light">
            {productCount} products
          </Badge>
          <Badge color="grape" variant="light">
            {dayCount} day buckets
          </Badge>
          <Badge color="orange" variant="light">
            Max qty {maxQuantity}
          </Badge>
        </Group>

        {fileSummaries.length === 0 ? (
          <Text c="dimmed" size="sm">
            No CSV or log files imported yet.
          </Text>
        ) : (
          <ScrollArea.Autosize mah={520} offsetScrollbars>
            <Stack gap="sm">
              {fileSummaries.map((summary) => (
                <FileStatusCard key={summary.fileId} summary={summary} />
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Paper>
  );
});

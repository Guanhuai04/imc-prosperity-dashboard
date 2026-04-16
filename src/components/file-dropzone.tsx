import { Button, Group, Stack, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import {
  IconFileSpreadsheet,
  IconRefresh,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";

interface FileDropzoneProps {
  hasData: boolean;
  isLoading: boolean;
  onClear: () => void;
  onFilesSelected: (files: File[]) => void;
}

export function FileDropzone({
  hasData,
  isLoading,
  onClear,
  onFilesSelected,
}: FileDropzoneProps) {
  return (
    <Stack gap="md">
      <Dropzone
        disabled={isLoading}
        loading={isLoading}
        maxFiles={24}
        multiple
        onDrop={onFilesSelected}
        radius="xl"
        styles={{
          root: {
            background:
              "linear-gradient(180deg, rgba(15, 24, 37, 0.96), rgba(10, 16, 26, 0.98))",
            borderColor: "rgba(149, 186, 219, 0.18)",
            borderStyle: "dashed",
            minHeight: 210,
          },
        }}
      >
        <Stack align="center" gap="sm" justify="center" mih={180}>
          <IconUpload size={34} stroke={1.6} />
          <Text fw={700} size="lg">
            Import session files
          </Text>
          <Text c="dimmed" maw={320} size="sm" ta="center">
            Drop `prices*.csv`, `trades*.csv`, or official backtest `.log` files.
          </Text>
          <Group gap="xs">
            <IconFileSpreadsheet size={16} />
            <Text c="dimmed" size="xs">
              {isLoading ? "Parsing selected files..." : "CSV and official IMC log files"}
            </Text>
          </Group>
        </Stack>
      </Dropzone>

      <Group justify="space-between">
        <Button
          component="label"
          leftSection={<IconRefresh size={16} />}
          loading={isLoading}
          radius="xl"
          variant="default"
        >
          {isLoading ? "Parsing..." : "Browse files"}
          <input
            accept=".csv,.log,.json"
            hidden
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              if (files.length > 0) {
                onFilesSelected(files);
              }
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </Button>

        <Button
          color="red"
          disabled={!hasData}
          leftSection={<IconTrash size={16} />}
          radius="xl"
          variant="subtle"
          onClick={onClear}
        >
          Clear imported data
        </Button>
      </Group>
    </Stack>
  );
}

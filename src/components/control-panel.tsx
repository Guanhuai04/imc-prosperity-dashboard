import {
  Divider,
  MultiSelect,
  NumberInput,
  Paper,
  RangeSlider,
  Select,
  Slider,
  Stack,
  Group,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { memo } from "react";
import {
  BOOK_LEVEL_OPTIONS,
  INDICATOR_OPTIONS,
  NORMALIZATION_OPTIONS,
  TRADER_GROUPS,
} from "../lib/constants";
import { useDashboardStore } from "../store/dashboard-store";

export const ControlPanel = memo(function ControlPanel() {
  const fileSummaries = useDashboardStore((state) => state.fileSummaries);
  const products = useDashboardStore((state) => state.products);
  const days = useDashboardStore((state) => state.days);
  const logNumericKeys = useDashboardStore((state) => state.logNumericKeys);
  const quantityExtent = useDashboardStore((state) => state.quantityExtent);
  const selectedProduct = useDashboardStore((state) => state.selectedProduct);
  const selectedFileIds = useDashboardStore((state) => state.selectedFileIds);
  const selectedDays = useDashboardStore((state) => state.selectedDays);
  const selectedBookLevels = useDashboardStore((state) => state.selectedBookLevels);
  const selectedIndicators = useDashboardStore((state) => state.selectedIndicators);
  const selectedLogIndicators = useDashboardStore((state) => state.selectedLogIndicators);
  const normalization = useDashboardStore((state) => state.normalization);
  const quantityRange = useDashboardStore((state) => state.quantityRange);
  const maxVisibleQuotePoints = useDashboardStore((state) => state.maxVisibleQuotePoints);
  const minVolumeThreshold = useDashboardStore((state) => state.minVolumeThreshold);
  const showBookLevelCircles = useDashboardStore((state) => state.showBookLevelCircles);
  const showOrderBook = useDashboardStore((state) => state.showOrderBook);
  const showPublicTrades = useDashboardStore((state) => state.showPublicTrades);
  const showOwnTrades = useDashboardStore((state) => state.showOwnTrades);
  const setSelectedProduct = useDashboardStore((state) => state.setSelectedProduct);
  const setSelectedFileIds = useDashboardStore((state) => state.setSelectedFileIds);
  const setSelectedDays = useDashboardStore((state) => state.setSelectedDays);
  const setSelectedBookLevels = useDashboardStore((state) => state.setSelectedBookLevels);
  const setSelectedIndicators = useDashboardStore((state) => state.setSelectedIndicators);
  const setSelectedLogIndicators = useDashboardStore(
    (state) => state.setSelectedLogIndicators,
  );
  const setNormalization = useDashboardStore((state) => state.setNormalization);
  const setQuantityRange = useDashboardStore((state) => state.setQuantityRange);
  const setMaxVisibleQuotePoints = useDashboardStore(
    (state) => state.setMaxVisibleQuotePoints,
  );
  const setMinVolumeThreshold = useDashboardStore((state) => state.setMinVolumeThreshold);
  const setShowBookLevelCircles = useDashboardStore(
    (state) => state.setShowBookLevelCircles,
  );
  const setShowOrderBook = useDashboardStore((state) => state.setShowOrderBook);
  const setShowPublicTrades = useDashboardStore((state) => state.setShowPublicTrades);
  const setShowOwnTrades = useDashboardStore((state) => state.setShowOwnTrades);

  const knownFiles = fileSummaries.filter((summary) => summary.kind !== "unknown");
  const hasTraderIds = fileSummaries.some((summary) => summary.hasTraderIds);
  const traderGroupsConfigured = Object.keys(TRADER_GROUPS).length > 0;
  const [minQuantity, maxQuantity] = quantityRange;

  function handleQuantityBoundChange(
    index: 0 | 1,
    value: string | number,
  ) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return;
    }

    const nextRange: [number, number] =
      index === 0 ? [value, maxQuantity] : [minQuantity, value];
    setQuantityRange(nextRange);
  }

  return (
    <Paper className="surface-panel control-panel-frame" p="md" radius="xl" withBorder>
      <Stack gap="sm">
        <Stack gap={4}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            Selection Controls
          </Text>
          <Title order={3}>Filter the session and layer what matters.</Title>
        </Stack>

        <Stack gap="sm">
          <Select
            data={products.map((product) => ({ label: product, value: product }))}
            label="Product"
            nothingFoundMessage="Import a CSV or log file first"
            placeholder="Select a product"
            value={selectedProduct}
            onChange={setSelectedProduct}
          />

          <MultiSelect
            data={knownFiles.map((summary) => ({
              label: `${summary.fileName} (${summary.kind})`,
              value: summary.fileId,
            }))}
            label="Source files"
            placeholder="Use all imported files"
            value={selectedFileIds}
            onChange={setSelectedFileIds}
          />

          <MultiSelect
            data={days.map((day) => ({ label: `Day ${day}`, value: String(day) }))}
            label="Day buckets"
            placeholder="All detected days"
            value={selectedDays.map(String)}
            onChange={(values) => setSelectedDays(values.map(Number))}
          />

          <MultiSelect
            data={INDICATOR_OPTIONS}
            label="Overlay indicators"
            placeholder="Choose metrics to overlay"
            value={selectedIndicators}
            onChange={(values) =>
              setSelectedIndicators(values as typeof selectedIndicators)
            }
          />

          <MultiSelect
            data={logNumericKeys.map((indicator) => ({
              label: indicator,
              value: indicator,
            }))}
            label="Logged indicators"
            nothingFoundMessage="Import an official log file first"
            placeholder="Overlay parsed logger fields"
            searchable
            value={selectedLogIndicators}
            onChange={setSelectedLogIndicators}
          />

          <Select
            data={NORMALIZATION_OPTIONS}
            label="Normalization"
            value={normalization}
            onChange={(value) => setNormalization((value ?? "none") as typeof normalization)}
          />

          <Divider />

          <Stack gap="xs">
            <Text fw={600} size="sm">
              Display
            </Text>
            <Switch
              checked={showOrderBook}
              label="Show order book levels"
              onChange={(event) => setShowOrderBook(event.currentTarget.checked)}
            />
            <Switch
              checked={showBookLevelCircles}
              disabled={!showOrderBook}
              label="Show Bid 1 / Ask 1 circles"
              onChange={(event) => setShowBookLevelCircles(event.currentTarget.checked)}
            />
            <MultiSelect
              data={BOOK_LEVEL_OPTIONS}
              disabled={!showOrderBook}
              label="Order book levels"
              placeholder="Choose Bid / Ask 1, 2, 3"
              value={selectedBookLevels}
              onChange={(values) => setSelectedBookLevels(values as typeof selectedBookLevels)}
            />
            <Switch
              checked={showPublicTrades}
              label="Show public trades"
              onChange={(event) => setShowPublicTrades(event.currentTarget.checked)}
            />
            <Switch
              checked={showOwnTrades}
              label="Show own trades"
              onChange={(event) => setShowOwnTrades(event.currentTarget.checked)}
            />
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text fw={600} size="sm">
              Quantity filter
            </Text>
            <RangeSlider
              label={(value) => `${value}`}
              max={quantityExtent[1]}
              min={quantityExtent[0]}
              minRange={0}
              step={1}
              thumbSize={18}
              value={quantityRange}
              onChange={(value) => setQuantityRange(value as [number, number])}
            />
            <Group grow>
              <NumberInput
                hideControls
                label="Min qty"
                max={quantityExtent[1]}
                min={quantityExtent[0]}
                step={1}
                value={minQuantity}
                onChange={(value) => handleQuantityBoundChange(0, value)}
              />
              <NumberInput
                hideControls
                label="Max qty"
                max={quantityExtent[1]}
                min={quantityExtent[0]}
                step={1}
                value={maxQuantity}
                onChange={(value) => handleQuantityBoundChange(1, value)}
              />
            </Group>
            <Text c="dimmed" size="xs">
              Restrict visible trades to a size band. Useful when trader IDs are absent.
            </Text>
          </Stack>

          <Stack gap="xs">
            <Text fw={600} size="sm">
              Performance
            </Text>
            <Slider
              label={(value) => `${value} points`}
              marks={[
                { label: "1k", value: 1000 },
                { label: "4k", value: 4000 },
                { label: "8k", value: 8000 },
              ]}
              max={12000}
              min={1000}
              step={250}
              thumbSize={18}
              value={maxVisibleQuotePoints}
              onChange={setMaxVisibleQuotePoints}
            />
            <Slider
              label={(value) => `${value} lots`}
              marks={[
                { label: "0", value: 0 },
                { label: "10", value: 10 },
                { label: "25", value: 25 },
              ]}
              max={50}
              min={0}
              step={1}
              thumbSize={18}
              value={minVolumeThreshold}
              onChange={setMinVolumeThreshold}
            />
          </Stack>

          <Divider />

          <Stack gap="xs">
            <Text fw={600} size="sm">
              Trader grouping
            </Text>
            <Text c="dimmed" size="xs">
              {hasTraderIds && traderGroupsConfigured
                ? "Trader IDs are present and group mappings can be enabled in the constants file."
                : "Trader group filters are intentionally greyed out until buyer/seller IDs exist and mappings are configured."}
            </Text>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
});

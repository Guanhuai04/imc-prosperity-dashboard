import {
  Accordion,
  ActionIcon,
  Badge,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  RangeSlider,
  ScrollArea,
  Slider,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  UnstyledButton,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import {
  IconAlertTriangle,
  IconChartCandle,
  IconChevronDown,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { memo, useState } from "react";
import {
  BOOK_LEVEL_OPTIONS,
  INDICATOR_OPTIONS,
  NORMALIZATION_OPTIONS,
} from "../lib/constants";
import type { RunSummary } from "../lib/types";
import { useDashboardStore } from "../store/dashboard-store";

interface ControlPanelProps {
  importError: string | null;
  isLoading: boolean;
  runGroups: RunSummary[];
  warnings: string[];
  onImportSources: (files: File[]) => void;
  onRemoveRun: (groupId: string) => void;
}

export const ControlPanel = memo(function ControlPanel({
  importError,
  isLoading,
  runGroups,
  warnings,
  onImportSources,
  onRemoveRun,
}: ControlPanelProps) {
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
  const setSelectedLogIndicators = useDashboardStore((state) => state.setSelectedLogIndicators);
  const setNormalization = useDashboardStore((state) => state.setNormalization);
  const setQuantityRange = useDashboardStore((state) => state.setQuantityRange);
  const setMaxVisibleQuotePoints = useDashboardStore((state) => state.setMaxVisibleQuotePoints);
  const setMinVolumeThreshold = useDashboardStore((state) => state.setMinVolumeThreshold);
  const setShowBookLevelCircles = useDashboardStore((state) => state.setShowBookLevelCircles);
  const setShowOrderBook = useDashboardStore((state) => state.setShowOrderBook);
  const setShowPublicTrades = useDashboardStore((state) => state.setShowPublicTrades);
  const setShowOwnTrades = useDashboardStore((state) => state.setShowOwnTrades);

  const [minQuantity, maxQuantity] = quantityRange;
  const normalizationOptions = NORMALIZATION_OPTIONS.filter(
    (option) => option.value !== "bestBid" && option.value !== "bestAsk",
  );
  const [showParserNotices, setShowParserNotices] = useState(false);

  function isRunActive(group: RunSummary) {
    return (
      selectedFileIds.length === group.fileIds.length &&
      group.fileIds.every((fileId) => selectedFileIds.includes(fileId))
    );
  }

  function selectRun(group: RunSummary) {
    if (!isRunActive(group)) {
      setSelectedFileIds(group.fileIds);
    }
  }

  function selectDay(day: number) {
    if (selectedDays[0] !== day) {
      setSelectedDays([day]);
    }
  }

  function toggleOverlay(value: (typeof selectedIndicators)[number]) {
    if (selectedIndicators.includes(value)) {
      setSelectedIndicators(selectedIndicators.filter((indicator) => indicator !== value));
      return;
    }

    setSelectedIndicators([...selectedIndicators, value]);
  }

  function toggleBookLevel(value: (typeof selectedBookLevels)[number]) {
    if (selectedBookLevels.includes(value)) {
      setSelectedBookLevels(selectedBookLevels.filter((level) => level !== value));
      return;
    }

    setSelectedBookLevels([...selectedBookLevels, value]);
  }

  function handleQuantityBoundChange(index: 0 | 1, value: string | number) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return;
    }

    setQuantityRange(index === 0 ? [value, maxQuantity] : [minQuantity, value]);
  }

  return (
    <Paper className="surface-panel control-sidebar-frame" p="md" radius="xl" withBorder>
      <Stack className="control-sidebar-stack" gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon className="sidebar-brand-icon" radius="lg" size={42} variant="light">
            <IconChartCandle size={20} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg">
              Prosperity Dashboard
            </Text>
            <Text c="dimmed" size="xs">
              Round-time trading workspace
            </Text>
          </div>
        </Group>

        <Dropzone
          className="sidebar-upload-dropzone"
          disabled={isLoading}
          loading={isLoading}
          maxFiles={128}
          multiple
          onDrop={(files) => onImportSources(Array.from(files))}
          radius="xl"
        >
          <Stack align="center" className="sidebar-upload-stack" gap="sm" justify="center">
            <ThemeIcon className="sidebar-upload-icon" radius="xl" size={46} variant="light">
              <IconUpload size={22} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm" ta="center">
                {isLoading ? "Importing session data..." : "Upload Session Data"}
              </Text>
              <Text c="dimmed" className="sidebar-upload-copy" size="xs" ta="center">
                Click to choose files, or drag a data folder, zip archive, or official log into this area.
              </Text>
            </div>
          </Stack>
        </Dropzone>

        {importError ? (
          <Paper className="sidebar-inline-note sidebar-inline-note-error" p="sm" radius="lg" withBorder>
            <Text fw={600} size="xs">
              Import failed
            </Text>
            <Text c="dimmed" size="xs">
              {importError}
            </Text>
          </Paper>
        ) : null}


        <ScrollArea className="control-sidebar-scroll" offsetScrollbars>
          <Stack gap="lg">
            <Stack gap="sm">
              <Text className="sidebar-section-label">Runs</Text>

              {runGroups.length === 0 ? (
                <Text c="dimmed" size="xs">
                  Import a csv data folder, zip archive, or official log file to create runs.
                </Text>
              ) : (
                <Stack gap="xs">
                  {runGroups.map((group) => {
                    const active = isRunActive(group);
                    return (
                      <div key={group.groupId} className="sidebar-run-card-shell">
                        <UnstyledButton
                          className={active ? "sidebar-run-card sidebar-run-card-active" : "sidebar-run-card"}
                          onClick={() => selectRun(group)}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <div>
                              <Text fw={700} size="sm">{group.label}</Text>
                              <Text c="dimmed" size="xs">
                                {group.assetCount} assets · {group.tickCount.toLocaleString()} ticks
                              </Text>
                            </div>
                            <Badge
                              color={group.kind === "log" ? "violet" : group.kind === "archive" ? "orange" : "blue"}
                              radius="sm"
                              size="sm"
                              variant={active ? "filled" : "light"}
                            >
                              {group.kind === "log" ? "LOG" : group.kind === "archive" ? "ZIP" : "DATA"}
                            </Badge>
                          </Group>
                        </UnstyledButton>
                        <ActionIcon
                          aria-label={`Remove ${group.label}`}
                          className="sidebar-run-remove"
                          color="red"
                          radius="xl"
                          size="sm"
                          variant="subtle"
                          onClick={() => onRemoveRun(group.groupId)}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </div>
                    );
                  })}
                </Stack>
              )}
            </Stack>

            <Stack gap="sm">
              <Text className="sidebar-section-label">Products</Text>
              {products.length === 0 ? (
                <Text c="dimmed" size="xs">
                  Products will appear after a successful import.
                </Text>
              ) : (
                <Stack gap="xs">
                  {products.map((product) => (
                    <UnstyledButton
                      key={product}
                      className={selectedProduct === product ? "sidebar-product-pill sidebar-product-pill-active" : "sidebar-product-pill"}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <Text fw={600} size="sm">{product}</Text>
                    </UnstyledButton>
                  ))}
                </Stack>
              )}
            </Stack>

            {days.length > 1 ? (
              <Stack gap="sm">
                <Text className="sidebar-section-label">Days</Text>
                <Group gap="xs">
                  {days.map((day) => {
                    const active = selectedDays[0] === day;
                    return (
                      <UnstyledButton
                        key={day}
                        className={active ? "sidebar-mini-pill sidebar-mini-pill-active" : "sidebar-mini-pill"}
                        onClick={() => selectDay(day)}
                      >
                        <Text fw={600} size="xs">Day {day}</Text>
                      </UnstyledButton>
                    );
                  })}
                </Group>
              </Stack>
            ) : null}

            <Accordion
              chevronPosition="right"
              className="sidebar-accordion"
              defaultValue={["normalization", "indicators", "display"]}
              multiple
              variant="contained"
            >
              <Accordion.Item value="normalization">
                <Accordion.Control>Normalization</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Text className="sidebar-subsection-title">Price baseline</Text>
                    <Group gap="xs">
                      {normalizationOptions.map((option) => {
                        const active = normalization === option.value;
                        return (
                          <UnstyledButton
                            key={option.value}
                            className={active ? "sidebar-mini-pill sidebar-mini-pill-active" : "sidebar-mini-pill"}
                            onClick={() => setNormalization(option.value)}
                          >
                            <Text fw={600} size="xs">{option.label.replace(" Price", "")}</Text>
                          </UnstyledButton>
                        );
                      })}
                    </Group>
                    <Text c="dimmed" size="xs">
                      Align plotted prices around a single baseline to compare spread, premium, and mean-reversion behaviour.
                    </Text>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="indicators">
                <Accordion.Control>Indicators</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Stack gap={6}>
                      <Text className="sidebar-subsection-title">Price overlays</Text>
                      <Group gap="xs">
                        {INDICATOR_OPTIONS.map((indicator) => {
                          const active = selectedIndicators.includes(indicator.value);
                          return (
                            <UnstyledButton
                              key={indicator.value}
                              className={active ? "sidebar-mini-pill sidebar-mini-pill-active" : "sidebar-mini-pill"}
                              onClick={() => toggleOverlay(indicator.value)}
                            >
                              <Text fw={600} size="xs">{indicator.label}</Text>
                            </UnstyledButton>
                          );
                        })}
                      </Group>
                    </Stack>

                    {logNumericKeys.length > 0 ? (
                      <Stack gap={6}>
                        <Text className="sidebar-subsection-title">Logged overlays</Text>
                        <MultiSelect
                          data={logNumericKeys.map((indicator) => ({ label: indicator, value: indicator }))}
                          nothingFoundMessage="No parsed log fields"
                          placeholder="Choose logger metrics"
                          searchable
                          size="xs"
                          value={selectedLogIndicators}
                          onChange={setSelectedLogIndicators}
                        />
                      </Stack>
                    ) : null}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="display">
                <Accordion.Control>Display</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Switch checked={showOrderBook} label="Order book" size="sm" onChange={(event) => setShowOrderBook(event.currentTarget.checked)} />
                    <Switch checked={showBookLevelCircles} disabled={!showOrderBook} label="Bid1/Ask1 circles" size="sm" onChange={(event) => setShowBookLevelCircles(event.currentTarget.checked)} />
                    <Switch checked={showPublicTrades} label="Public trades" size="sm" onChange={(event) => setShowPublicTrades(event.currentTarget.checked)} />
                    <Switch checked={showOwnTrades} label="Own trades" size="sm" onChange={(event) => setShowOwnTrades(event.currentTarget.checked)} />

                    <Divider />

                    <Group gap="xs">
                      {BOOK_LEVEL_OPTIONS.map((level) => {
                        const active = selectedBookLevels.includes(level.value);
                        return (
                          <UnstyledButton
                            key={level.value}
                            className={active ? "sidebar-mini-pill sidebar-mini-pill-active" : "sidebar-mini-pill"}
                            onClick={() => toggleBookLevel(level.value)}
                          >
                            <Text fw={600} size="xs">{level.label}</Text>
                          </UnstyledButton>
                        );
                      })}
                    </Group>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="filters">
                <Accordion.Control>Filters</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <RangeSlider
                      label={(value) => `${value}`}
                      max={quantityExtent[1]}
                      min={quantityExtent[0]}
                      minRange={0}
                      step={1}
                      thumbSize={16}
                      value={quantityRange}
                      onChange={(value) => setQuantityRange(value as [number, number])}
                    />
                    <Group grow>
                      <NumberInput hideControls label="Min qty" max={quantityExtent[1]} min={quantityExtent[0]} size="xs" value={minQuantity} onChange={(value) => handleQuantityBoundChange(0, value)} />
                      <NumberInput hideControls label="Max qty" max={quantityExtent[1]} min={quantityExtent[0]} size="xs" value={maxQuantity} onChange={(value) => handleQuantityBoundChange(1, value)} />
                    </Group>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>

              <Accordion.Item value="performance">
                <Accordion.Control>Performance</Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Slider
                      label={(value) => `${value} points`}
                      marks={[{ label: "1k", value: 1000 }, { label: "4k", value: 4000 }, { label: "8k", value: 8000 }]}
                      max={12000}
                      min={1000}
                      step={250}
                      thumbSize={16}
                      value={maxVisibleQuotePoints}
                      onChange={setMaxVisibleQuotePoints}
                    />
                    <Slider
                      label={(value) => `${value} lots`}
                      marks={[{ label: "0", value: 0 }, { label: "10", value: 10 }, { label: "25", value: 25 }]}
                      max={50}
                      min={0}
                      step={1}
                      thumbSize={16}
                      value={minVolumeThreshold}
                      onChange={setMinVolumeThreshold}
                    />

                    {warnings.length > 0 ? (
                      <Paper className="sidebar-inline-note sidebar-notice-panel" p="xs" radius="lg" withBorder>
                        <UnstyledButton
                          className="sidebar-notice-toggle"
                          onClick={() => setShowParserNotices((current) => !current)}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <Group gap={8} wrap="nowrap">
                              <IconAlertTriangle size={14} />
                              <Text fw={600} size="xs">
                                Parser notices
                              </Text>
                            </Group>
                            <Group gap="xs" wrap="nowrap">
                              <Badge color="yellow" radius="xl" size="sm" variant="light">
                                {warnings.length}
                              </Badge>
                              <IconChevronDown
                                className={
                                  showParserNotices
                                    ? "sidebar-notice-chevron sidebar-notice-chevron-open"
                                    : "sidebar-notice-chevron"
                                }
                                size={14}
                              />
                            </Group>
                          </Group>
                        </UnstyledButton>
                        {showParserNotices ? (
                          <Stack className="sidebar-notice-list" gap={6} mt="sm">
                            {warnings.map((warning) => (
                              <Text key={warning} c="dimmed" className="sidebar-notice-item" size="xs">
                                {warning}
                              </Text>
                            ))}
                          </Stack>
                        ) : null}
                      </Paper>
                    ) : null}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Stack>
        </ScrollArea>


      </Stack>
    </Paper>
  );
});







import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Collapse,
  Container,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconChevronDown } from "@tabler/icons-react";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ControlPanel } from "./components/control-panel";
import { FileDropzone } from "./components/file-dropzone";
import { HoverSnapshot } from "./components/hover-snapshot";
import { ImportedFilesPanel } from "./components/imported-files-panel";
import { LogViewer } from "./components/log-viewer";
import { MainChart } from "./components/main-chart";
import { MiniSeriesChart } from "./components/mini-series-chart";
import { COLORS } from "./lib/constants";
import { parseImportedFiles } from "./lib/csv";
import {
  buildPnlSeries,
  buildPositionSeries,
  classifyTrades,
  filterLogs,
  filterSnapshots,
  filterTrades,
  findNearestLogRecord,
  findNearestPoint,
  findNearestSnapshot,
  findTradesAtTimestamp,
} from "./lib/derived";
import { useDashboardStore } from "./store/dashboard-store";

export function App() {
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [warningsExpanded, setWarningsExpanded] = useState(false);

  const priceSnapshots = useDashboardStore((state) => state.priceSnapshots);
  const tradeRecords = useDashboardStore((state) => state.tradeRecords);
  const logRecords = useDashboardStore((state) => state.logRecords);
  const fileSummaries = useDashboardStore((state) => state.fileSummaries);
  const products = useDashboardStore((state) => state.products);
  const days = useDashboardStore((state) => state.days);
  const warnings = useDashboardStore((state) => state.warnings);
  const quantityExtent = useDashboardStore((state) => state.quantityExtent);
  const selectedProduct = useDashboardStore((state) => state.selectedProduct);
  const selectedFileIds = useDashboardStore((state) => state.selectedFileIds);
  const selectedDays = useDashboardStore((state) => state.selectedDays);
  const selectedIndicators = useDashboardStore((state) => state.selectedIndicators);
  const selectedLogIndicators = useDashboardStore((state) => state.selectedLogIndicators);
  const normalization = useDashboardStore((state) => state.normalization);
  const hoveredTimestamp = useDashboardStore((state) => state.hoveredTimestamp);
  const visibleRange = useDashboardStore((state) => state.visibleRange);
  const addImportedBatch = useDashboardStore((state) => state.addImportedBatch);
  const clearAllData = useDashboardStore((state) => state.clearAllData);
  const setHoveredTimestamp = useDashboardStore((state) => state.setHoveredTimestamp);
  const setVisibleRange = useDashboardStore((state) => state.setVisibleRange);

  const filteredSnapshots = useMemo(
    () =>
      filterSnapshots(priceSnapshots, {
        selectedDays,
        selectedFileIds,
        selectedProduct,
      }),
    [priceSnapshots, selectedDays, selectedFileIds, selectedProduct],
  );

  const filteredTrades = useMemo(
    () =>
      filterTrades(tradeRecords, {
        knownProducts: products,
        selectedDays,
        selectedFileIds,
        selectedProduct,
      }),
    [tradeRecords, products, selectedDays, selectedFileIds, selectedProduct],
  );

  const filteredLogRecords = useMemo(
    () =>
      filterLogs(logRecords, {
        selectedDays,
        selectedFileIds,
        selectedProduct,
      }),
    [logRecords, selectedDays, selectedFileIds, selectedProduct],
  );

  const deferredSnapshots = useDeferredValue(filteredSnapshots);
  const deferredTrades = useDeferredValue(filteredTrades);
  const deferredLogRecords = useDeferredValue(filteredLogRecords);

  const classifiedTrades = useMemo(
    () => classifyTrades(deferredTrades, deferredSnapshots),
    [deferredTrades, deferredSnapshots],
  );

  const pnlSeries = useMemo(() => buildPnlSeries(deferredSnapshots), [deferredSnapshots]);
  const positionSeries = useMemo(
    () => buildPositionSeries(deferredTrades),
    [deferredTrades],
  );

  const nearestSnapshot = useMemo(
    () => findNearestSnapshot(deferredSnapshots, hoveredTimestamp),
    [deferredSnapshots, hoveredTimestamp],
  );

  const tradesAtHover = useMemo(
    () =>
      findTradesAtTimestamp(
        classifiedTrades,
        nearestSnapshot?.timestamp ?? hoveredTimestamp,
      ),
    [classifiedTrades, nearestSnapshot, hoveredTimestamp],
  );

  const pnlPointAtHover = useMemo(
    () => findNearestPoint(pnlSeries.points, nearestSnapshot?.timestamp ?? hoveredTimestamp),
    [pnlSeries.points, nearestSnapshot, hoveredTimestamp],
  );

  const positionPointAtHover = useMemo(
    () =>
      findNearestPoint(positionSeries.points, nearestSnapshot?.timestamp ?? hoveredTimestamp),
    [positionSeries.points, nearestSnapshot, hoveredTimestamp],
  );

  const nearestLogRecord = useMemo(
    () => findNearestLogRecord(deferredLogRecords, nearestSnapshot?.timestamp ?? hoveredTimestamp),
    [deferredLogRecords, nearestSnapshot, hoveredTimestamp],
  );

  useEffect(() => {
    if (!deferredSnapshots.length) {
      return;
    }

    const currentHover = useDashboardStore.getState().hoveredTimestamp;
    const hasActiveHover =
      currentHover !== null &&
      findNearestSnapshot(deferredSnapshots, currentHover)?.timestamp === currentHover;

    if (!hasActiveHover) {
      setHoveredTimestamp(deferredSnapshots[0].timestamp);
    }
  }, [deferredSnapshots, setHoveredTimestamp]);

  useEffect(() => {
    setWarningsExpanded(false);
  }, []);

  async function handleFilesSelected(files: File[]) {
    setImportError(null);
    setIsImporting(true);

    try {
      const parsedBatch = await parseImportedFiles(files);
      startTransition(() => {
        addImportedBatch(parsedBatch);
      });
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to parse the selected CSV files.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  const hasData = fileSummaries.length > 0;
  const warningCountLabel =
    warnings.length === 1 ? "1 parser notice" : `${warnings.length} parser notices`;
  const warningSummary = warnings.every((warning) =>
    warning.includes("usable order-book levels"),
  )
    ? "Mostly rows without usable order-book levels."
    : "Import notices and skipped rows are available.";

  return (
    <Box className="app-shell">
      <Box className="background-grid" />
      <Container fluid px="lg" py="lg" size="xl">
        <Stack gap="lg">
          <Paper className="hero-panel" p="xl" radius="xl" withBorder>
            <div className="hero-grid">
              <Stack className="hero-copy" gap="md">
                <Text className="hero-kicker">IMC Prosperity Dashboard</Text>
                <Title order={1} className="hero-title">
                  Prosperity dashboard.
                </Title>
                <Text c="dimmed" className="hero-subtitle" size="md">
                  Upload prices, trades, and official backtest log files to inspect
                  quotes, trades, PnL, positions, and lambda logs in one workspace.
                </Text>
              </Stack>

              <Box className="hero-dropzone">
                <FileDropzone
                  hasData={hasData}
                  isLoading={isImporting}
                  onClear={clearAllData}
                  onFilesSelected={handleFilesSelected}
                />
              </Box>
            </div>
          </Paper>

          {importError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              radius="lg"
              title="Import error"
              variant="light"
            >
              {importError}
            </Alert>
          ) : null}

          {warnings.length > 0 ? (
            <Paper className="warning-strip" p="sm" radius="xl" withBorder>
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <ThemeIcon className="warning-strip-icon" color="yellow" radius="xl" size={36} variant="light">
                      <IconAlertCircle size={18} />
                    </ThemeIcon>
                    <Stack gap={0}>
                      <Text fw={700} size="sm">
                        {warningCountLabel}
                      </Text>
                      <Text c="dimmed" size="xs">
                        {warningSummary}
                      </Text>
                    </Stack>
                  </Group>

                  <Group gap="xs" wrap="nowrap">
                    <Badge color="yellow" radius="xl" variant="light">
                      {warnings.length}
                    </Badge>
                    <ActionIcon
                      aria-label={warningsExpanded ? "Collapse warnings" : "Expand warnings"}
                      className={warningsExpanded ? "warning-toggle warning-toggle-open" : "warning-toggle"}
                      color="yellow"
                      radius="xl"
                      variant="light"
                      onClick={() => setWarningsExpanded((open) => !open)}
                    >
                      <IconChevronDown size={16} />
                    </ActionIcon>
                  </Group>
                </Group>

                <Collapse expanded={warningsExpanded}>
                  <Stack gap={6} mt="xs">
                    {warnings.map((warning, index) => (
                      <Text className="warning-line" key={`${index}:${warning}`} size="sm">
                        {warning}
                      </Text>
                    ))}
                  </Stack>
                </Collapse>
              </Stack>
            </Paper>
          ) : null}

          <Grid align="stretch" className="page-grid top-dashboard-grid" gap="lg">
            <Grid.Col className="main-column-col" span={{ base: 12, xl: 8.35 }}>
              <Stack className="main-column-stack" gap="lg">
                <MainChart
                  isBusy={isImporting}
                  logRecords={deferredLogRecords}
                  normalization={normalization}
                  selectedIndicators={selectedIndicators}
                  selectedLogIndicators={selectedLogIndicators}
                  selectedProduct={selectedProduct}
                  snapshots={deferredSnapshots}
                  trades={classifiedTrades}
                  visibleRange={visibleRange}
                  onHoverTimestampChange={setHoveredTimestamp}
                  onVisibleRangeChange={setVisibleRange}
                />

                <Grid className="mini-panels-grid" gap="lg">
                  <Grid.Col className="mini-panel-col" span={{ base: 12, md: 6 }}>
                    <MiniSeriesChart
                      accentColor={COLORS.pnl}
                      description={
                        pnlSeries.isAllZero
                          ? "All-zero public PnL series. The panel stays visible to preserve layout."
                          : "Product PnL series pulled from the price snapshots."
                      }
                      hoveredTimestamp={hoveredTimestamp}
                      label={
                        pnlPointAtHover
                          ? `${pnlPointAtHover.value.toFixed(2)} shells`
                          : pnlSeries.isAllZero
                            ? "0.00 shells"
                            : "No PnL point"
                      }
                      points={pnlSeries.points}
                      statusBadge={pnlSeries.isAllZero ? "All-zero public data" : undefined}
                      title="PnL Panel"
                      onHoverTimestampChange={setHoveredTimestamp}
                    />
                  </Grid.Col>
                  <Grid.Col className="mini-panel-col" span={{ base: 12, md: 6 }}>
                    <MiniSeriesChart
                      accentColor={COLORS.position}
                      description="Net position reconstructed from trades where buyer or seller is SUBMISSION."
                      emptyState={
                        positionSeries.hasData
                          ? undefined
                          : "Current files do not contain SUBMISSION trades for this product."
                      }
                      hoveredTimestamp={hoveredTimestamp}
                      label={
                        positionPointAtHover
                          ? `${positionPointAtHover.value.toFixed(0)} lots`
                          : "No position data"
                      }
                      points={positionSeries.points}
                      title="Position Panel"
                      onHoverTimestampChange={setHoveredTimestamp}
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Grid.Col>

            <Grid.Col className="sidebar-column-col" span={{ base: 12, xl: 3.65 }}>
              <Stack className="sidebar-stack" gap="lg">
                <ControlPanel />
              </Stack>
            </Grid.Col>
          </Grid>

          <Grid className="page-grid" gap="lg">
            <Grid.Col span={{ base: 12, xl: 4 }}>
              <HoverSnapshot
                hoveredTimestamp={hoveredTimestamp}
                indicators={selectedIndicators}
                normalization={normalization}
                pnlPoint={pnlPointAtHover}
                positionPoint={positionPointAtHover}
                snapshots={deferredSnapshots}
                trades={tradesAtHover}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 4 }}>
              <LogViewer
                hoveredTimestamp={hoveredTimestamp}
                logRecord={nearestLogRecord}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 4 }}>
              <ImportedFilesPanel
                dayCount={days.length}
                fileSummaries={fileSummaries}
                maxQuantity={quantityExtent[1]}
                productCount={products.length}
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}

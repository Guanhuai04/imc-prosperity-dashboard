import { Box, Grid, Stack } from "@mantine/core";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ControlPanel } from "./components/control-panel";
import { InspectorSidebar } from "./components/inspector-sidebar";
import { MainChart } from "./components/main-chart";
import { MiniSeriesChart } from "./components/mini-series-chart";
import { COLORS } from "./lib/constants";
import { parseImportedFiles } from "./lib/csv";
import { buildImportSourceGroups } from "./lib/import-sources";
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
import type { ImportedDataset, RunSummary, SourceGroupKind } from "./lib/types";
import { useDashboardStore } from "./store/dashboard-store";

interface PendingRunGroup {
  files: File[];
  id: string;
  kind: SourceGroupKind;
  label: string;
}

function summarizeRunGroup(group: PendingRunGroup, batch: ImportedDataset): RunSummary {
  const tickCount = Math.max(
    batch.priceSnapshots.length,
    batch.logRecords.length,
    batch.tradeRecords.length,
    ...batch.fileSummaries.map((summary) => summary.rowCount),
  );

  return {
    assetCount: batch.products.length,
    dayValues: batch.days,
    fileCount: batch.fileSummaries.length,
    fileIds: batch.fileSummaries.map((summary) => summary.fileId),
    groupId: group.id,
    kind: group.kind,
    label: group.label,
    tickCount,
    warningCount: batch.warnings.length,
  };
}

function mergeRunGroups(existing: RunSummary[], incoming: RunSummary[]) {
  const merged = new Map(existing.map((group) => [group.groupId, group]));

  for (const group of incoming) {
    merged.set(group.groupId, group);
  }

  return Array.from(merged.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export function App() {
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [runGroups, setRunGroups] = useState<RunSummary[]>([]);

  const priceSnapshots = useDashboardStore((state) => state.priceSnapshots);
  const tradeRecords = useDashboardStore((state) => state.tradeRecords);
  const logRecords = useDashboardStore((state) => state.logRecords);
  const fileSummaries = useDashboardStore((state) => state.fileSummaries);
  const products = useDashboardStore((state) => state.products);
  const warnings = useDashboardStore((state) => state.warnings);
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
  const setSelectedFileIds = useDashboardStore((state) => state.setSelectedFileIds);
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
  const positionSeries = useMemo(() => buildPositionSeries(deferredTrades), [deferredTrades]);

  const nearestSnapshot = useMemo(
    () => findNearestSnapshot(deferredSnapshots, hoveredTimestamp),
    [deferredSnapshots, hoveredTimestamp],
  );

  const tradesAtHover = useMemo(
    () => findTradesAtTimestamp(classifiedTrades, nearestSnapshot?.timestamp ?? hoveredTimestamp),
    [classifiedTrades, nearestSnapshot, hoveredTimestamp],
  );

  const pnlPointAtHover = useMemo(
    () => findNearestPoint(pnlSeries.points, nearestSnapshot?.timestamp ?? hoveredTimestamp),
    [pnlSeries.points, nearestSnapshot, hoveredTimestamp],
  );

  const positionPointAtHover = useMemo(
    () => findNearestPoint(positionSeries.points, nearestSnapshot?.timestamp ?? hoveredTimestamp),
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
    if (fileSummaries.length === 0) {
      setRunGroups([]);
      setImportError(null);
    }
  }, [fileSummaries.length]);

  async function importRunGroups(groups: PendingRunGroup[]) {
    if (groups.length === 0) {
      setImportError("No supported files were found in the selected import source.");
      return;
    }

    setImportError(null);
    setIsImporting(true);

    try {
      const parsed = await Promise.all(
        groups.map(async (group) => ({
          batch: await parseImportedFiles(group.files),
          group,
        })),
      );

      startTransition(() => {
        for (const { batch } of parsed) {
          addImportedBatch(batch);
        }

        setRunGroups((current) =>
          mergeRunGroups(
            current,
            parsed.map(({ batch, group }) => summarizeRunGroup(group, batch)),
          ),
        );

        const focusedRun = parsed[0]?.batch.fileSummaries
          .filter((summary) => summary.kind !== "unknown")
          .map((summary) => summary.fileId);

        if (focusedRun && focusedRun.length > 0) {
          setSelectedFileIds(focusedRun);
        }
      });
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to parse the selected import source.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleImportSources(files: File[]) {
    const groups = await buildImportSourceGroups(files);
    await importRunGroups(groups);
  }

  function handleClearSession() {
    setRunGroups([]);
    setImportError(null);
    clearAllData();
  }

  return (
    <Box className="app-shell">
      <Box className="background-grid" />
      <Box className="workspace-shell">
        <ControlPanel
          hasData={fileSummaries.length > 0}
          importError={importError}
          isLoading={isImporting}
          runGroups={runGroups}
          warnings={warnings}
          onClear={handleClearSession}
          onImportSources={(files) => {
            void handleImportSources(files);
          }}
        />

        <Box className="workspace-main">
          <Stack gap="md">
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

            <Grid className="mini-panels-grid compact-mini-panels">
              <Grid.Col className="mini-panel-col" span={{ base: 12, md: 6 }}>
                <MiniSeriesChart
                  accentColor={COLORS.pnl}
                  description={
                    pnlSeries.isAllZero
                      ? "All-zero public PnL series."
                      : "Product PnL from the filtered snapshots."
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
                  description="Net position reconstructed from SUBMISSION trades."
                  emptyState={
                    positionSeries.hasData
                      ? undefined
                      : "No SUBMISSION trades are available for this product."
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
        </Box>

        <InspectorSidebar
          hoveredTimestamp={hoveredTimestamp}
          indicators={selectedIndicators}
          logRecord={nearestLogRecord}
          normalization={normalization}
          pnlPoint={pnlPointAtHover}
          positionPoint={positionPointAtHover}
          snapshots={deferredSnapshots}
          trades={tradesAtHover}
        />
      </Box>
    </Box>
  );
}

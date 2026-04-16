import { Paper, Stack, Text, Title } from "@mantine/core";
import type { Data, Layout, PlotHoverEvent } from "plotly.js";
import { memo, useEffect, useMemo, useRef } from "react";
import type { MetricPoint } from "../lib/types";
import { Plot } from "./plot";

interface MiniSeriesChartProps {
  accentColor: string;
  description: string;
  emptyState?: string;
  hoveredTimestamp: number | null;
  label: string;
  points: MetricPoint[];
  statusBadge?: string;
  title: string;
  onHoverTimestampChange: (timestamp: number | null) => void;
}

export const MiniSeriesChart = memo(function MiniSeriesChart({
  accentColor,
  description,
  emptyState,
  hoveredTimestamp,
  label,
  points,
  statusBadge,
  title,
  onHoverTimestampChange,
}: MiniSeriesChartProps) {
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<number | null>(null);
  const lastHoveredTimestampRef = useRef<number | null>(hoveredTimestamp);

  useEffect(() => {
    lastHoveredTimestampRef.current = hoveredTimestamp;
  }, [hoveredTimestamp]);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }
    },
    [],
  );

  const trace = useMemo(
    () =>
      [
        {
          hovertemplate: `${title}<br>t=%{x}<br>value=%{y:.2f}<extra></extra>`,
          line: {
            color: accentColor,
            width: 2,
          },
          mode: "lines",
          name: title,
          type: "scattergl",
          x: points.map((point) => point.timestamp),
          y: points.map((point) => point.value),
        },
      ] satisfies Data[],
    [accentColor, points, title],
  );

  const layout = useMemo(
    () =>
      ({
        autosize: true,
        font: {
          color: "#e8eef7",
          family: '"IBM Plex Mono", monospace',
          size: 11,
        },
        margin: {
          b: 36,
          l: 40,
          r: 12,
          t: 20,
        },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(5, 11, 18, 0.8)",
        shapes:
          hoveredTimestamp === null
            ? []
            : [
                {
                  line: {
                    color: "rgba(118, 171, 255, 0.34)",
                    dash: "dot",
                    width: 1.15,
                  },
                  type: "line",
                  x0: hoveredTimestamp,
                  x1: hoveredTimestamp,
                  xref: "x",
                  y0: 0,
                  y1: 1,
                  yref: "paper",
                },
              ],
        xaxis: {
          color: "#9fb2c8",
          gridcolor: "rgba(158, 184, 214, 0.11)",
          title: {
            text: "Timestamp",
          },
          zeroline: false,
        },
        yaxis: {
          color: "#9fb2c8",
          gridcolor: "rgba(158, 184, 214, 0.11)",
          zeroline: false,
        },
      }) satisfies Partial<Layout>,
    [hoveredTimestamp],
  );

  return (
    <Paper className="surface-panel mini-chart-frame" p="lg" radius="xl" withBorder>
      <Stack gap="sm">
        <Stack gap={4}>
          <Text c="dimmed" fw={600} size="xs" tt="uppercase">
            {title}
          </Text>
          <Title order={4}>{label}</Title>
          <Text c="dimmed" size="sm">
            {statusBadge ? `${description} ${statusBadge}.` : description}
          </Text>
        </Stack>

        {emptyState ? (
          <Stack gap="xs" justify="center" mih={170}>
            <Text c="dimmed" size="sm">
              {emptyState}
            </Text>
          </Stack>
        ) : (
          <div className="plot-wrapper">
            <Plot
              config={{
                displayModeBar: false,
                displaylogo: false,
                responsive: true,
              }}
              data={trace}
              layout={layout}
              style={{ height: "180px", width: "100%" }}
              useResizeHandler
              onHover={(event: Readonly<PlotHoverEvent>) => {
                const xValue = event.points[0]?.x;
                if (typeof xValue !== "number" || xValue === pendingHoverRef.current) {
                  return;
                }

                pendingHoverRef.current = xValue;
                if (hoverFrameRef.current !== null) {
                  return;
                }

                hoverFrameRef.current = window.requestAnimationFrame(() => {
                  hoverFrameRef.current = null;
                  const nextTimestamp = pendingHoverRef.current;
                  pendingHoverRef.current = null;

                  if (
                    typeof nextTimestamp === "number" &&
                    nextTimestamp !== lastHoveredTimestampRef.current
                  ) {
                    lastHoveredTimestampRef.current = nextTimestamp;
                    onHoverTimestampChange(nextTimestamp);
                  }
                });
              }}
            />
          </div>
        )}
      </Stack>
    </Paper>
  );
});


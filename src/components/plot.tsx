import type { ComponentType } from "react";
import createPlotlyComponentModule from "react-plotly.js/factory.js";
import { PlotlyLib } from "../lib/plotly";

type PlotComponentFactory = (plotly: unknown) => ComponentType<Record<string, unknown>>;

const createPlotlyComponent =
  (
    createPlotlyComponentModule as unknown as {
      default?: PlotComponentFactory;
    }
  ).default ??
  (createPlotlyComponentModule as unknown as PlotComponentFactory);

export const Plot = createPlotlyComponent(PlotlyLib as unknown);

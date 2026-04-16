import PlotlyModule from "plotly.js-dist-min";
import type { Data, Layout } from "plotly.js";

type PlotlyLibrary = {
  purge: (root: HTMLElement) => void;
  react: (
    root: HTMLElement,
    data: Data[],
    layout?: Partial<Layout>,
    config?: Record<string, unknown>,
  ) => Promise<void> | void;
};

export const PlotlyLib =
  ((PlotlyModule as unknown as { default?: PlotlyLibrary }).default ??
    PlotlyModule) as unknown as PlotlyLibrary;

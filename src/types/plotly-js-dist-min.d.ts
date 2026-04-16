declare module "plotly.js-dist-min" {
  import type { PlotlyHTMLElement } from "plotly.js";

  const Plotly: unknown & {
    react?: (...args: unknown[]) => Promise<PlotlyHTMLElement | void>;
    newPlot?: (...args: unknown[]) => Promise<PlotlyHTMLElement | void>;
    purge?: (...args: unknown[]) => void;
  };

  export default Plotly;
}

import { createTheme } from "@mantine/core";

export const theme = createTheme({
  defaultRadius: "lg",
  fontFamily: '"Space Grotesk", sans-serif',
  fontFamilyMonospace: '"IBM Plex Mono", monospace',
  fontSizes: {
    xs: "0.72rem",
    sm: "0.82rem",
    md: "0.92rem",
    lg: "1rem",
    xl: "1.08rem",
  },
  headings: {
    fontFamily: '"Space Grotesk", sans-serif',
    fontWeight: "700",
    sizes: {
      h1: { fontSize: "2.25rem", lineHeight: "1.04" },
      h2: { fontSize: "1.7rem", lineHeight: "1.08" },
      h3: { fontSize: "1.3rem", lineHeight: "1.12" },
      h4: { fontSize: "1.04rem", lineHeight: "1.16" },
      h5: { fontSize: "0.94rem", lineHeight: "1.2" },
      h6: { fontSize: "0.86rem", lineHeight: "1.24" },
    },
  },
});

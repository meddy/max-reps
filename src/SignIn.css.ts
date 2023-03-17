import { style, keyframes } from "@vanilla-extract/css";

export const container = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  flexDirection: "column",
});

export const email = style({
  marginRight: "0.5rem",
});

const loadingFlicker = keyframes({
  "0%": { opacity: 1 },
  "50%": { opacity: 0.75 },
  "100%": { opacity: 0.5 },
});

export const loading = style({
  animationName: loadingFlicker,
  animationDuration: "0.5s",
  animationIterationCount: "infinite",
});

export const message = style({
  marginBottom: "1rem",
});

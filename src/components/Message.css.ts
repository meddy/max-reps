import { keyframes, style } from "@vanilla-extract/css";

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

export const error = style({
  color: "red",
});

export const message = style({
  marginBottom: "1rem",
});

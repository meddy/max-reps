import { createContext } from "react";

let currentErrorMessage = null;

export function handleError(error: string | Error) {
  console.error(error);
  currentErrorMessage =
    typeof error === "string" ? error : "Something went wrong. Try again later";
}

export function dismissError() {
  currentErrorMessage = null;
}

export const ErrorContext = createContext({
  error: "",
  setError: (error: string) => {
    console.error(error);
    return;
  },
});

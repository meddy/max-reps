import {
  useQueryClient,
  useQueryErrorResetBoundary,
} from "@tanstack/react-query";
import { ReactElement } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { getSession } from "../supabase/api";
import Message from "./Message";
import SignIn from "./SignIn";
import SignOut from "./SignOut";

export interface ErrorBoundaryProps {
  children: ReactElement;
}

export default function AppErrorBoundary(props: ErrorBoundaryProps) {
  const { children } = props;
  const { reset } = useQueryErrorResetBoundary();
  const queryClient = useQueryClient();

  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ resetErrorBoundary }) => {
        const hasSession = queryClient
          .getQueryCache()
          .find<Awaited<ReturnType<typeof getSession>>>(["session"])?.state
          .data?.session;

        return (
          <>
            <Message isError />
            <button onClick={resetErrorBoundary}>Refresh</button>
            {hasSession ? <SignOut /> : <SignIn />}
          </>
        );
      }}
      onError={(error) => console.error(error)}
    >
      {children}
    </ErrorBoundary>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const VISIBILITY_REFETCH_MIN_MS = 60_000;
const VISIBILITY_DEBOUNCE_MS = 300;

export type RemoteLoadContext = {
  background: boolean;
  /** Clear the foreground spinner before load() finishes (e.g. progressive list) */
  setForegroundLoading: (loading: boolean) => void;
  /** True when a newer load has started — skip applying stale results */
  isStale: () => boolean;
};

export type UseRemoteLoadOptions = {
  load: (ctx: RemoteLoadContext) => Promise<void>;
  /** When false, skip auto-run and visibility handler. Default: !authLoading && !!user */
  enabled?: boolean;
  /** Stale-tab recovery; debounced, 60s freshness window */
  refetchOnVisibility?: boolean;
  /** If true, skip full-page loading spinner and suppress loadError on failure */
  hasData?: () => boolean;
  /** Re-run load when these change (in addition to load identity) */
  deps?: readonly unknown[];
};

export type ReloadOptions = {
  background?: boolean;
};

export function useRemoteLoad({
  load,
  enabled: enabledProp,
  refetchOnVisibility = false,
  hasData,
  deps = [],
}: UseRemoteLoadOptions) {
  const { user, loading: authLoading } = useAuth();
  const enabled = enabledProp ?? (!authLoading && user != null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGenerationRef = useRef(0);
  const visibilityTimerRef = useRef<number | null>(null);
  const lastFetchAtRef = useRef(0);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const hasDataRef = useRef(hasData);
  hasDataRef.current = hasData;
  const loadRef = useRef(load);
  loadRef.current = load;

  const runLoad = useCallback(
    async (opts?: ReloadOptions) => {
      if (loadInFlightRef.current) {
        return loadInFlightRef.current;
      }

      const generation = ++loadGenerationRef.current;
      const background = opts?.background ?? hasDataRef.current?.() ?? false;

      if (!background) {
        setLoading(true);
      }
      setLoadError(null);

      const setForegroundLoading = (value: boolean) => {
        if (generation !== loadGenerationRef.current || background) return;
        setLoading(value);
      };
      const isStale = () => generation !== loadGenerationRef.current;

      const run = async () => {
        try {
          if (user) {
            try {
              await user.getIdToken(true);
            } catch {
              /* token refresh best-effort */
            }
          }

          await loadRef.current({
            background,
            setForegroundLoading,
            isStale,
          });
          if (isStale()) return;
          lastFetchAtRef.current = Date.now();
        } catch (err) {
          if (generation !== loadGenerationRef.current) return;
          const message = err instanceof Error ? err.message : String(err);
          if (!background) {
            setLoadError(message);
          }
        } finally {
          if (generation === loadGenerationRef.current) {
            setLoading(false);
          }
        }
      };

      loadInFlightRef.current = run();
      try {
        await loadInFlightRef.current;
      } finally {
        loadInFlightRef.current = null;
      }
    },
    [user]
  );

  const reload = useCallback(
    (opts?: ReloadOptions) => runLoad(opts),
    [runLoad]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is caller-controlled
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void runLoad();
  }, [enabled, runLoad, ...deps]);

  useEffect(() => {
    if (!refetchOnVisibility || !enabled) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !user) {
        return;
      }
      if (visibilityTimerRef.current != null) {
        window.clearTimeout(visibilityTimerRef.current);
      }
      visibilityTimerRef.current = window.setTimeout(() => {
        void (async () => {
          const ageMs = Date.now() - lastFetchAtRef.current;
          if (lastFetchAtRef.current > 0 && ageMs < VISIBILITY_REFETCH_MIN_MS) {
            return;
          }
          await runLoad({ background: true });
        })();
      }, VISIBILITY_DEBOUNCE_MS);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (visibilityTimerRef.current != null) {
        window.clearTimeout(visibilityTimerRef.current);
      }
    };
  }, [refetchOnVisibility, enabled, runLoad, user]);

  return {
    loading: authLoading || loading,
    loadError,
    reload,
  };
}

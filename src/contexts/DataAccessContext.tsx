import { createContext, useContext, useMemo, type ReactNode } from "react";
import { type DataAccess } from "../lib/dataAccess";
import { getDefaultDataAccess } from "../lib/productionDataAccess";

const DataAccessContext = createContext<DataAccess | null>(null);

export function DataAccessProvider({
  children,
  value,
}: {
  children: ReactNode;
  /** Test override: supply a fake `DataAccess` instead of the app singleton. */
  value?: DataAccess;
}) {
  const resolved = useMemo(() => value ?? getDefaultDataAccess(), [value]);
  return (
    <DataAccessContext.Provider value={resolved}>
      {children}
    </DataAccessContext.Provider>
  );
}

export function useDataAccess(): DataAccess {
  const ctx = useContext(DataAccessContext);
  if (ctx == null) {
    throw new Error("useDataAccess must be used within DataAccessProvider");
  }
  return ctx;
}

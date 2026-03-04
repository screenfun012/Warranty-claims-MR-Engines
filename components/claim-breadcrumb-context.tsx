"use client";

import * as React from "react";

type ClaimBreadcrumbContextValue = {
  label: string | null;
  setLabel: (label: string | null) => void;
};

const ClaimBreadcrumbContext = React.createContext<ClaimBreadcrumbContextValue | null>(null);

export function ClaimBreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = React.useState<string | null>(null);
  const value = React.useMemo(() => ({ label, setLabel }), [label]);
  return (
    <ClaimBreadcrumbContext.Provider value={value}>
      {children}
    </ClaimBreadcrumbContext.Provider>
  );
}

export function useClaimBreadcrumb() {
  const ctx = React.useContext(ClaimBreadcrumbContext);
  return ctx ?? { label: null, setLabel: () => {} };
}

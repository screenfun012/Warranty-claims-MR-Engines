"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds - data is fresh for 30 seconds (6x duže)
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            refetchOnWindowFocus: false, // Don't refetch on window focus
            refetchOnReconnect: false, // Don't refetch on reconnect (optimizacija)
            retry: (failureCount, error) => {
              // Ne retry-uj ako je 401 (unauthorized) ili 204 (no content) - korisnik nije ulogovan
              if (error && typeof error === 'object' && 'status' in error) {
                const status = error.status as number;
                if (status === 401 || status === 204) {
                  return false;
                }
              }
              return failureCount < 1; // Retry other errors once
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

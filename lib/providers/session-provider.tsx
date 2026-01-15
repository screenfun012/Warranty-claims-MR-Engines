"use client";

import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { ReactNode } from "react";

export function SessionProvider({ children }: { children: ReactNode }) {
  return <Auth0Provider>{children}</Auth0Provider>;
}

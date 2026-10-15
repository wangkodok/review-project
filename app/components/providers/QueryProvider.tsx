"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Fragment, useCallback, useState, type ReactNode } from "react";
import AuthSessionLifecycle from "../auth/AuthSessionLifecycle";

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [authRevision, setAuthRevision] = useState(0);
  const resetAuthViews = useCallback(() => setAuthRevision((revision) => revision + 1), []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionLifecycle onIdentityChange={resetAuthViews} />
      <Fragment key={authRevision}>{children}</Fragment>
    </QueryClientProvider>
  );
}

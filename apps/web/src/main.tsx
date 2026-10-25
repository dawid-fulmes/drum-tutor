import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { meQueryKey } from "./features/auth/auth.api";
import { createQueryClient } from "./lib/query-client";
import { createAppRouter } from "./router";

// The router needs the query client, and the 401 handler needs the router: close over a later assignment.
// Clearing the cache before the screen unmounts would make its mounted queries refetch (another 401, another
// redirect), so mark the session as gone, navigate, and clear afterwards; parallel 401s share one redirect.
let redirecting = false;
const queryClient = createQueryClient({
  onUnauthenticated: () => {
    if (redirecting) return;
    redirecting = true;
    queryClient.setQueryData(meQueryKey, null);
    router
      .navigate({ to: "/login" })
      .catch((error: unknown) => console.error("Redirect to /login failed", error))
      .finally(() => {
        queryClient.clear();
        redirecting = false;
      });
  },
});
const router = createAppRouter(queryClient);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

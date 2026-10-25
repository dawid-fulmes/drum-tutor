import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createQueryClient } from "./lib/query-client";
import { createAppRouter } from "./router";

// The router needs the query client, and the 401 handler needs the router: close over a later assignment.
const queryClient = createQueryClient({
  onUnauthenticated: () => {
    queryClient.clear();
    void router.navigate({ to: "/login" });
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

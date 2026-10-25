import { MutationObserver, onlineManager, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { savePracticeLogOptions } from "./practice-logs.api";

describe("savePracticeLogOptions", () => {
  afterEach(() => onlineManager.setOnline(true));

  // A paused mutation would leave the panel on "Saving…" and send the log later, even after
  // the user chose to leave (ADR-0045); the panel's own retry policy must see the failure.
  it("fails instead of pausing while the browser is offline", async () => {
    onlineManager.setOnline(false);
    const client = new QueryClient();
    const observer = new MutationObserver(client, {
      ...savePracticeLogOptions(client),
      mutationFn: () => Promise.reject(new ApiClientError(0, "NETWORK_ERROR", "offline")),
    });
    const settled = observer.mutate(undefined as never).then(
      () => "resolved",
      () => "rejected",
    );
    const outcome = await Promise.race([
      settled,
      new Promise((resolve) => setTimeout(() => resolve("paused"), 200)),
    ]);
    expect(outcome).toBe("rejected");
  });
});

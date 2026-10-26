import type { PracticeLog, PracticeLogInput } from "@drum-tutor/contracts";
import { MutationObserver, onlineManager, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  // US-12 → US-13: the first saved session unlocks rating, so the lesson page must refetch
  // `canRate` without a reload (spec §7.5).
  it("invalidates the logged lesson's detail next to the stats after a save", async () => {
    const lessonId = "8f2c1a4e-4b7d-4c1e-9a3f-2d5e6f7a8b9c";
    const input: PracticeLogInput = {
      idempotencyKey: "0b6f1d2e-3c4a-4b5c-8d6e-7f8a9b0c1d2e",
      lessonId,
      durationSeconds: 30,
      tempoBpm: 90,
      completedAt: "2026-10-26T10:00:00.000Z",
      localDate: "2026-10-26",
    };
    const { idempotencyKey: _, ...logged } = input;
    const log: PracticeLog = { id: "1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a", ...logged };
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const observer = new MutationObserver(client, {
      ...savePracticeLogOptions(client),
      mutationFn: () => Promise.resolve(log),
    });

    await observer.mutate(input);

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["lessons", "library", "detail", lessonId],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["stats"] });
  });
});

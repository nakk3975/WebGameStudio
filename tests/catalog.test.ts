import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPublishedCase } from "../apps/ghostdesk/src/catalog";
import { sample } from "../apps/ghostdesk/src/sample";

afterEach(() => vi.unstubAllGlobals());
describe("published catalog boundary", () => {
  it("accepts a compatible package and never sends browser credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(sample)));
    vi.stubGlobal("fetch", fetch);
    expect(
      await loadPublishedCase("https://example.test/", sample.versionId),
    ).toEqual(sample);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(sample.versionId),
      expect.objectContaining({ credentials: "omit" }),
    );
  });
  it("rejects an unsupported schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...sample, schemaVersion: 2 })),
        ),
    );
    await expect(
      loadPublishedCase("https://example.test", sample.versionId),
    ).rejects.toThrow();
  });
  it("rejects a different version instead of replacing the pinned case", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...sample, versionId: "another" })),
        ),
    );
    await expect(
      loadPublishedCase("https://example.test", sample.versionId),
    ).rejects.toThrow("version mismatch");
  });
  it("rejects server failure so the caller keeps its bundled fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );
    await expect(
      loadPublishedCase("https://example.test", sample.versionId),
    ).rejects.toThrow("503");
  });
});

describe("portable cancellation and offline fallback boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("loads without AbortSignal.any or timeout static helpers", async () => {
    vi.spyOn(AbortSignal, "any").mockImplementation(() => {
      throw Error("unsupported");
    });
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      throw Error("unsupported");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(sample))),
    );
    await expect(
      loadPublishedCase("https://example.test", sample.versionId),
    ).resolves.toEqual(sample);
  });
  it("forwards cancellation from the caller", async () => {
    const caller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const result = loadPublishedCase(
      "https://example.test",
      sample.versionId,
      caller.signal,
    );
    const assertion = expect(result).rejects.toThrow("Aborted");
    caller.abort();
    await assertion;
  });
  it("times out a stalled response and cleans up its timer", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("Timed out", "AbortError")),
            );
          }),
      ),
    );
    const result = loadPublishedCase("https://example.test", sample.versionId);
    const assertion = expect(result).rejects.toThrow("Timed out");
    await vi.advanceTimersByTimeAsync(12000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("fails safely on a lost network connection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(
      loadPublishedCase("https://example.test", sample.versionId),
    ).rejects.toThrow("Failed to fetch");
  });
});

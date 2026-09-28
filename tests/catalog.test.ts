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

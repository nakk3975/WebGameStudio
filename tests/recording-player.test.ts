// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CCTVPlayer } from "../apps/ghostdesk/src/RecordingPlayer";
import { mediaAttachments } from "../apps/ghostdesk/src/case-media";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount() {
  const item = mediaAttachments.find((m) => m.id === "stage-output-meter")!;
  await act(async () =>
    root.render(createElement(CCTVPlayer, { item, paused: false })),
  );
  return host.querySelector("video")!;
}

it("keeps the timestamp on the displayed frame when the playback clock differs", async () => {
  const pending = new Map<number, VideoFrameRequestCallback>();
  let id = 0;
  const request = vi.fn((callback: VideoFrameRequestCallback) => {
    pending.set(++id, callback);
    return id;
  });
  const cancel = vi.fn((handle: number) => pending.delete(handle));
  // jsdom has no decoder; reproduce the observed browser clock/frame mismatch.
  Object.defineProperties(HTMLVideoElement.prototype, {
    requestVideoFrameCallback: { configurable: true, value: request },
    cancelVideoFrameCallback: { configurable: true, value: cancel },
  });
  try {
    const video = await mount();
    video.currentTime = 9.917966;
    const present = async (mediaTime: number) => {
      const [handle, callback] = [...pending][0];
      pending.delete(handle);
      await act(async () =>
        callback(0, { mediaTime } as VideoFrameCallbackMetadata),
      );
    };
    await present(10);
    for (const event of ["timeupdate", "pause", "seeked"])
      await act(async () => video.dispatchEvent(new Event(event)));
    expect(host.querySelector(".cctv-stamp")?.textContent).toBe(
      "제어기 21:57:00",
    );
    // A backward seek shows the newly presented frame, not a cached timestamp.
    video.currentTime = 1.9;
    await act(async () => video.dispatchEvent(new Event("seeking")));
    await present(2);
    await act(async () => video.dispatchEvent(new Event("seeked")));
    expect(host.querySelector(".cctv-stamp")?.textContent).toBe(
      "제어기 21:56:52",
    );
    await act(async () => root.render(null));
    expect(cancel).toHaveBeenCalledWith(id);
    expect(pending.size).toBe(0);
  } finally {
    Reflect.deleteProperty(
      HTMLVideoElement.prototype,
      "requestVideoFrameCallback",
    );
    Reflect.deleteProperty(
      HTMLVideoElement.prototype,
      "cancelVideoFrameCallback",
    );
  }
});

it("keeps playback-clock timestamps usable without video-frame callbacks", async () => {
  const video = await mount();
  video.currentTime = 2;
  await act(async () => video.dispatchEvent(new Event("timeupdate")));
  expect(host.querySelector(".cctv-stamp")?.textContent).toBe(
    "제어기 21:56:52",
  );
});

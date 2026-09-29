// Playback is continuous; quarter-second controls only help navigation.
export const RECORDING_FPS = 24;
export const CCTV_DURATION = 28;
export const CCTV_PERIOD = 12;
export const CCTV_INTERVAL = 0.25;
export const cctvSample = (time: number) =>
  Math.max(
    0,
    Math.min(
      CCTV_DURATION * RECORDING_FPS - 1,
      Math.round((Number.isFinite(time) ? time : 0) * RECORDING_FPS),
    ),
  ) / RECORDING_FPS;
export const cctvFrameIndex = (time: number) =>
  Math.round(cctvSample(time) * RECORDING_FPS) % (CCTV_PERIOD * RECORDING_FPS);
export function repeatAnswer(times: number[]) {
  if (
    times.length !== 2 ||
    times.some((t) => !Number.isFinite(t) || t < 0 || t >= CCTV_DURATION)
  )
    return "";
  const gap = Math.abs(
    Math.round(times[0] * RECORDING_FPS) - Math.round(times[1] * RECORDING_FPS),
  );
  const cycles = Math.round(gap / (CCTV_PERIOD * RECORDING_FPS));
  // One decoded-frame tolerance for a click during native playback.
  if (!cycles || Math.abs(gap - cycles * CCTV_PERIOD * RECORDING_FPS) > 1)
    return "different-scenes";
  return String(cycles * CCTV_PERIOD);
}
export function auctionObservationAnswer(
  disconnected: number | null,
  closed: number | null,
) {
  if (
    disconnected === null ||
    closed === null ||
    !Number.isFinite(disconnected) ||
    !Number.isFinite(closed)
  )
    return "";
  // Require both actual changes, not arbitrary moments seven seconds apart.
  return disconnected >= 2 &&
    disconnected <= 2.3 &&
    closed >= 9 &&
    closed <= 9.3
    ? "7"
    : "different-events";
}
export type CapturedFrame = { time: number; src: string };
export const recordingTime = (seconds: number) => {
  const value = Math.max(0, seconds);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${(value % 60).toFixed(2).padStart(5, "0")}`;
};

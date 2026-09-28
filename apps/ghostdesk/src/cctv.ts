import first from "./assets/hotel.webp";
import middle from "./assets/hotel-frame-middle.webp";
import exit from "./assets/hotel-frame-exit.webp";
import video from "./assets/hotel-cctv.mp4";

export const CCTV_DURATION = 28;
export const CCTV_INTERVAL = 4;
export const cctvFrames = [first, middle, exit];
export const cctvVideo = video;
export const cctvSample = (time: number) =>
  Math.min(24, Math.max(0, Math.floor(time / CCTV_INTERVAL) * CCTV_INTERVAL));
export const cctvFrameIndex = (time: number) =>
  (cctvSample(time) / CCTV_INTERVAL) % 3;
export function repeatAnswer(times: number[]) {
  if (
    times.length !== 2 ||
    times.some((t) => !Number.isFinite(t) || t < 0 || t >= CCTV_DURATION)
  )
    return "";
  const [a, b] = times.map(cctvSample);
  if (a === b || cctvFrameIndex(a) !== cctvFrameIndex(b))
    return "different-scenes";
  return String(Math.abs(a - b));
}
export const hotelClip = {
  id: "hotel-cctv",
  src: first,
  title: "CAM-404 · 복도 기록",
  video,
  alt: "4초 간격의 장면을 이어 붙인 재현 기록. 카트는 안쪽 문 앞에서 복도 바닥을 따라 화면 아래쪽 가까운 곳으로 다가옵니다. 뒤쪽 구간의 카트 위치와 시트 모양을 앞쪽 구간과 비교할 수 있습니다.",
  caption:
    "4초 간격의 장면 재현입니다. 연속 촬영 영상이 아니라 장면 전체를 재구성해 이어 붙였습니다.",
};

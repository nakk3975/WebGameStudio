import first from "./assets/hotel-motion-0.webp";
import middle from "./assets/hotel-motion-4.webp";
import near from "./assets/hotel-motion-8.webp";
import video from "./assets/hotel-motion.mp4";
import type { CaseMedia } from "./case-media";
import {
  cctvFrameIndex,
  CCTV_DURATION,
  CCTV_INTERVAL,
} from "./recording-timing";
export {
  CCTV_DURATION,
  CCTV_INTERVAL,
  cctvSample,
  cctvFrameIndex,
  repeatAnswer,
} from "./recording-timing";
// Only fallback reference moments. Normal captures use actual decoded frames.
export const cctvFrames = [first, middle, near];
export const cctvVideo = video;
export const hotelClip: CaseMedia = {
  id: "hotel-cctv",
  src: first,
  title: "CAM-404 · 복도 기록",
  video,
  alt: "차갑고 어두운 복도에 일부 천장등만 켜져 있습니다. 가까운 쪽부터 왼쪽은 401·403·405·407호, 오른쪽은 402·404·406·408호입니다. 공사 덮개 바깥으로 돌출된 객실 표지판이 보입니다. 수평을 맞춘 고정 카메라 앞에서 카트가 바퀴를 굴리며 곧게 다가옵니다. 뒤쪽 구간에서 앞서 본 움직임이 다시 나타나는지 비교하세요.",
  caption:
    "복도와 카트의 위치 변화를 재현했습니다. 사람의 동작은 복원하지 않았어요. 원본 사진은 별도로 확인할 수 있어요.",
  recording: {
    duration: CCTV_DURATION,
    step: CCTV_INTERVAL,
    label: "3D 재현 영상",
    live: true,
    stamp: (t) => `원본 06-12 14:32 · F-${8821 + cctvFrameIndex(t)}`,
  },
};

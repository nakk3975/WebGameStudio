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
  alt: "어두운 호텔 복도. 가까운 쪽부터 왼쪽은 401·403·405·407호, 오른쪽은 402·404·406·408호이며 번호는 객실 문에 붙어 있습니다. 404호 문이 조금 열려 있고, 그 뒤쪽 벽의 공사 구역에 노란 덮개가 있습니다. 흰 옷과 모자를 쓴 인물이 시트 카트를 밀며 카메라 쪽으로 걸어와 화면 밖으로 나갑니다. 12초부터 같은 이동이 다시 나타납니다.",
  caption: "CAM-404 · 프런트 보관 영상",
  recording: {
    duration: CCTV_DURATION,
    step: CCTV_INTERVAL,
    label: "프런트 보관 영상",
    live: true,
    stamp: (t) => `원본 06-12 14:32 · F-${8821 + cctvFrameIndex(t)}`,
  },
};

// One decoded recording frame is shared by the photo viewer and date puzzle.
export const hotelStill: CaseMedia = {
  id: "hotel-corridor-still",
  src: first,
  title: "CAM-404_정지화면.webp",
  alt: "CAM-404 첫 장면. 흰 옷과 모자를 쓴 인물이 시트 카트 뒤에 서 있습니다. 404호 문은 조금 열려 있으며, 그 뒤쪽 벽면 공사 구역에 노란 덮개가 있습니다.",
  caption: "CAM-404 영상에서 추출한 정지 화면 · 06-12 14:32 · F-8821",
};

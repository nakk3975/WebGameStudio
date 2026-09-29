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
  alt: "어두운 호텔 복도. 가까운 쪽부터 왼쪽은 401·403·405·407호, 오른쪽은 402·404·406·408호이며 번호는 객실 문에 붙어 있습니다. 404호 문이 조금 열려 있고, 그 뒤쪽 벽의 공사 구역에 노란 덮개가 있습니다. 흰 옷과 모자를 쓴 인물이 시트 카트를 밀며 카메라 쪽으로 걸어와 화면 밖으로 나갑니다. 뒤쪽 구간에서 앞서 본 움직임이 다시 나타나는지 비교하세요.",
  caption:
    "프런트에 남은 복도 기록. 인물과 카트의 이동, 객실 문, 화면 구석의 원본 표시를 함께 살펴보세요. 같은 기록의 정지 화면은 ‘사진 자료’에 보관되어 있습니다.",
  observations: [
    {
      label: "원본 기록",
      text: "06-12 14:32 / F-8821부터 시작하는 기록입니다.",
    },
    {
      label: "404호 문",
      text: "문에 404 표지가 붙어 있고, 문틈이 조금 열려 있습니다.",
    },
    {
      label: "복도 우측",
      text: "404호와 406호 사이 벽면 공사 구역에 노란 덮개가 있습니다.",
    },
    {
      label: "흰 형체",
      text: "흰 옷과 모자를 쓴 인물이 접힌 시트가 실린 카트를 밀고 있습니다. 이 모습만으로 신원을 확인할 수는 없습니다.",
    },
  ],
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
  observations: hotelClip.observations,
};

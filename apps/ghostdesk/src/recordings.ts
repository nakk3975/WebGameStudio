import type { CaseMedia } from "./case-media";
import stageVideo from "./assets/stage-cues.mp4";
import stagePoster from "./assets/stage-cues.webp";
import auctionVideo from "./assets/auction-monitor.mp4";
import auctionPoster from "./assets/auction-monitor.webp";
import receiverVideo from "./assets/island-receiver.mp4";
import receiverPoster from "./assets/island-receiver.webp";

const clock = (seconds: number) => {
  const t = Math.floor(seconds);
  return `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
export const stageClip: CaseMedia = {
  id: "stage-cues",
  src: stagePoster,
  video: stageVideo,
  title: "무대 조명 기록",
  caption: "공연 제어기 · 조명 실행 순서",
  alt: "닫힌 붉은 커튼과 중앙 마이크가 있는 빈 소공연장. 무대 뒤 통로의 주황빛, 중앙의 파란빛, 객석 방향의 흰빛, 통로 안전 표시의 붉은빛이 차례로 밝아졌다가 사라집니다. 초록빛은 나타나지 않습니다.",
  recording: {
    duration: 14,
    step: 0.25,
    label: "조명 순서 재현 · 시간 간격 축약",
    stamp: () => "공연 제어기 · 실행 구간",
  },
};
export const auctionClip: CaseMedia = {
  id: "auction-monitor",
  src: auctionPoster,
  video: auctionVideo,
  title: "전광판 감시 기록",
  caption: "전광판 감시 단말 · 21:59:51–22:00:01",
  alt: "21:59:51에 시작합니다. 처음에는 MOTH 옆 작은 접속 불빛과 OPEN 표시가 보입니다. 경과 2초에 접속 불빛이 꺼지고, 경과 9초에 OPEN이 CLOSED로 바뀝니다. MOTH와 310 표시는 남아 있습니다.",
  recording: {
    duration: 11,
    step: 0.25,
    label: "전광판 기록 재현",
    // The 11s endpoint holds frame 263 (10 + 23/24 seconds), not a new frame.
    stamp: (t) =>
      `서버 시각 ${clock(21 * 3600 + 59 * 60 + 51 + Math.min(t, 11 - 1 / 24))}`,
  },
};
export const receiverClip: CaseMedia = {
  id: "island-receiver",
  src: receiverPoster,
  video: receiverVideo,
  title: "야간 수신기 기록",
  caption: "야간 수신기 · 독립 배터리",
  alt: "별도 배터리를 연결한 수신기. 불빛이 짧게 세 번, 긴 쉼, 길게 세 번, 긴 쉼, 다시 짧게 세 번 켜집니다. 한 번의 긴 불빛은 짧은 불빛의 세 배 길이입니다.",
  recording: {
    duration: 11,
    step: 0.125,
    label: "수신 신호 재현",
    stamp: () => "독립 배터리 · 야간 수신기",
  },
};

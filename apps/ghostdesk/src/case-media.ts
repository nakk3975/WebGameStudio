import type { CasePackage } from "../../../packages/contracts/src";
import { canOpen, type State } from "../../../packages/engine-ghostdesk/src";
import { isOfficialCaseVersion, isResolutionCase } from "./cases";
import labReceipts from "./assets/lab-receipts.webp";
import labNetwork from "./assets/lab-network.webp";
import hotelFrontdesk from "./assets/hotel-frontdesk.webp";
import hotelLaundry from "./assets/hotel-laundry.webp";
import auctionEnvelopes from "./assets/auction-envelopes.webp";
import auctionSeals from "./assets/auction-seals.webp";
import auctionDisplay from "./assets/auction-monitor-9.webp";
import stageConsole from "./assets/stage-console.webp";
import stageCorridor from "./assets/stage-corridor.webp";
import islandRope from "./assets/island-rope.webp";
import islandBuoy from "./assets/island-buoy.webp";
import { stageClip, auctionClip, receiverClip } from "./recordings";
import { hotelStill } from "./cctv";
import labChapter from "./assets/lab-chapter.webp";
import hotelChapter from "./assets/hotel-chapter.webp";
import auctionChapter from "./assets/auction-chapter.webp";
import stageChapter from "./assets/stage-chapter.webp";
import islandChapter from "./assets/island-chapter.webp";
import outputMeter from "./assets/stage-output-meter.mp4";
import outputPoster from "./assets/stage-output-meter.webp";

export type CaseMedia = {
  id: string;
  src: string;
  title: string;
  alt: string;
  caption: string;
  video?: string;
  recording?: {
    duration: number;
    step: number;
    label: string;
    live?: boolean;
    stamp: (time: number) => string;
  };
  observations?: { label: string; text: string }[];
};
type Attachment = CaseMedia & {
  caseId: string;
  sourceIds: string[];
  versionIds?: string[];
};

// Presentation-only attachments: published packages and saved answers stay immutable.
export const mediaAttachments: Attachment[] = [
  ...[
    [
      "demo-0317",
      labChapter,
      "내부 보관함 인덱스",
      "6b",
      "A: TX-0917, 2048 B, 7C21. B: TX-0917, 2048 B, 9A06. C: TX-0920, 2048 B, 7C21.",
    ],
    [
      "hotel-404",
      hotelChapter,
      "카메라 대체 입력표",
      "6a",
      "A: CAM-402, 06-12, 12초. B: CAM-404, 09-27, 20초. C: CAM-404, 06-12, 12초.",
    ],
    [
      "auction-seven",
      auctionChapter,
      "작품 포장 대조표",
      "6b",
      "상자 A: LOT-26, 푸른 궤도, 60×80. 상자 B: LOT-27, 푸른 궤도, 60×80. 상자 C: LOT-27, 푸른 궤도, 50×70. 단위는 cm이며 입찰 봉투와 별개입니다.",
    ],
    [
      "encore-last",
      stageChapter,
      "음향 출력 연결도",
      "7a",
      "보컬과 비상 트랙은 B1을 통해 객석으로, 인터컴은 B2를 통해 스태프 헤드셋으로 갑니다. 안내 파일은 선택한 버스로 갑니다.",
    ],
    [
      "monday-loop",
      islandChapter,
      "독립 기록의 보관 위치",
      "6b",
      "관측 PC는 건물 전원과 복원되는 작업 목록을 사용합니다. 부표는 독립 배터리와 부표 기록함을 사용합니다. 통신 중계기는 독립 배터리와 중계기 접수 원장을 사용합니다.",
    ],
  ].map(([caseId, src, title, stage, alt]) => ({
    id: `${caseId}-chapter-image`,
    caseId,
    src,
    title,
    alt,
    sourceIds: [`${caseId}-record-${stage}`],
    versionIds: [`${caseId}-v5`, `${caseId}-v6`],
    caption: title,
  })),
  {
    id: "stage-output-meter",
    caseId: "encore-last",
    src: outputPoster,
    video: outputMeter,
    sourceIds: ["encore-last-record-9b"],
    versionIds: ["encore-last-v5", "encore-last-v6"],
    title: "두 출력 버스 기록",
    caption: "음향 제어기 · 21:56:50–21:57:00",
    alt: "21:56:50 시작. 21:56:51~54에는 B2 스태프 헤드셋에 NOTICE-02 신호가 나타납니다. 21:56:52부터는 B1 객석에 REHEARSAL-06 신호가 나타납니다. 이 구간의 B1에는 NOTICE-02가 없습니다.",
    recording: {
      duration: 11,
      step: 0.1,
      label: "출력계 기록 재현 · 실제 시간 간격",
      stamp: (t) => {
        // The final decoded frame is 21:57:00, even at the 11s end marker.
        const s = 50 + Math.min(10, Math.floor(t));
        return `제어기 21:${String(56 + Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      },
    },
  },
  {
    ...hotelStill,
    caseId: "hotel-404",
    sourceIds: ["hotel-404-f3"],
  },
  {
    ...stageClip,
    caseId: "encore-last",
    sourceIds: ["encore-last-f1"],
    versionIds: ["encore-last-v4", "encore-last-v5", "encore-last-v6"],
  },
  {
    ...auctionClip,
    caseId: "auction-seven",
    sourceIds: ["auction-seven-record-4"],
    versionIds: ["auction-seven-v4", "auction-seven-v5", "auction-seven-v6"],
  },
  {
    ...receiverClip,
    caseId: "monday-loop",
    sourceIds: ["monday-loop-f1"],
    versionIds: ["monday-loop-v4", "monday-loop-v5", "monday-loop-v6"],
  },
  {
    id: "lab-receipts",
    caseId: "demo-0317",
    src: labReceipts,
    sourceIds: ["demo-0317-record-2", "demo-0317-record-5"],
    title: "접수표 보관 책상",
    alt: "문서함 앞 책상에 나란히 놓인 접수표 세 장.",
    caption: "기록 보관실 · 접수표 보관 책상",
  },
  {
    id: "lab-network",
    caseId: "demo-0317",
    src: labNetwork,
    sourceIds: ["demo-0317-record-3", "demo-0317-record-4"],
    title: "통신 장비 점검",
    alt: "작은 장비함의 통신 장치와 책상 위 분리된 연결선.",
    caption: "03:20 · 통신 장비함 점검",
  },
  {
    id: "hotel-frontdesk",
    caseId: "hotel-404",
    src: hotelFrontdesk,
    sourceIds: ["hotel-404-f0"],
    title: "야간 프런트",
    alt: "조명이 켜진 호텔 프런트와 뒤편의 객실 열쇠 보관대.",
    caption: "야간 프런트 · 열쇠 보관대",
  },
  {
    id: "hotel-laundry",
    caseId: "hotel-404",
    src: hotelLaundry,
    sourceIds: ["hotel-404-record-4", "hotel-404-record-5", "hotel-404-f5"],
    title: "지하 세탁실",
    alt: "시트가 쌓인 선반과 카트가 있는 호텔 지하 세탁실.",
    caption: "지하 세탁실 · 시트 보관 구역",
  },
  {
    id: "auction-envelopes",
    caseId: "auction-seven",
    src: auctionEnvelopes,
    sourceIds: ["auction-seven-record-2"],
    title: "봉투 검수 사진",
    alt: "검수대에 나란히 놓인 밀봉된 봉투 세 개.",
    caption: "LOT-27 · 봉투 검수",
  },
  {
    id: "auction-display",
    caseId: "auction-seven",
    src: auctionDisplay,
    sourceIds: ["auction-seven-record-4", "auction-seven-f5"],
    title: "마감 뒤 전광판 표시",
    alt: "전광판 감시 단말의 LOT-27, MOTH, 310, CLOSED 표시. 작은 접속 불빛은 꺼져 있습니다.",
    caption: "22:00:00 · 전광판 감시 기록 정지 화면",
  },
  {
    id: "stage-console",
    caseId: "encore-last",
    src: stageConsole,
    sourceIds: [
      "encore-last-record-2",
      "encore-last-record-3",
      "encore-last-f4",
    ],
    title: "객석 뒤 음향석",
    alt: "같은 소공연장의 닫힌 붉은 커튼과 중앙 마이크를 바라보는 믹서와 노트북.",
    caption: "22:03 · 공연 종료 후 음향석",
  },
  {
    id: "stage-corridor",
    caseId: "encore-last",
    src: stageCorridor,
    sourceIds: [
      "encore-last-record-4",
      "encore-last-record-5",
      "encore-last-f5",
    ],
    title: "무대 뒤 통로",
    alt: "커튼 옆에서 건물 안쪽으로 이어지는 비어 있는 안전 통로.",
    caption: "공연 종료 후 · 무대 뒤 안전 통로",
  },
  {
    id: "island-rope",
    caseId: "monday-loop",
    src: islandRope,
    sourceIds: ["monday-loop-f3"],
    title: "관측소의 파란 밧줄",
    alt: "물에 젖은 파란 밧줄 사이에 해초가 붙어 있는 모습.",
    caption: "세 번째 아침 · 창가의 파란 밧줄",
  },
  {
    id: "island-buoy",
    caseId: "monday-loop",
    src: islandBuoy,
    sourceIds: ["monday-loop-record-4", "monday-loop-final"],
    title: "해안의 관측 부표",
    alt: "회색 바다 위에 떠 있는 관측 부표와 해안의 작은 관측소.",
    caption: "관측소 앞바다 · 관측 부표",
  },
];

export function auctionEvidencePhoto(c: CasePackage) {
  return isResolutionCase(c) ||
    c.puzzles.some((p) => p.visualId === "auction-seal")
    ? auctionSeals
    : auctionEnvelopes;
}

export function availableMedia(
  c: CasePackage,
  state: State,
  fileId?: string,
): CaseMedia[] {
  if (!isOfficialCaseVersion(c)) return [];
  return mediaAttachments
    .filter(
      (item) =>
        item.caseId === c.caseId &&
        (!item.versionIds || item.versionIds.includes(c.versionId)) &&
        item.sourceIds.some(
          (id) => (!fileId || id === fileId) && canOpen(c, state, id),
        ),
    )
    .map((item) =>
      item.id === "auction-envelopes" &&
      (isResolutionCase(c) ||
        c.puzzles.some((p) => p.visualId === "auction-seal"))
        ? {
            ...item,
            src: auctionEvidencePhoto(c),
            alt: "왼쪽 봉인은 파란 선 한 줄, 가운데는 두 줄의 온전한 봉인, 오른쪽은 두 줄 표시가 있는 봉인이 갈라져 있습니다.",
            caption: "LOT-27 · 봉투 검수",
          }
        : item,
    );
}

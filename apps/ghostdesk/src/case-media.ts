import type { CasePackage } from "../../../packages/contracts/src";
import { canOpen, type State } from "../../../packages/engine-ghostdesk/src";
import { isOfficialCaseVersion } from "./cases";
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
  {
    ...hotelStill,
    caseId: "hotel-404",
    sourceIds: ["hotel-404-f3"],
  },
  {
    ...stageClip,
    caseId: "encore-last",
    sourceIds: ["encore-last-f1"],
    versionIds: ["encore-last-v4"],
  },
  {
    ...auctionClip,
    caseId: "auction-seven",
    sourceIds: ["auction-seven-record-4"],
    versionIds: ["auction-seven-v4"],
  },
  {
    ...receiverClip,
    caseId: "monday-loop",
    sourceIds: ["monday-loop-f1"],
    versionIds: ["monday-loop-v4"],
  },
  {
    id: "lab-receipts",
    caseId: "demo-0317",
    src: labReceipts,
    sourceIds: ["demo-0317-record-2", "demo-0317-record-5"],
    title: "접수표 보관 책상",
    alt: "문서함 앞 책상에 나란히 놓인 접수표 세 장.",
    caption:
      "접수표가 놓인 보관 책상. 번호와 목적지는 함께 제공된 원문에서 대조하세요.",
  },
  {
    id: "lab-network",
    caseId: "demo-0317",
    src: labNetwork,
    sourceIds: ["demo-0317-record-3", "demo-0317-record-4"],
    title: "통신 장비 점검",
    alt: "작은 장비함의 통신 장치와 책상 위 분리된 연결선.",
    caption:
      "03:20 통신 장비함 작업대의 점검 사진입니다. PC 책상 전경과는 별도 구역이며, 이전에 처리된 작업은 기록과 함께 확인해야 합니다.",
  },
  {
    id: "hotel-frontdesk",
    caseId: "hotel-404",
    src: hotelFrontdesk,
    sourceIds: ["hotel-404-f0"],
    title: "야간 프런트",
    alt: "조명이 켜진 호텔 프런트와 뒤편의 객실 열쇠 보관대.",
    caption:
      "야간 인계에 등장하는 프런트. 객실 열쇠와 안내 데스크의 모습입니다.",
  },
  {
    id: "hotel-laundry",
    caseId: "hotel-404",
    src: hotelLaundry,
    sourceIds: ["hotel-404-record-4", "hotel-404-record-5", "hotel-404-f5"],
    title: "지하 세탁실",
    alt: "시트가 쌓인 선반과 카트가 있는 호텔 지하 세탁실.",
    caption:
      "위치 기록에 등장하는 세탁실의 모습. 인계 시각과 수량은 원본 대장을 확인하세요.",
  },
  {
    id: "auction-envelopes",
    caseId: "auction-seven",
    src: auctionEnvelopes,
    sourceIds: ["auction-seven-record-2"],
    title: "봉투 검수 사진",
    alt: "검수대에 나란히 놓인 밀봉된 봉투 세 개.",
    caption:
      "검수대의 봉투들. 봉인표를 옮긴 글은 ‘봉인표 대조’ 자료에서 읽을 수 있습니다.",
  },
  {
    id: "auction-display",
    caseId: "auction-seven",
    src: auctionDisplay,
    sourceIds: ["auction-seven-record-4", "auction-seven-f5"],
    title: "마감 뒤 전광판 표시",
    alt: "전광판 감시 단말의 LOT-27, MOTH, 310, CLOSED 표시. 작은 접속 불빛은 꺼져 있습니다.",
    caption:
      "22:00:00 마감 표시가 나타난 순간. 전광판 감시 기록의 경과 9초와 같은 화면입니다. 남아 있는 이름과 금액만으로 낙찰자를 판단할 수 없습니다.",
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
    caption:
      "22:03, 공연장 현장 사진과 같은 소공연장의 음향석. 공연 중 재생된 내용은 음향 기록에서 확인하세요.",
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
    caption:
      "공연 종료 뒤의 안전 통로. 사진에 사람이 없다는 사실만으로 공연 당시의 이동을 판단할 수는 없습니다.",
  },
  {
    id: "island-rope",
    caseId: "monday-loop",
    src: islandRope,
    sourceIds: ["monday-loop-f3"],
    title: "관측소의 파란 밧줄",
    alt: "물에 젖은 파란 밧줄 사이에 해초가 붙어 있는 모습.",
    caption:
      "세 번째 아침, 해초가 붙은 젖은 파란 밧줄의 창가 점검 사진. 앞선 두 날의 상태는 나루의 필기와 대조하세요.",
  },
  {
    id: "island-buoy",
    caseId: "monday-loop",
    src: islandBuoy,
    sourceIds: ["monday-loop-record-4", "monday-loop-final"],
    title: "해안의 관측 부표",
    alt: "회색 바다 위에 떠 있는 관측 부표와 해안의 작은 관측소.",
    caption:
      "관측소 앞바다의 부표. 장치의 전원과 기록 보관 위치는 연결 대장에서 확인하세요.",
  },
];

export function auctionEvidencePhoto(c: CasePackage) {
  return ["auction-seven-v3", "auction-seven-v4"].includes(c.versionId)
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
      ["auction-seven-v3", "auction-seven-v4"].includes(c.versionId)
        ? {
            ...item,
            src: auctionEvidencePhoto(c),
            alt: "왼쪽 봉인은 파란 선 한 줄, 가운데는 두 줄의 온전한 봉인, 오른쪽은 두 줄 표시가 있는 봉인이 갈라져 있습니다.",
            caption:
              "검수 표시와 봉인 종이의 상태를 확대해 대조할 수 있는 사진입니다.",
          }
        : item,
    );
}

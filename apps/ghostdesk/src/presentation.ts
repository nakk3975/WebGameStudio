import type { CaseFile, CasePackage } from "../../../packages/contracts/src";
import type { Save } from "./storage";
import { isOfficialCaseVersion, isResolutionCase } from "./cases";

// View names only: account saves must still match their immutable case package.
const investigationFolders: Record<string, string[]> = {
  "demo-0317": [
    "업무 자료",
    "접수 내역",
    "작업 기록",
    "장비 관리",
    "전송 내역",
    "보관 자료",
    "출입 관리",
    "파일 정리",
    "인수인계",
    "백업",
  ],
  "hotel-404": [
    "객실 자료",
    "촬영 자료",
    "CCTV",
    "근무 기록",
    "배송 내역",
    "장비 설정",
    "네트워크",
    "시설 관리",
    "복구 자료",
    "인수인계",
  ],
  "auction-seven": [
    "입찰 자료",
    "검수 자료",
    "정산 내역",
    "전광판",
    "접수 기록",
    "포장 자료",
    "결제 내역",
    "출력 기록",
    "반출 서류",
    "인수인계",
  ],
  "encore-last": [
    "공연 자료",
    "음원",
    "재생 기록",
    "안전 관리",
    "현장 자료",
    "연락 내역",
    "음향 설정",
    "방송 기록",
    "접수 자료",
    "인수인계",
  ],
  "monday-loop": [
    "수신 자료",
    "관측 자료",
    "일정",
    "장비 관리",
    "근무 기록",
    "별도 보관",
    "점검 내역",
    "자료 정리",
    "인수인계",
    "백업",
  ],
};

export function isVideoFile(c: CasePackage, file: CaseFile): boolean {
  return (
    isOfficialCaseVersion(c) &&
    ((c.caseId === "hotel-404" && file.id === "hotel-404-f3") ||
      /\.(cam|mp4)$/i.test(file.title))
  );
}

export function fileTitle(c: CasePackage, file: CaseFile): string {
  if (isResolutionCase(c)) return file.title;
  if (!isOfficialCaseVersion(c)) return file.title;
  if (c.caseId === "demo-0317" && file.id === "f-photo")
    return "시계_대조기록.txt";
  if (c.caseId === "auction-seven" && file.id === "auction-seven-f1")
    return "입찰_접수표.txt";
  if (isVideoFile(c, file))
    return file.id === "hotel-404-f3"
      ? "CAM-404_복도기록.mp4"
      : file.title.replace(/\.cam$/i, ".mp4");
  const index =
    file.type === "FOLDER" && file.puzzleId
      ? c.puzzles.findIndex((puzzle) => puzzle.id === file.puzzleId)
      : -1;
  return investigationFolders[c.caseId]?.[index] ?? file.title;
}

export function investigationStatus(save?: Save | null) {
  if (!save) return "미해결";
  if (save.state.mode !== "ENDED") return "진행 중";
  const ending = save.case.endings.find((e) => e.id === save.state.endingId);
  return ending && !ending.revisitable ? "조사 완료" : "재조사 필요";
}

// A board is an index of sources, not an automatic interpretation of them.
// Apply at presentation time so immutable old case packages and saves still work.
export function boardRecord(c: CasePackage, clueId: string) {
  const source = c.files.find((f) => f.clueId === clueId);
  return {
    title: source ? fileTitle(c, source) : "수집한 기록",
    description: source
      ? "확인한 원본 자료입니다. 필요한 부분은 추리 노트에 직접 기록해 보세요."
      : "조사 중 확보한 기록입니다.",
    sourceId: source?.id,
  };
}

// The archived package remains immutable; its viewer now plays continuous motion.
export function recordText(c: CasePackage, f: CaseFile) {
  if (isResolutionCase(c)) return f.text;
  if (isOfficialCaseVersion(c)) {
    if (c.caseId === "demo-0317" && f.id === "f-photo")
      return "야간 점검 / 시계 대조 기록\n\n같은 순간에 확인한 표시 시각\n벽시계      03:10\n기록용 PC   03:17\n\n야간 점검 담당자가 두 시계의 표시값을 옮겨 적었습니다.";
    if (
      f.type === "FOLDER" &&
      f.puzzleId &&
      f.text ===
        "이 단계의 확인을 마쳤습니다. 조사 단계에서 다음 기록을 열어 주세요."
    )
      return "관련 기록의 잠금이 해제되었습니다. 이 폴더의 자료는 언제든 다시 확인할 수 있습니다.";
  }
  if (
    isOfficialCaseVersion(c) &&
    c.puzzles.length > 5 &&
    f.id === `${c.caseId}-stage-5`
  )
    return "아래 원본 자료는 후속 조사의 근거입니다. 다음 폴더에서 남은 의문을 확인하세요.";
  if (c.caseId === "hotel-404" && isOfficialCaseVersion(c)) {
    if (f.id === "hotel-404-record-9b")
      return f.text.replaceAll("06-12 14:20", "06-12 14:32");
    if (f.id === "hotel-404-f0")
      return f.text.replace(
        "00:04, 폐쇄된 4층의 404호 앞에 흰 형체가 지나갔습니다.",
        "00:04, 프런트 화면에 폐쇄된 4층 복도가 보였습니다. 404호 문이 살짝 열려 있고, 그 앞을 흰 형체가 카트를 밀며 지나갔습니다.",
      );
    if (f.id === "hotel-404-record-3")
      return (
        "프런트 모니터 관찰 안내\n\n복도 기록은 연속 영상으로 확인할 수 있습니다. 흰 옷을 입은 인물과 카트의 이동을 살펴보세요. 같은 영상에서 추출한 정지 화면은 ‘이미지 자료’에 따로 보관했습니다.\n화면 아래 재생 위치는 보관한 기록의 경과 시간이며, 원본 장면 번호와는 다릅니다.\n\n" +
        (c.puzzles.some((p) => p.visualId === "hotel-repeat")
          ? "카트의 위치와 움직임을 앞뒤로 비교하고 같은 장면이 처음 다시 나타나는 두 시점을 담아 주세요."
          : "카트의 위치와 움직임을 앞뒤로 비교하고 같은 장면이 처음 다시 나타나기까지 걸린 초를 입력하세요.") +
        " 전체 기록의 길이가 곧 반복 간격은 아닙니다."
      );
  }
  return f.text;
}

export function messageText(
  c: CasePackage,
  message: CasePackage["messages"][number],
) {
  if (c.versionId === "monday-loop-v4" && isOfficialCaseVersion(c))
    return message.text.replace(
      "빗금이 글자를 나눠 주는구나.",
      "불빛 사이의 긴 쉼이 글자를 나눠 주는구나.",
    );
  return message.text;
}

export function evidenceFile(c: CasePackage, file: CaseFile): CaseFile {
  if (!isOfficialCaseVersion(c)) return file;
  file = { ...file, title: fileTitle(c, file) };
  if (c.caseId === "demo-0317" && file.id === "f-photo")
    return {
      ...file,
      type: "TEXT",
      assetId: undefined,
      alt: undefined,
      text: recordText(c, file),
    };
  if (file.assetId === "lab")
    return {
      ...file,
      alt: "야간 연구실의 책상. 꺼진 모니터 두 대와 검은 PC 본체, 서류와 분리된 연결선이 보입니다.",
      observations: [
        {
          label: "촬영 시각",
          text: "점검 촬영: 벽시계 기준 03:20. PC 책상 전경입니다. 통신 장비함은 별도 점검 사진에 기록되어 있습니다.",
        },
        {
          label: "시계 대조 기록",
          text: "동시 측정값은 시계_대조기록.txt에 따로 적었습니다. 현장 사진의 모니터는 꺼져 있습니다.",
        },
      ],
    };
  if (file.assetId === "auction")
    return {
      ...file,
      observations: [
        {
          label: "검수대",
          text: "봉투 세 개와 포장된 ‘푸른 궤도’가 놓여 있습니다. 봉인표의 판독 기준은 검수 기록에서 확인하세요.",
        },
      ],
    };
  if (file.assetId === "island")
    return {
      ...file,
      text:
        isResolutionCase(c) ||
        c.puzzles.some((p) => p.visualId === "island-signal")
          ? "세 번째 아침의 관측소. 수신 신호 영상은 이 수신기의 불빛 길이와 간격을 재현한 기록입니다."
          : "세 번째 아침의 관측소. 수신기의 신호는 수신_신호.txt에 점과 선으로 옮겨 적었습니다.",
      observations: [
        {
          label: "관측 책상",
          text: "종이 노트와 별도 배터리에 연결한 수신기, 해초가 붙은 젖은 파란 밧줄이 놓여 있습니다.",
        },
        {
          label: "창밖",
          text: "주황색 부체 위에 안테나와 기록함이 달린 관측 부표입니다. 전원과 저장 위치는 연결 대장을 확인하세요.",
        },
      ],
    };
  return file;
}

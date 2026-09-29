import type { CaseFile, CasePackage } from "../../../packages/contracts/src";
import type { Save } from "./storage";
import { isOfficialCaseVersion } from "./cases";

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
    title: source?.title || "수집한 기록",
    description: source
      ? "확인한 원본 자료입니다. 필요한 부분은 추리 노트에 직접 기록해 보세요."
      : "조사 중 확보한 기록입니다.",
    sourceId: source?.id,
  };
}

// The archived package remains immutable; its viewer now plays continuous motion.
export function recordText(c: CasePackage, f: CaseFile) {
  if (c.caseId === "hotel-404" && isOfficialCaseVersion(c)) {
    if (f.id === "hotel-404-f0")
      return f.text.replace(
        "00:04, 폐쇄된 4층의 404호 앞에 흰 형체가 지나갔습니다.",
        "00:04, 프런트 화면에 폐쇄된 4층 복도가 보였습니다. 404호 문이 살짝 열려 있고, 그 앞을 흰 형체가 카트를 밀며 지나갔습니다.",
      );
    if (f.id === "hotel-404-record-3")
      return "프런트 모니터 관찰 안내\n\n복도 기록은 연속 영상으로 확인할 수 있습니다. 흰 옷을 입은 인물과 카트의 이동을 살펴보세요. 같은 영상에서 추출한 정지 화면은 ‘사진 자료’에 따로 보관했습니다.\n화면 아래 재생 위치는 보관한 기록의 경과 시간이며, 원본 장면 번호와는 다릅니다.\n\n카트의 위치와 움직임을 앞뒤로 비교하고 같은 장면이 처음 다시 나타나는 두 시점을 담아 주세요. 전체 기록의 길이가 곧 반복 간격은 아닙니다.";
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
      text: "세 번째 아침의 관측소. 수신 신호 영상은 이 수신기의 불빛 길이와 간격을 재현한 기록입니다.",
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

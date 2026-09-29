import type { CaseFile, CasePackage } from "../../../packages/contracts/src";
import type { Save } from "./storage";

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
  if (
    c.caseId === "hotel-404" &&
    c.versionId === "hotel-404-v3" &&
    f.id === "hotel-404-record-3"
  )
    return "프런트 모니터 관찰 안내\n\n복도 공간과 카트의 위치 변화를 연속 영상으로 재현했습니다. 원본 사진은 복도 기록에서 따로 확인할 수 있습니다. 사람의 신원이나 동작을 복원한 영상은 아닙니다.\n화면 아래 재생 위치는 보관한 기록의 경과 시간이며, 원본 장면 번호와는 다릅니다.\n\n카트의 위치와 움직임을 앞뒤로 비교하고 같은 장면이 처음 다시 나타나는 두 시점을 담아 주세요. 전체 기록의 길이가 곧 반복 간격은 아닙니다.";
  return f.text;
}

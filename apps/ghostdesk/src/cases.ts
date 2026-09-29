import type { CasePackage } from "../../../packages/contracts/src";
import additions from "./additional-cases.json";
import expanded from "./expanded-cases.json";
import visual from "./visual-cases.json";
import motion from "./motion-cases.json";
import { sample } from "./sample";

export type CaseEntry = {
  case: CasePackage;
  number: string;
  theme: string;
  difficulty: string;
  display: string;
  location: string;
  previewKey: string;
  previewValue: string;
  caption: string;
};
const details = [
  {
    theme: "기록 대조",
    difficulty: "입문",
    display: "03:17",
    location: "연구실",
    previewKey: "SEND_REQUEST",
    previewValue: "QUEUED",
    caption: "요청은 남았다. 완료 기록은 없다.",
  },
  {
    theme: "호텔 미스터리",
    difficulty: "보통",
    display: "404",
    location: "심야 호텔",
    previewKey: "CAM-404",
    previewValue: "LIVE",
    caption: "닫힌 층. 열린 문. 돌아온 손님?",
  },
  {
    theme: "논리 추리",
    difficulty: "보통",
    display: "00:07",
    location: "밤의 경매",
    previewKey: "LOT-27",
    previewValue: "MOTH",
    caption: "가장 큰 숫자가 언제나 이기는 것은 아니다.",
  },
  {
    theme: "무대 뒤 추리",
    difficulty: "보통",
    display: "ENCORE",
    location: "공연장",
    previewKey: "VOCAL",
    previewValue: "ON AIR",
    caption: "목소리가 남아 있어도, 사람은 없을 수 있다.",
  },
  {
    theme: "신호 해독",
    difficulty: "도전",
    display: "MON",
    location: "섬의 관측소",
    previewKey: "DAY 03",
    previewValue: "MONDAY",
    caption: "세 번째 월요일. 바다만이 다음 날을 기억한다.",
  },
];
export const legacyCases = [sample, ...(additions as CasePackage[])];
export const archivedCases = [
  ...legacyCases,
  ...(expanded as CasePackage[]),
  ...(visual as CasePackage[]),
];
export const caseLibrary: CaseEntry[] = (
  [visual[0], ...motion] as CasePackage[]
).map((c, i) => ({
  case: c,
  number: String(i + 1).padStart(3, "0"),
  ...details[i],
}));
export function isOfficialCaseVersion(c: CasePackage) {
  return [...archivedCases, ...caseLibrary.map((e) => e.case)].some(
    (official) =>
      official.caseId === c.caseId && official.versionId === c.versionId,
  );
}
export function caseEntry(c: CasePackage): CaseEntry {
  return (
    caseLibrary.find((entry) => entry.case.caseId === c.caseId) || {
      case: c,
      number: "LOCAL",
      theme: "사용자 사건",
      difficulty: "직접 제작",
      display: "CASE",
      location: "기록 보관소",
      previewKey: "CASE FILE",
      previewValue: "OPEN",
      caption: "남겨진 기록을 대조하고 결론을 완성하세요.",
    }
  );
}

import type { CasePackage, Issue } from "../../../packages/contracts/src";
/** Only messages written for players may cross a UI error boundary. */
export class UserMessage extends Error {}
export function userMessage(error: unknown, fallback: string) {
  return error instanceof UserMessage ? error.message : fallback;
}
const sections: Record<string, string> = {
  files: "파일",
  clues: "단서",
  puzzles: "퍼즐",
  messages: "메시지",
  rules: "진행 규칙",
  endings: "엔딩",
  hypotheses: "결론",
  title: "사건 제목",
  description: "사건 설명",
  estimatedMinutes: "예상 플레이 시간",
  contentWarning: "콘텐츠 안내",
};
export function issueLocation(path: string, c: CasePackage) {
  const [kind, index] = path.split("."),
    title = sections[kind] || "사건 설정";
  const rows = c[kind as keyof CasePackage];
  if (!Array.isArray(rows) || !/^\d+$/.test(index || "")) return title;
  const item = rows[Number(index)];
  const name =
    item &&
    ("title" in item
      ? item.title
      : "label" in item
        ? item.label
        : "author" in item
          ? item.author
          : "");
  return title + " " + (Number(index) + 1) + (name ? " · " + name : "");
}
export function issueMessage({ message, path }: Issue) {
  if (message.includes("외부 URL"))
    return "웹 주소나 실행 코드는 넣을 수 없습니다. 일반 글자로 입력해 주세요.";
  if (message.includes("중복"))
    return "같은 이름이 겹칩니다. 연결한 항목이나 대기 이름을 확인해 주세요.";
  if (message.includes("참조") || message.includes("부모 폴더"))
    return "연결한 항목이 없어졌습니다. 목록에서 대상을 다시 선택해 주세요.";
  if (message.includes("순환") || message.includes("폴더 깊이"))
    return "폴더를 서로 안에 넣거나 너무 여러 겹으로 넣을 수 없습니다. 위치를 바꿔 주세요.";
  if (message.includes("접근할 수 없는 필수"))
    return "이 결론에 필요한 단서를 얻을 수 없습니다. 단서가 나타나는 과정을 확인해 주세요.";
  if (message.includes("타이머"))
    return "대기를 시작하는 규칙과 기다린 뒤 실행할 규칙을 함께 설정해 주세요.";
  if (message.includes("플래그"))
    return "진행 표시를 켜고 끄는 조건은 직접 플레이하며 확인해 주세요.";
  if (message.includes("숨겨진 파일"))
    return "파일이 나타나기 전에 그 파일을 읽도록 되어 있습니다. 공개 조건을 바꿔 주세요.";
  if (message.includes("이미지"))
    return "그림과 그림 설명을 함께 설정해 주세요.";
  if (message.includes("중첩") || message.includes("조건 깊이"))
    return "조건이 너무 여러 겹입니다. 더 간단하게 나눠 주세요.";
  if (message.includes("용량"))
    return "사건 파일이 너무 큽니다. 글이나 항목 수를 줄여 주세요.";
  if (message.startsWith("Too small"))
    return "필수 내용이 비어 있거나 값이 너무 작습니다. 내용을 채워 주세요.";
  if (message.startsWith("Too big"))
    return "입력한 글이나 항목 수가 너무 많습니다. 조금 줄여 주세요.";
  if (path.endsWith(".id"))
    return "이름에는 영문, 숫자, 밑줄과 짧은 가로줄을 사용할 수 있습니다.";
  return "이 항목의 입력 내용이나 연결 대상을 확인해 주세요.";
}

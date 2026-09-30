import { useState } from "react";
import type { CasePackage } from "../../../packages/contracts/src";
import FolderPassword from "./FolderPassword";
export default function PuzzleAnswer({
  puzzle: p,
  onSubmit,
  paused = false,
}: {
  puzzle: CasePackage["puzzles"][number];
  onSubmit: (answer: string) => void;
  paused?: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const sequence = p.inputMode === "sequence",
    choice = p.inputMode === "choice";
  return (
    <form
      className="puzzle-answer"
      onSubmit={(e) => {
        e.preventDefault();
        if (!paused) onSubmit(answer);
      }}
    >
      {sequence || choice ? (
        <>
          <p className="small">
            {sequence
              ? "자료의 순서대로 번호를 조합하면 폴더 암호가 됩니다. 선택한 항목을 다시 누르면 뺄 수 있어요."
              : "기록과 맞는 항목의 문자를 폴더 암호로 사용합니다."}
          </p>
          <div className="puzzle-options">
            {p.choices?.map((o) => (
              <button
                type="button"
                key={o.value}
                disabled={paused}
                aria-pressed={answer.includes(o.value)}
                onClick={() =>
                  setAnswer(
                    sequence
                      ? answer.includes(o.value)
                        ? answer.replace(o.value, "")
                        : answer + o.value
                      : o.value,
                  )
                }
              >
                <span>
                  {sequence && answer.includes(o.value)
                    ? `${answer.indexOf(o.value) + 1}번째`
                    : o.value}
                </span>
                {o.label}
              </button>
            ))}
          </div>
          {choice && (
            <p className="sequence-result" aria-live="polite">
              선택한 암호: <strong>{answer || "선택 전"}</strong>
            </p>
          )}
          {sequence && (
            <div className="sequence-result" aria-live="polite">
              암호 조합: <strong>{answer || "선택 전"}</strong>
              <br />
              {answer
                ? [...answer]
                    .map((v) => p.choices?.find((o) => o.value === v)?.label)
                    .join(" → ")
                : "아직 선택하지 않았어요"}
              <button
                type="button"
                className="quiet"
                disabled={paused}
                onClick={() => setAnswer("")}
              >
                다시 배열
              </button>
            </div>
          )}
        </>
      ) : (
        <FolderPassword value={answer} onChange={setAnswer} disabled={paused} />
      )}
      <button
        className="primary"
        type="submit"
        disabled={
          paused ||
          !answer.trim() ||
          (sequence && answer.length !== p.choices?.length)
        }
      >
        폴더 열기
      </button>
    </form>
  );
}

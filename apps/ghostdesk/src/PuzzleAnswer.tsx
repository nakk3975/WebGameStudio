import { useState } from "react";
import type { CasePackage } from "../../../packages/contracts/src";
export default function PuzzleAnswer({
  puzzle: p,
  onSubmit,
}: {
  puzzle: CasePackage["puzzles"][number];
  onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const sequence = p.inputMode === "sequence",
    choice = p.inputMode === "choice";
  return (
    <form
      className="puzzle-answer"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(answer);
      }}
    >
      {sequence || choice ? (
        <>
          <p className="small">
            {sequence
              ? "먼저 일어난 항목부터 차례로 눌러 주세요. 선택한 항목을 다시 누르면 뺄 수 있어요."
              : "기록과 맞는 항목 하나를 선택하세요."}
          </p>
          <div className="puzzle-options">
            {p.choices?.map((o) => (
              <button
                type="button"
                key={o.value}
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
          {sequence && (
            <div className="sequence-result" aria-live="polite">
              선택한 순서:{" "}
              {answer
                ? [...answer]
                    .map((v) => p.choices?.find((o) => o.value === v)?.label)
                    .join(" → ")
                : "아직 선택하지 않았어요"}
              <button
                type="button"
                className="quiet"
                onClick={() => setAnswer("")}
              >
                다시 배열
              </button>
            </div>
          )}
        </>
      ) : (
        <label className="field">
          {p.stageTitle ? "확인한 답" : "암호"}
          <input
            name="answer"
            aria-label={p.stageTitle ? "조사 답" : "보관함 암호"}
            required
            maxLength={100}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={p.stageTitle ? "기록에서 찾은 답 입력" : "암호 입력"}
            className="code-input"
          />
        </label>
      )}
      <button
        className="primary"
        type="submit"
        disabled={
          !answer.trim() || (sequence && answer.length !== p.choices?.length)
        }
      >
        {p.stageTitle ? "답 확인하기" : "보관함 열기"}
      </button>
    </form>
  );
}

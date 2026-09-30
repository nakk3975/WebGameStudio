import { useState } from "react";
import FolderPassword from "./FolderPassword";
import type { CasePackage } from "../../../packages/contracts/src";
import { CCTVPlayer } from "./RecordingPlayer";
import { hotelClip, cctvFrames } from "./cctv";
import { auctionClip, stageClip, receiverClip } from "./recordings";
import {
  repeatAnswer,
  auctionObservationAnswer,
  recordingTime,
  type CapturedFrame,
} from "./recording-timing";
import auctionOff from "./assets/auction-monitor-2.webp";
import auctionClosed from "./assets/auction-monitor-9.webp";

export function VideoComparison({
  paused,
  onSubmit,
  auction = false,
}: {
  paused: boolean;
  onSubmit: (answer: string) => void;
  auction?: boolean;
}) {
  const [captures, setCaptures] = useState<CapturedFrame[]>([]);
  const [notice, setNotice] = useState("");
  const item = auction ? auctionClip : hotelClip;
  function capture(frame: CapturedFrame) {
    if (captures.some((c) => Math.abs(c.time - frame.time) < 1 / 24)) {
      setNotice("같은 시점이 이미 담겨 있어요. 다른 시점으로 이동해 주세요.");
      return;
    }
    if (captures.length >= 2) {
      setNotice("비교판에서 한 장면을 비운 뒤 다시 담아 주세요.");
      return;
    }
    setCaptures([...captures, frame]);
    setNotice("");
  }
  const fallback = auction
    ? [
        {
          time: 0,
          src: auctionClip.src,
          text: "접속 불빛이 켜져 있고 OPEN 표시가 보입니다.",
        },
        {
          time: 2,
          src: auctionOff,
          text: "접속 불빛이 꺼졌습니다. OPEN 표시는 그대로입니다.",
        },
        {
          time: 5,
          src: auctionOff,
          text: "접속 불빛은 꺼져 있고 OPEN 표시가 보입니다.",
        },
        {
          time: 9,
          src: auctionClosed,
          text: "OPEN이 CLOSED로 바뀌었습니다. MOTH와 310 표시는 남아 있습니다.",
        },
      ]
    : [0, 4, 8, 12, 16, 20, 24].map((time) => ({
        time,
        src: cctvFrames[(time % 12) / 4],
        text: [
          "카트가 복도 안쪽에 있습니다.",
          "카트가 복도 중간으로 다가왔습니다.",
          "카트가 가까운 쪽으로 더 다가왔습니다.",
        ][(time % 12) / 4],
      }));
  return (
    <div className="visual-puzzle">
      <p className="visual-instruction">
        {auction
          ? "접속 불빛이 꺼지는 순간과 마감 표시로 바뀌는 순간을 차례로 담으세요. ‘조금 이전·다음’으로 변하기 시작하는 지점을 맞출 수 있어요."
          : "같은 움직임이 처음 다시 나타나는 두 시점을 담으세요. 멈춘 화면을 그대로 비교판에 담을 수 있어요."}
      </p>
      <CCTVPlayer
        item={item}
        paused={paused}
        onCapture={capture}
        captureDisabled={captures.length === 2}
      />
      <p className="small muted">{item.caption}</p>
      <div className="frame-comparison" aria-label="장면 비교판">
        {[0, 1].map((i) => (
          <div className="captured-scene" key={i}>
            {captures[i] ? (
              <>
                <img
                  src={captures[i].src}
                  alt={`${recordingTime(captures[i].time)}에 담은 영상 장면`}
                />
                <div>
                  <strong>{recordingTime(captures[i].time)}</strong>
                  <button
                    type="button"
                    aria-label={`${i + 1}번째 장면 비우기`}
                    onClick={() => {
                      setCaptures(captures.filter((_, j) => i !== j));
                      setNotice("");
                    }}
                  >
                    비우기
                  </button>
                </div>
              </>
            ) : (
              <div className="capture-empty">
                {auction
                  ? ["접속 불빛이 꺼지는 순간", "마감 표시가 나타나는 순간"][i]
                  : `비교할 ${i + 1}번째 장면`}
              </div>
            )}
          </div>
        ))}
      </div>
      <p role="status" className="visual-notice">
        {notice || `${captures.length} / 2 장면 선택`}
      </p>
      <button
        className="primary"
        type="button"
        disabled={paused || captures.length !== 2}
        onClick={() =>
          onSubmit(
            auction
              ? auctionObservationAnswer(
                  captures[0]?.time ?? null,
                  captures[1]?.time ?? null,
                )
              : repeatAnswer(captures.map((c) => c.time)),
          )
        }
      >
        폴더 열기
      </button>
      <details className="visual-description">
        <summary>영상 대신 장면 설명으로 살펴보기</summary>
        <p>
          화면을 보기 어렵거나 영상이 열리지 않을 때도 같은 관찰 기록으로 비교할
          수 있어요.
        </p>
        {fallback.map((frame) => (
          <div className="scene-description" key={frame.time}>
            <span>
              <strong>{recordingTime(frame.time)}</strong> · {frame.text}
            </span>
            <button
              type="button"
              disabled={
                paused ||
                captures.length === 2 ||
                captures.some((c) => c.time === frame.time)
              }
              onClick={() => capture(frame)}
            >
              {recordingTime(frame.time)} 장면 담기
            </button>
          </div>
        ))}
      </details>
    </div>
  );
}

const cards = [
  { value: "1", label: "흰빛", color: "#dddcd2" },
  { value: "2", label: "주황빛", color: "#dfa33c" },
  { value: "3", label: "붉은빛", color: "#ce655d" },
  { value: "4", label: "파란빛", color: "#619dde" },
  { value: "5", label: "초록빛", color: "#6fb58d" },
];
export function SignalObservation({
  puzzle,
  paused,
  onSubmit,
}: {
  puzzle: CasePackage["puzzles"][number];
  paused: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const stage = puzzle.visualId === "stage-cues";
  const item = stage ? stageClip : receiverClip;
  return (
    <div className="visual-puzzle">
      <CCTVPlayer item={item} paused={paused} />
      <p className="small muted">{item.caption}</p>
      <form
        className="motion-answer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!paused) onSubmit(answer);
        }}
      >
        {stage ? (
          <>
            <p>영상에서 실제로 나타난 네 색을 순서대로 선택하세요.</p>
            <div className="puzzle-options">
              {cards.map((card) => (
                <button
                  type="button"
                  key={card.value}
                  disabled={paused}
                  aria-pressed={answer.includes(card.value)}
                  onClick={() =>
                    setAnswer(
                      answer.includes(card.value)
                        ? answer.replace(card.value, "")
                        : answer.length < 4
                          ? answer + card.value
                          : answer,
                    )
                  }
                >
                  <span
                    className="cue-dot"
                    style={{ background: card.color }}
                    aria-hidden="true"
                  />
                  {card.label}
                  {answer.includes(card.value) && (
                    <b>{answer.indexOf(card.value) + 1}번째</b>
                  )}
                </button>
              ))}
            </div>
            <p aria-live="polite">
              암호 조합:{" "}
              {answer
                ? [...answer]
                    .map((v) => cards.find((c) => c.value === v)?.label)
                    .join(" → ")
                : "아직 선택하지 않았어요"}
            </p>
            <button
              type="button"
              className="quiet"
              onClick={() => setAnswer("")}
            >
              다시 배열
            </button>
          </>
        ) : (
          <FolderPassword
            value={answer}
            onChange={setAnswer}
            disabled={paused}
            maxLength={3}
            placeholder="신호에서 찾은 영문 세 글자"
          />
        )}
        <button
          className="primary"
          type="submit"
          disabled={
            paused || (stage ? answer.length !== 4 : answer.trim().length !== 3)
          }
        >
          폴더 열기
        </button>
      </form>
      <details className="visual-description">
        <summary>영상 설명으로 살펴보기</summary>
        <p>{item.alt}</p>
      </details>
    </div>
  );
}

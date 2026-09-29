import { useState } from "react";
import type { CasePackage } from "../../../packages/contracts/src";
import { VideoComparison, SignalObservation } from "./VideoPuzzle";
import network from "./assets/lab-network.webp";
import hotel from "./assets/hotel.webp";
import seals from "./assets/auction-seals.webp";
import corridor from "./assets/stage-corridor.webp";
import buoy from "./assets/island-buoy.webp";

type Pin = {
  value: string;
  x: number;
  y: number;
  focusX?: number;
  focusY?: number;
  description: string;
};
type PhotoTask = {
  src: string;
  alt: string;
  instruction: string;
  pins: Pin[];
  field?: { label: string; placeholder: string };
  options?: { value: string; label: string }[];
};
const photos: Record<string, PhotoTask> = {
  "lab-network": {
    src: network,
    alt: "03:20 장비 점검 사진. 장비함 안에는 연결된 선이 있고 책상 앞쪽에는 따로 놓인 선 끝이 보입니다.",
    instruction: "연결되지 않은 선의 끝에 해당하는 표시를 고르세요.",
    pins: [
      {
        value: "A",
        x: 64,
        y: 40,
        focusX: 59,
        focusY: 34,
        description: "장비함 위쪽 장치에 여러 선이 꽂혀 있습니다.",
      },
      {
        value: "B",
        x: 37,
        y: 91,
        focusX: 36,
        focusY: 81,
        description: "책상 위 선 끝의 투명한 연결부가 드러나 있습니다.",
      },
      {
        value: "C",
        x: 73,
        y: 70,
        focusX: 72,
        focusY: 61,
        description: "장비함 오른쪽의 별도 장치에 작은 불빛이 켜져 있습니다.",
      },
    ],
    field: { label: "외부 전송량 증가분", placeholder: "바이트 수 입력" },
  },
  "hotel-date": {
    src: hotel,
    alt: "호텔 복도 왼쪽에는 문, 가운데에는 흰 시트 카트, 오른쪽에는 노란 공사용 덮개가 있습니다. 원본 표시는 06-12 14:32입니다.",
    instruction: "오늘의 시설 점검 메모와 맞지 않는 흔적을 표시하세요.",
    pins: [
      {
        value: "A",
        x: 22,
        y: 56,
        description: "복도 왼쪽의 닫힌 객실 문입니다.",
      },
      {
        value: "B",
        x: 54,
        y: 43,
        focusY: 28,
        description: "흰 시트가 놓인 카트입니다.",
      },
      {
        value: "C",
        x: 83,
        y: 54,
        description: "복도 오른쪽에 노란 공사용 덮개가 있습니다.",
      },
    ],
    field: { label: "원본 촬영일 · 월과 일 네 자리", placeholder: "예: 0305" },
  },
  "auction-seal": {
    src: seals,
    alt: "검수대 위 세 봉투. 왼쪽 봉인은 파란 선 한 줄, 가운데 봉인은 평행한 두 줄이며 온전하고, 오른쪽 두 줄 봉인은 중앙이 찢어져 있습니다.",
    instruction:
      "검수 표시와 봉인 상태를 모두 대조하세요. 표시를 누르면 해당 부분을 확대할 수 있어요.",
    pins: [
      {
        value: "A",
        x: 23,
        y: 77,
        focusX: 23,
        focusY: 60,
        description: "왼쪽 봉투: 한 줄 표시, 종이가 이어져 있습니다.",
      },
      {
        value: "B",
        x: 48,
        y: 73,
        focusX: 48,
        focusY: 55,
        description: "가운데 봉투: 평행한 두 줄 표시, 종이가 이어져 있습니다.",
      },
      {
        value: "C",
        x: 72,
        y: 69,
        focusX: 71,
        focusY: 51,
        description:
          "오른쪽 봉투: 두 줄 표시, 종이 중앙에 찢어진 틈이 있습니다.",
      },
    ],
  },
  "stage-route": {
    src: corridor,
    alt: "왼쪽 무대 커튼 옆으로 통로가 이어지고, 안쪽 끝에 열린 문이 있습니다. 왼쪽에는 장비 상자가 놓여 있습니다.",
    instruction: "안전 통로 끝에서 건물 안쪽으로 이어지는 문을 표시하세요.",
    pins: [
      { value: "A", x: 17, y: 47, description: "사진 왼쪽의 무대 커튼입니다." },
      {
        value: "B",
        x: 56,
        y: 34,
        description: "통로 끝에 열린 문과 그 너머의 실내 바닥이 보입니다.",
      },
      {
        value: "C",
        x: 29,
        y: 65,
        description: "커튼 옆의 이동식 장비 상자입니다.",
      },
    ],
    options: [
      { value: "A", label: "해온이 건물 안에 계속 있었다" },
      { value: "B", label: "해온이 안전 통로도 이용하지 않았다" },
      { value: "C", label: "정문을 통해 나가는 모습이 없었다" },
    ],
  },
  "island-device": {
    src: buoy,
    alt: "오른쪽 해안에는 관측소 건물이 있고, 왼쪽 바다 위에는 안테나와 기록함이 붙은 주황색 관측 부표가 떠 있습니다.",
    instruction: "바다에서 관측 기록을 남기는 장치를 표시하세요.",
    pins: [
      {
        value: "A",
        x: 88,
        y: 19,
        description: "해안 위의 작은 관측소 건물입니다.",
      },
      {
        value: "B",
        x: 32,
        y: 58,
        description: "바다 위 주황색 부표에 안테나와 장치함이 붙어 있습니다.",
      },
      {
        value: "C",
        x: 72,
        y: 42,
        description: "관측소 아래의 해안 바위입니다.",
      },
    ],
    options: [
      { value: "A", label: "PC 달력과 외부 모니터" },
      { value: "B", label: "관측 부표와 종이 노트" },
      { value: "C", label: "외부 모니터와 관측 부표" },
    ],
  },
};
export default function VisualPuzzle({
  puzzle,
  paused,
  onSubmit,
}: {
  puzzle: CasePackage["puzzles"][number];
  paused: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [followup, setFollowup] = useState("");
  const [zoom, setZoom] = useState(false);
  if (puzzle.visualId === "hotel-repeat")
    return <VideoComparison paused={paused} onSubmit={onSubmit} />;
  if (puzzle.visualId === "auction-timing")
    return <VideoComparison paused={paused} onSubmit={onSubmit} auction />;
  if (puzzle.visualId === "stage-cues" || puzzle.visualId === "island-signal")
    return (
      <SignalObservation puzzle={puzzle} paused={paused} onSubmit={onSubmit} />
    );
  const task = photos[puzzle.visualId || ""];
  if (!task)
    return (
      <p role="alert">이 관찰 자료를 열지 못했어요. 사건을 다시 열어 주세요.</p>
    );
  const pin = task.pins.find((p) => p.value === selected);
  const needFollowup = !!task.field || !!task.options;
  return (
    <form
      className="visual-puzzle"
      onSubmit={(e) => {
        e.preventDefault();
        if (!paused && selected && (!needFollowup || followup.trim()))
          onSubmit(selected + (needFollowup ? `:${followup.trim()}` : ""));
      }}
    >
      <p className="visual-instruction">{task.instruction}</p>
      <div className="photo-investigation">
        <img src={task.src} alt={task.alt} />
        {puzzle.visualId === "hotel-date" && (
          <>
            <span className="cctv-badge">화면 표지 · LIVE</span>
            <span className="cctv-stamp">원본 06-12 14:32 · F-8821</span>
          </>
        )}
        {task.pins.map((p) => (
          <button
            type="button"
            key={p.value}
            className="photo-pin"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={`사진 ${p.value} 선택`}
            aria-pressed={selected === p.value}
            disabled={paused}
            onClick={() => setSelected(p.value)}
          >
            {p.value}
          </button>
        ))}
      </div>
      <div className="photo-selection-status">
        <span aria-live="polite">
          {selected ? `사진 ${selected} 선택됨` : "사진의 표시를 선택하세요"}
        </span>
        <button
          type="button"
          disabled={!pin}
          aria-pressed={zoom}
          onClick={() => setZoom(!zoom)}
        >
          {zoom ? "확대 닫기" : "선택한 부분 확대"}
        </button>
      </div>
      {zoom && pin && (
        <div
          className="photo-inspection"
          role="img"
          aria-label={`사진 ${pin.value} 확대. ${pin.description}`}
          style={{
            backgroundImage: `url(${task.src})`,
            backgroundPosition: `${Math.min(100, Math.max(0, ((pin.focusX ?? pin.x) - 12.5) / 0.75))}% ${Math.min(100, Math.max(0, ((pin.focusY ?? pin.y) - 12.5) / 0.75))}%`,
          }}
        />
      )}
      {task.field && (
        <label className="field">
          {task.field.label}
          <input
            name="visual-answer"
            aria-label={task.field.label}
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={20}
            placeholder={task.field.placeholder}
            value={followup}
            onChange={(e) => setFollowup(e.target.value)}
          />
        </label>
      )}
      {task.options && (
        <fieldset className="visual-followup">
          <legend>
            {puzzle.visualId === "stage-route"
              ? "정문 영상만으로 확인할 수 있는 것은?"
              : "PC와 독립된 기록 묶음은?"}
          </legend>
          {task.options.map((o) => (
            <label key={o.value} className="visual-choice">
              <input
                type="radio"
                name="visual-followup"
                value={o.value}
                checked={followup === o.value}
                onChange={() => setFollowup(o.value)}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}
      <button
        type="submit"
        className="primary"
        disabled={paused || !selected || (needFollowup && !followup.trim())}
      >
        관찰 결과 확인하기
      </button>
      <details className="visual-description">
        <summary>사진 설명으로 살펴보기</summary>
        <p>표시별로 보이는 모습을 글로 읽고 선택할 수 있어요.</p>
        {task.pins.map((p) => (
          <div className="scene-description" key={p.value}>
            <span>
              {p.value} · {p.description}
            </span>
            <button
              type="button"
              aria-pressed={selected === p.value}
              disabled={paused}
              onClick={() => setSelected(p.value)}
            >
              {p.value} 표시 선택
            </button>
          </div>
        ))}
      </details>
    </form>
  );
}

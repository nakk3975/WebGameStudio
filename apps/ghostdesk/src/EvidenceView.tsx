import { useState } from "react";
import type { CaseFile } from "../../../packages/contracts/src";
import lab from "./assets/lab.webp";
import hotel from "./assets/hotel.webp";
import auction from "./assets/auction.webp";
import stage from "./assets/stage.webp";
import island from "./assets/island.webp";

const photos = { lab, hotel, auction, stage, island };
export default function EvidenceView({ file }: { file: CaseFile }) {
  const [detail, setDetail] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  // Old 404 saves retain their package; give the archived capture a visual viewer too.
  const legacyCCTV = file.id === "hotel-404-f3" && !file.assetId;
  const asset = legacyCCTV ? "hotel" : file.assetId;
  const observations = legacyCCTV
    ? [
        { label: "원본 기록", text: "06-12 14:32 / F-8821" },
        { label: "복도 우측", text: "노란 공사용 덮개가 있습니다." },
        { label: "중앙 카트", text: "접힌 흰 시트가 카트에 놓여 있습니다." },
      ]
    : file.observations || [];
  if (asset === "clock-comparison")
    return (
      <div className="image-content">
        <div className="clock-evidence" role="img" aria-label={file.alt}>
          <div>
            <span>벽시계</span>
            <strong>03:10</strong>
            <small>벽시계</small>
          </div>
          <div>
            <span>기록용 PC</span>
            <strong>03:17</strong>
            <small>컴퓨터 시계</small>
          </div>
        </div>
        <p>{file.text}</p>
      </div>
    );
  if (!asset) return null;
  return (
    <figure
      className={"evidence-view " + (asset === "hotel" ? "cctv-view" : "")}
    >
      <div className="evidence-toolbar">
        <span>
          {asset === "hotel" ? "CAM-404 · 보관된 녹화 장면" : "현장 사진"}
        </span>
        <button onClick={() => setZoom(!zoom)} aria-pressed={zoom}>
          {zoom ? "전체 보기" : "확대 보기"}
        </button>
      </div>
      <div className={"evidence-viewport " + (zoom ? "zoomed" : "")}>
        <img
          src={photos[asset]}
          alt={file.alt || "복도에 놓인 흰 시트 카트와 우측의 노란 덮개."}
        />
        {asset === "hotel" && (
          <>
            <span className="cctv-badge">화면 표지 · LIVE</span>
            <span className="cctv-stamp">원본 06-12 14:32 · F-8821</span>
          </>
        )}
      </div>
      <figcaption>
        {legacyCCTV
          ? "프런트에서 보관한 화면 캡처. 원본 기록과 장면을 직접 살펴보세요."
          : file.text}
      </figcaption>
      {!!observations.length && (
        <>
          <div className="observation-tabs" aria-label="사진 세부 기록">
            {observations.map((o, i) => (
              <button
                key={o.label}
                aria-pressed={detail === i}
                onClick={() => setDetail(detail === i ? null : i)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="observation-detail" aria-live="polite">
            {detail === null
              ? "궁금한 부분을 선택해 세부 기록을 확인하세요."
              : observations[detail].text}
          </div>
        </>
      )}
      <details>
        <summary>사진 설명 읽기</summary>
        <p>{file.alt || "흰 시트가 접힌 카트와 노란 공사 덮개가 있는 복도."}</p>
      </details>
    </figure>
  );
}

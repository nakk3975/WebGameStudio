import { useState } from "react";
import type { CaseMedia } from "./case-media";
import { CCTVPlayer } from "./RecordingPlayer";
export { CCTVPlayer } from "./RecordingPlayer";

export default function MediaGallery({
  items,
  paused = false,
}: {
  items: CaseMedia[];
  paused?: boolean;
}) {
  const [selected, setSelected] = useState(items[0]?.id);
  const [zoom, setZoom] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const item = items.find((i) => i.id === selected) || items[0];
  if (!item) return null;
  return (
    <figure className="evidence-view media-gallery">
      <div className="evidence-toolbar">
        <span>
          {item.title}
          {items.length > 1 &&
            ` · ${items.indexOf(item) + 1} / ${items.length}`}
        </span>
        {!item.video && (
          <button onClick={() => setZoom(!zoom)} aria-pressed={zoom}>
            {zoom ? "전체 보기" : "확대 보기"}
          </button>
        )}
      </div>
      {item.video ? (
        <CCTVPlayer key={item.id} item={item} paused={paused} />
      ) : (
        <div className={"evidence-viewport " + (zoom ? "zoomed" : "")}>
          <img src={item.src} alt={item.alt} loading="lazy" decoding="async" />
        </div>
      )}
      <figcaption>{item.caption}</figcaption>
      {items.length > 1 && (
        <div
          className="media-thumbnails"
          aria-label="확인할 수 있는 사진과 영상"
        >
          {items.map((other) => (
            <button
              key={other.id}
              aria-pressed={item.id === other.id}
              onClick={() => {
                setSelected(other.id);
                setZoom(false);
                setDetail(null);
              }}
            >
              <img src={other.src} alt="" loading="lazy" decoding="async" />
              <span>
                {other.title}
                {other.video ? " · 영상" : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {!!item.observations?.length && (
        <>
          <div className="observation-tabs" aria-label="장면 세부 기록">
            {item.observations.map((o, i) => (
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
              : item.observations[detail]?.text}
          </div>
        </>
      )}
      <details>
        <summary>{item.video ? "영상 설명 읽기" : "사진 설명 읽기"}</summary>
        <p>{item.alt}</p>
      </details>
    </figure>
  );
}

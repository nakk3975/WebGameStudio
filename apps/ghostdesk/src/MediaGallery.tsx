import { useEffect, useRef, useState } from "react";
import type { CaseMedia } from "./case-media";

const timeLabel = (seconds: number) =>
  `00:${String(Math.floor(seconds)).padStart(2, "0")}`;

function CCTVPlayer({ item, paused }: { item: CaseMedia; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(12);
  const [error, setError] = useState("");
  useEffect(() => {
    if (paused) video.current?.pause();
  }, [paused]);
  return (
    <div className="cctv-player">
      <div className="evidence-viewport cctv-screen">
        <video
          ref={video}
          src={item.video}
          poster={item.src}
          muted
          playsInline
          loop
          preload="metadata"
          aria-label="404호 복도 CCTV 재현 영상"
          onPlay={(e) => {
            if (paused) e.currentTarget.pause();
            else setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 12)}
          onError={() =>
            setError(
              "영상을 불러오지 못했어요. 아래 장면 설명과 원본 기록으로도 조사할 수 있어요.",
            )
          }
        />
        <span className="cctv-badge">화면 표지 · LIVE</span>
        <span className="cctv-stamp">
          원본 06-12 14:32 · F-{8821 + Math.min(2, Math.floor(time / 4))}
        </span>
        <span className="cctv-reconstruction">사건 재현 영상</span>
      </div>
      <div className="video-controls">
        <button
          disabled={paused || !!error}
          onClick={async () => {
            const el = video.current;
            if (!el) return;
            if (!el.paused) el.pause();
            else
              try {
                await el.play();
              } catch (error) {
                // Pausing or replacing a still-loading clip is expected.
                if (
                  error instanceof DOMException &&
                  error.name === "AbortError"
                )
                  return;
                setError(
                  "재생을 시작하지 못했어요. 파일을 닫았다가 다시 열어 주세요.",
                );
              }
          }}
        >
          {playing ? "영상 일시정지" : "영상 재생"}
        </button>
        <button
          disabled={!!error}
          onClick={() => {
            if (video.current) {
              video.current.pause();
              video.current.currentTime = 0;
              setTime(0);
            }
          }}
        >
          처음으로
        </button>
        <span>
          {timeLabel(time)} / {timeLabel(duration)}
        </span>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={time}
          aria-label="영상 위치"
          aria-valuetext={`${time.toFixed(1)}초`}
          disabled={!!error}
          onChange={(e) => {
            const next = Number(e.currentTarget.value);
            if (video.current) {
              video.current.pause();
              video.current.currentTime = next;
              setTime(next);
            }
          }}
        />
      </div>
      {error && (
        <p role="status" className="media-note">
          {error}
        </p>
      )}
    </div>
  );
}

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

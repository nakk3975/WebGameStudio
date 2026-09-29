import { useEffect, useRef, useState } from "react";
import type { CaseMedia } from "./case-media";
import {
  RECORDING_FPS,
  recordingTime,
  type CapturedFrame,
} from "./recording-timing";

export function CCTVPlayer({
  item,
  paused,
  onCapture,
  captureDisabled = false,
}: {
  item: CaseMedia;
  paused: boolean;
  onCapture?: (frame: CapturedFrame) => void;
  captureDisabled?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(item.recording?.duration || 0);
  const [ready, setReady] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState("");
  const step = item.recording?.step || 0.25;
  const lastFrame = Math.max(0, duration - 1 / RECORDING_FPS);
  useEffect(() => {
    if (paused) video.current?.pause();
  }, [paused]);
  function seek(next: number) {
    const el = video.current;
    if (!el || !ready) return;
    el.pause();
    el.currentTime = Math.max(0, Math.min(lastFrame, next));
    setTime(el.currentTime);
  }
  function capture() {
    const el = video.current;
    if (!el || el.seeking || el.readyState < 2 || paused) return;
    el.pause();
    try {
      const canvas = document.createElement("canvas");
      canvas.width = el.videoWidth;
      canvas.height = el.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("capture");
      context.drawImage(el, 0, 0);
      onCapture?.({
        time:
          Math.round(Math.min(el.currentTime, lastFrame) * RECORDING_FPS) /
          RECORDING_FPS,
        src: canvas.toDataURL("image/jpeg", 0.85),
      });
    } catch {
      setError("장면을 담지 못했어요. 아래 장면 설명으로도 비교할 수 있어요.");
    }
  }
  return (
    <div className="cctv-player">
      <div className="evidence-viewport cctv-screen">
        <video
          ref={video}
          src={item.video}
          poster={item.src}
          muted
          playsInline
          preload="metadata"
          aria-label={`${item.title} 재현 영상`}
          onPlay={(e) => {
            if (paused) e.currentTarget.pause();
            else setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onSeeking={() => setSeeking(true)}
          onSeeked={(e) => {
            setSeeking(false);
            setTime(e.currentTarget.currentTime);
          }}
          onLoadedData={() => {
            setReady(true);
            setDecoded(true);
          }}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            setReady(true);
          }}
          onError={() =>
            setError(
              "영상을 불러오지 못했어요. 장면 설명과 원본 기록으로도 조사할 수 있어요.",
            )
          }
        />
        {item.recording?.live && (
          <span className="cctv-badge">화면 표지 · LIVE</span>
        )}
        <span className="cctv-stamp">
          {item.recording?.stamp(time) || recordingTime(time)}
        </span>
        <span className="cctv-reconstruction">
          {item.recording?.label || "기록 재현 영상"}
        </span>
      </div>
      <div className="video-controls">
        <button
          disabled={paused || !ready}
          onClick={async () => {
            const el = video.current;
            if (!el) return;
            if (!el.paused) el.pause();
            else
              try {
                await el.play();
              } catch (e) {
                if (!(e instanceof DOMException && e.name === "AbortError"))
                  setError(
                    "재생을 시작하지 못했어요. 파일을 닫았다가 다시 열어 주세요.",
                  );
              }
          }}
        >
          {playing ? "영상 일시정지" : "영상 재생"}
        </button>
        <button disabled={!ready} onClick={() => seek(0)}>
          처음으로
        </button>
        <button
          disabled={!ready || time <= 0}
          onClick={() => seek((Math.ceil((time - 0.00001) / step) - 1) * step)}
        >
          조금 이전
        </button>
        <button
          disabled={!ready || time >= lastFrame}
          onClick={() => seek((Math.floor((time + 0.00001) / step) + 1) * step)}
        >
          조금 다음
        </button>
        <button
          disabled={!ready}
          aria-pressed={rate === 0.5}
          onClick={() => {
            const next = rate === 1 ? 0.5 : 1;
            setRate(next);
            if (video.current) video.current.playbackRate = next;
          }}
        >
          {rate === 0.5 ? "느리게 보는 중" : "느리게 보기"}
        </button>
        <span>
          {recordingTime(time)} / {recordingTime(duration)}
        </span>
        <input
          type="range"
          min="0"
          max={lastFrame}
          step={1 / RECORDING_FPS}
          value={Math.min(time, lastFrame)}
          aria-label="영상 위치"
          aria-valuetext={recordingTime(time)}
          disabled={!ready}
          onChange={(e) => seek(Number(e.currentTarget.value))}
        />
        {onCapture && (
          <button
            type="button"
            className="capture-frame"
            disabled={
              paused || !ready || !decoded || seeking || captureDisabled
            }
            onClick={capture}
          >
            현재 장면 담기
          </button>
        )}
      </div>
      {error && (
        <p role="status" className="media-note">
          {error}
        </p>
      )}
    </div>
  );
}

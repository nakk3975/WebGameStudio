import type { CaseFile } from "../../../packages/contracts/src";
import lab from "./assets/lab.webp";
import hotel from "./assets/hotel.webp";
import auction from "./assets/auction.webp";
import stage from "./assets/stage.webp";
import island from "./assets/island.webp";
import hotelVideo from "./assets/hotel-cctv.mp4";
import MediaGallery from "./MediaGallery";
import type { CaseMedia } from "./case-media";

const photos = { lab, hotel, auction, stage, island };
export default function EvidenceView({
  file,
  related = [],
  paused = false,
}: {
  file: CaseFile;
  related?: CaseMedia[];
  paused?: boolean;
}) {
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
    <MediaGallery
      key={file.id}
      paused={paused}
      items={[
        {
          id: file.id,
          src: photos[asset],
          title: asset === "hotel" ? "CAM-404 · 복도 기록" : "현장 사진",
          alt:
            asset === "hotel"
              ? "노란 공사용 덮개가 있는 복도를 흰 시트 카트가 지나가는 재현 영상. 원본 기록은 06-12 14:32입니다. 카트는 복도 안쪽에서 가운데를 거쳐 우측으로 이동하고 같은 구간이 다시 재생됩니다."
              : file.alt || "사건 기록에 첨부된 현장 사진.",
          caption:
            asset === "hotel"
              ? "기록 속 복도 장면을 재현했습니다. 재생하거나 멈춰서 화면 표지와 원본 기록을 살펴보세요."
              : file.text,
          video: asset === "hotel" ? hotelVideo : undefined,
          observations,
        },
        ...related,
      ]}
    />
  );
}

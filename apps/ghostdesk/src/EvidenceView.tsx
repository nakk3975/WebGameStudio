import type { CaseFile, CasePackage } from "../../../packages/contracts/src";
import lab from "./assets/lab.webp";
import labClock from "./assets/lab-clock-check.jpg";
import auction from "./assets/auction.webp";
import stage from "./assets/stage.webp";
import island from "./assets/island.webp";
import { hotelClip } from "./cctv";
import MediaGallery from "./MediaGallery";
import { auctionEvidencePhoto, type CaseMedia } from "./case-media";
import { evidenceFile } from "./presentation";
import { isOfficialCaseVersion } from "./cases";

const photos = {
  lab,
  "clock-comparison": labClock,
  hotel: hotelClip.src,
  auction,
  stage,
  island,
};
export default function EvidenceView({
  casePackage,
  file,
  related = [],
  paused = false,
}: {
  casePackage: CasePackage;
  file: CaseFile;
  related?: CaseMedia[];
  paused?: boolean;
}) {
  file = evidenceFile(casePackage, file);
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
  if (asset === "clock-comparison" && !isOfficialCaseVersion(casePackage))
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
          src:
            asset === "auction" && isOfficialCaseVersion(casePackage)
              ? auctionEvidencePhoto(casePackage)
              : photos[asset],
          title: asset === "hotel" ? "CAM-404 · 복도 기록" : "현장 사진",
          alt:
            asset === "hotel"
              ? hotelClip.alt
              : file.alt || "사건 기록에 첨부된 현장 사진.",
          caption: asset === "hotel" ? hotelClip.caption : file.text,
          video: asset === "hotel" ? hotelClip.video : undefined,
          recording: asset === "hotel" ? hotelClip.recording : undefined,
          observations:
            asset === "hotel" ? hotelClip.observations : observations,
        },
        ...(isOfficialCaseVersion(casePackage) || asset === "hotel"
          ? []
          : related),
      ]}
    />
  );
}

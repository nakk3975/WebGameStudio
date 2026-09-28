# Fictional case scene assets

The initial five WebP images were generated for GhostDesk on 2026-09-28 and compressed from the original PNGs. They depict fictional locations, not real surveillance or evidence. The original generated files are retained outside this repository.

| Asset | Scene |
| --- | --- |
| lab.webp | Night archive laboratory |
| hotel.webp | Hotel hallway with linen trolley and maintenance cover |
| auction.webp | Auction inspection desk |
| stage.webp | Empty concert stage and sound desk |
| island.webp | Coastal observation hut |

Puzzle-critical dates, numbers and records are authored as accessible text in the case package or viewer overlays. Generated tiny lettering is never used as an answer source. The hotel image remains the poster for a playable fictional CCTV reconstruction; see the update below.


## Additional media / 2026-09-28

Two related photographs per case were added (ten new photos; fifteen scene photographs total including the hotel poster). They appear with their source records and in the main scene viewer only after that source is accessible. No published case JSON, answer, saved file, or database record was changed.

| Case | Added photos |
| --- | --- |
| Laboratory | lab-receipts.webp, lab-network.webp |
| Hotel | hotel-frontdesk.webp, hotel-laundry.webp |
| Auction | auction-envelopes.webp, auction-display.webp |
| Concert | stage-console.webp, stage-corridor.webp |
| Island | island-rope.webp, island-buoy.webp |

`hotel-cctv.mp4` is a 12-second silent composited reconstruction using two generated image layers, not real surveillance or generative video footage. It includes play/pause, seek, loop, a poster and a text alternative; it never auto-plays. Pausing the investigation, minimizing its window, closing its source disclosure, or selecting a photograph stops playback. Source layers, exact prompts and the build script are retained in `assets/cctv/`, `assets/MEDIA_PROMPTS.md`, and `scripts/build-cctv.sh`.

## 관찰 퍼즐 판 (v3)

- `hotel-frame-middle.webp`, `hotel-frame-exit.webp`: 원래 복도 사진을 기준으로 장면 전체를 이미지 편집 도구로 재구성. 카트와 그림자·반사는 한 사진에 포함된다.
- `hotel-cctv.mp4`: A/B/C/A/B/C/A를 각 4초씩 보여 주는 28초 장면 기록. 연속 촬영 또는 자연스러운 생성형 동영상이라고 표시하지 않는다. 카트 cutout 이동과 크기 애니메이션을 제거했다.
- `auction-seals.webp`: 한 줄/두 줄/찢어진 두 줄 봉인을 실제로 대조할 수 있는 v3 검수 사진. v1/v2는 기존 봉투 사진을 계속 사용한다.
- v3의 사진 표시와 비교판은 `VisualPuzzle.tsx`; 정확한 원본 시각은 HTML로 표시한다. 전체 영상 길이와 반복 주기를 구별할 수 있게 12초짜리 파일 대신 28초 관찰 구간을 제공한다.

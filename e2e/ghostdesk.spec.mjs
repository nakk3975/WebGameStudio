import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const cases = JSON.parse(
  readFileSync(
    new URL("../apps/ghostdesk/src/resolution-cases.json", import.meta.url),
  ),
);
const walkthrough = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/resolution-walkthrough.json", import.meta.url),
  ),
);
// Only static navigation/official answer data is read. Never import the engine,
// patch storage, route responses, call React handlers, or inject future files.
function win(page, id) {
  return page.locator(`[data-window-id="${id}"]`);
}
async function desktop(page) {
  await page
    .getByRole("button", { name: "바탕화면 보기", exact: true })
    .click();
  const previous = page.getByRole("button", {
    name: "이전 바탕화면 페이지",
    exact: true,
  });
  while ((await previous.count()) && (await previous.isEnabled()))
    await previous.click();
}
async function openFile(page, c, id) {
  const f = c.files.find((f) => f.id === id);
  await desktop(page);
  let area = page.getByRole("region", { name: "바탕화면 파일" });
  if (f.parentId) {
    await openFile(page, c, f.parentId);
    area = win(page, f.parentId);
  }
  const button = f.parentId
    ? area.getByRole("button", { name: f.title, exact: true })
    : page.locator(`[id="desktop-${f.id}"]`);
  if (!f.parentId) {
    while (!(await button.count())) {
      const next = page.getByRole("button", {
        name: "다음 바탕화면 페이지",
        exact: true,
      });
      await expect(next).toBeEnabled();
      await next.click();
    }
  }
  await button.click();
  await expect(win(page, id)).toBeVisible();
  return win(page, id);
}
async function putVideoBehindMemo(page, c, videoWindow) {
  await videoWindow.getByRole("button", { name: /왼쪽 배치$/ }).click();
  const memoFile = c.files[0];
  const memo = await openFile(page, c, memoFile.id);
  await memo.getByRole("button", { name: /오른쪽 배치$/ }).click();
  const videoTitle = (await videoWindow.getAttribute("aria-label")).replace(
    / 창$/,
    "",
  );
  await page
    .locator(".taskbar")
    .getByRole("button", { name: videoTitle, exact: true })
    .click();
  await page
    .locator(".taskbar")
    .getByRole("button", { name: memoFile.title, exact: true })
    .click();
  await expect(videoWindow).not.toHaveClass(/active/);
  return memo;
}
async function mediaChecks(page, c, seen) {
  // Open every currently reachable attachment through its rendered button.
  const active = win(
    page,
    await page.locator(".os-window.active").getAttribute("data-window-id"),
  );
  const links = active.locator(".photo-links button");
  const names = await links.allTextContents();
  for (const raw of names) {
    const name = raw.trim();
    if (seen.has(name)) continue;
    await active.getByRole("button", { name, exact: true }).click();
    const media = win(
      page,
      await page.locator(".os-window.active").getAttribute("data-window-id"),
    );
    if (await media.locator("video").count()) {
      const rearMemo = await putVideoBehindMemo(page, c, media);
      await expect(
        media.getByRole("button", { name: "영상 재생", exact: true }),
      ).toBeEnabled();
      await media
        .getByRole("button", { name: "영상 재생", exact: true })
        .click();
      await expect(
        media.getByRole("button", { name: "영상 일시정지", exact: true }),
      ).toBeVisible();
      await media
        .getByRole("button", { name: "영상 일시정지", exact: true })
        .click();
      await expect(media).toHaveClass(/active/);
      await rearMemo.locator(".window-controls button").last().click();
      seen.add(`video:${name}`);
      await media
        .getByRole("button", { name: "조금 다음", exact: true })
        .click();
      await expect(
        media.getByRole("button", { name: "조금 이전", exact: true }),
      ).toBeEnabled();
    } else {
      await expect(media.locator(".evidence-viewport img")).toBeVisible();
      await expect
        .poll(() =>
          media
            .locator(".evidence-viewport img")
            .evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      await media
        .getByRole("button", { name: "확대 보기", exact: true })
        .click();
      await expect(
        media.getByRole("button", { name: "전체 보기", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await media.locator(".window-controls button").last().click();
    const sourceTitle = (await active.getAttribute("aria-label")).replace(
      / 창$/,
      "",
    );
    await page
      .locator(".taskbar")
      .getByRole("button", { name: sourceTitle, exact: true })
      .click();
    seen.add(name);
  }
}
for (const c of cases)
  test(`${c.title}: guest v6 full investigation`, async ({ page }, info) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const route = walkthrough.find((w) => w.caseId === c.caseId);
    expect(c.versionId).toBe(route.versionId);
    await page.goto("/");
    await page
      .getByRole("button", { name: new RegExp(`^사건 \\d+ ${c.title}$`) })
      .click();
    await page
      .getByRole("button", { name: "사건 조사 시작", exact: true })
      .click();
    await page.getByRole("button", { name: /첫 메모 열기/ }).click();
    const memo = c.files.find((f) => f.id === route.steps[0].ruleSource);
    await expect(win(page, memo.id)).toContainText("담당자가 남긴 메모");
    await expect(win(page, memo.id)).toContainText(
      `「${route.steps[0].folder}」 폴더 암호`,
    );
    const seen = new Set();
    // Open a visible scene file (404호 links its still photo from the video).
    await desktop(page);
    await openFile(page, c, c.files.find((f) => f.type === "IMAGE").id);
    if (await page.locator(".os-window.active video").count())
      await page
        .locator(".os-window.active .photo-links")
        .getByRole("button")
        .last()
        .click();
    const photo = win(
      page,
      await page.locator(".os-window.active").getAttribute("data-window-id"),
    );
    await expect
      .poll(() =>
        photo
          .locator("img")
          .first()
          .evaluate((img) => img.complete && img.naturalWidth > 0),
      )
      .toBe(true);
    // Keep photo on right, memo on left. A single click on the BACK window's
    // control must both focus it and act, without losing/replacing the DOM node.
    await photo.getByRole("button", { name: /오른쪽 배치$/ }).click();
    await openFile(page, c, memo.id);
    await win(page, memo.id)
      .getByRole("button", { name: /왼쪽 배치$/ })
      .click();
    const photoTitle = (await photo.getAttribute("aria-label")).replace(
      / 창$/,
      "",
    );
    await page
      .locator(".taskbar")
      .getByRole("button", { name: photoTitle, exact: true })
      .click();
    const memoWin = win(page, memo.id);
    await page
      .locator(".taskbar")
      .getByRole("button", { name: memo.title, exact: true })
      .click();
    await expect(photo).not.toHaveClass(/active/);
    await photo.getByRole("button", { name: "확대 보기", exact: true }).click();
    await expect(
      photo.getByRole("button", { name: "전체 보기", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(photo).toHaveClass(/active/);
    await expect(memoWin).not.toHaveClass(/active/);
    await memoWin.getByRole("button", { name: /최대화$/ }).click();
    await expect(memoWin).toHaveClass(/max/);
    await expect(memoWin).toHaveClass(/active/);
    await memoWin.locator(".window-controls button").last().click();
    await page
      .locator(".taskbar")
      .getByRole("button", { name: photoTitle, exact: true })
      .click();
    await photo.locator(".window-controls button").last().click();
    for (let i = 0; i < route.steps.length; i++) {
      const step = route.steps[i];
      await test.step(`${i + 1}/10 ${step.folder}`, async () => {
        for (const id of [...new Set([step.ruleSource, ...step.sources])]) {
          const source = await openFile(page, c, id);
          if (id === step.ruleSource)
            await expect(source).toContainText(`「${step.folder}」`);
          if (await source.locator("video").count()) {
            const rearMemo = await putVideoBehindMemo(page, c, source);
            await expect(
              source.getByRole("button", { name: "영상 재생", exact: true }),
            ).toBeEnabled();
            await source
              .getByRole("button", { name: "영상 재생", exact: true })
              .click();
            await expect(
              source.getByRole("button", {
                name: "영상 일시정지",
                exact: true,
              }),
            ).toBeVisible();
            await source
              .getByRole("button", { name: "영상 일시정지", exact: true })
              .click();
            await expect(source).toHaveClass(/active/);
            await rearMemo.locator(".window-controls button").last().click();
            seen.add(`video:${id}`);
          }
          await mediaChecks(page, c, seen);
          await source.locator(".window-controls button").last().click();
        }
        const f = c.files.find((f) => f.puzzleId === c.puzzles[i].id);
        await openFile(page, c, f.id);
        const folder = win(page, f.id);
        const rail = page.getByRole("navigation", { name: "폴더 바로가기" });
        for (let j = i + 1; j < route.steps.length; j++)
          await expect(
            rail.getByRole("button", {
              name: `${route.steps[j].folder} · 암호 필요`,
              exact: true,
            }),
          ).toBeDisabled();
        // password inputs do not have textbox role.
        const field = folder.getByLabel("폴더 암호", { exact: true });
        const submit = folder.getByRole("button", {
          name: i === 9 ? "해결 승인" : "폴더 열기",
          exact: true,
        });
        for (const bad of ["NOT-A-VALID-ANSWER", step.answer.slice(0, -1)]) {
          await field.fill(bad);
          if (!bad) {
            await expect(submit).toBeDisabled();
            continue;
          }
          await submit.click();
          await expect(page.getByRole("alert")).toContainText(
            "암호가 맞지 않습니다",
          );
          await expect(field).toBeVisible();
          await expect(
            rail.getByRole("button", {
              name: `${step.folder} · 암호 필요`,
              exact: true,
            }),
          ).toBeVisible();
        }
        await field.fill(step.answer);
        await submit.click();
        await expect(
          rail.getByRole("button", {
            name: `${step.folder} · 잠금 해제됨`,
            exact: true,
          }),
        ).toBeVisible();
        if (i < 9)
          await expect(
            win(
              page,
              c.files.find((f) => f.puzzleId === c.puzzles[i + 1].id).id,
            ),
          ).toBeVisible();
        if (i === 4) {
          await expect(page.locator(".save-state")).toContainText(
            "이 기기에 저장됨",
          );
          await page.reload();
          await page
            .getByRole("button", { name: "이어서 조사", exact: true })
            .click();
          await expect(
            page.getByRole("dialog", { name: "조사를 잠시 멈췄습니다" }),
          ).toBeVisible();
          await expect(page.getByRole("dialog")).toContainText(
            "사건 속 시간은 흐르지 않았습니다",
          );
          await expect(rail).toContainText("잠금 해제 5/10");
          for (let j = 0; j <= i; j++)
            await expect(
              rail.getByRole("button", {
                name: `${route.steps[j].folder} · 잠금 해제됨`,
                exact: true,
              }),
            ).toBeVisible();
          await page
            .getByRole("button", { name: "조사 계속하기", exact: true })
            .click();
          await expect(
            page.getByRole("dialog", { name: "조사를 잠시 멈췄습니다" }),
          ).toHaveCount(0);
          await expect(
            rail.getByRole("button", {
              name: `${step.folder} · 잠금 해제됨`,
              exact: true,
            }),
          ).toBeVisible();
        }
      });
    }
    expect([...seen].some((name) => name.startsWith("video:"))).toBe(
      c.caseId !== "demo-0317",
    );
    const ending = c.endings.find((e) => !e.revisitable);
    await expect(
      page.getByRole("dialog", { name: ending.title, exact: true }),
    ).toContainText(ending.text);
    await expect(
      page.getByRole("button", { name: "조사 기록 다시 보기", exact: true }),
    ).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("dialog", { name: ending.title, exact: true })
      .getByRole("button", { name: "진행 파일 저장", exact: true })
      .click();
    const save = JSON.parse(
      readFileSync(await (await downloaded).path(), "utf8"),
    );
    expect(save.format).toBe("ghostdesk-save-1");
    expect(save.case).toEqual(c);
    expect(save.state.mode).toBe("ENDED");
    expect(save.state.endingId).toBe(ending.id);
    expect(save.state.solvedPuzzleIds).toEqual(c.puzzles.map((p) => p.id));
    await info.attach("completed-save", {
      body: JSON.stringify(save, null, 2),
      contentType: "application/json",
    });
    await info.attach("completed-investigation", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await page
      .getByRole("button", { name: "사건 선택으로", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "선택한 사건" })
        .filter({ visible: true }),
    ).toContainText("조사 완료");
    expect(errors).toEqual([]);
  });

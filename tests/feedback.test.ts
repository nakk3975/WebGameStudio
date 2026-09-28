import { describe, it, expect } from "vitest";
import { parseSave, importJson } from "../apps/ghostdesk/src/storage";
import {
  UserMessage,
  userMessage,
  issueLocation,
  issueMessage,
} from "../apps/ghostdesk/src/feedback";
import { sample } from "../apps/ghostdesk/src/sample";
import { initialState } from "../packages/engine-ghostdesk/src";
describe("player-facing import boundary", () => {
  const progress = {
    format: "ghostdesk-save-1",
    case: sample,
    state: initialState(sample),
    notes: "기록",
    checkpoint: null,
  };
  it.each(["progress.gdsave", "old-progress.json"])(
    "keeps exported and legacy saves compatible: %s",
    async (name) => {
      const raw = await importJson(new File([JSON.stringify(progress)], name));
      expect(parseSave(raw).notes).toBe("기록");
    },
  );
  it("does not expose parser details from malformed files", async () => {
    await expect(
      importJson(new File(["{bad JSON"], "broken.gdsave")),
    ).rejects.toThrow("파일을 읽을 수 없습니다");
  });
  it("rejects oversized files with an understandable limit", async () => {
    await expect(
      importJson(new File(["x".repeat(1048577)], "large.gdsave")),
    ).rejects.toThrow("1MB 이하");
  });
  it.each([
    {},
    { ...progress, state: { ...progress.state, engineVersion: "unsupported" } },
    { ...progress, notes: 123 },
  ])("hides internal validation paths while refusing a damaged save", (raw) => {
    try {
      parseSave(raw);
      throw Error("must reject");
    } catch (e) {
      expect(e).toBeInstanceOf(UserMessage);
      expect((e as Error).message).not.toMatch(
        /JSON|engineVersion|schema|Zod|invalid_type/,
      );
    }
  });
  it("displays only explicitly approved user messages", () => {
    expect(
      userMessage(
        new TypeError("Failed to fetch https://internal/api"),
        "연결을 확인해 주세요.",
      ),
    ).toBe("연결을 확인해 주세요.");
    expect(
      userMessage(new UserMessage("다시 로그인해 주세요."), "다시 시도"),
    ).toBe("다시 로그인해 주세요.");
  });
  it("labels broken editor links by their visible item name", () => {
    expect(issueLocation("files.0.puzzleId", sample)).toContain(
      sample.files[0].title,
    );
    expect(
      issueMessage({
        path: "files.0.puzzleId",
        message: "없는 puzzles 참조: p-missing",
      }),
    ).not.toMatch(/puzzles|p-missing|참조/);
  });
});

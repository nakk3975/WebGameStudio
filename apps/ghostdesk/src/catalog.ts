import {
  validateCase,
  type CasePackage,
} from "../../../packages/contracts/src";

/** Published content only. No local saves or draft data leave this device. */
export async function loadPublishedCase(
  base: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<CasePackage> {
  const root = base.replace(/\/$/, "");
  // AbortSignal.any is absent from Safari before 17.4. Keep cancellation portable.
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, 12000);
  try {
    const response = await fetch(
      `${root}/api/v1/ghostdesk/versions/${encodeURIComponent(versionId)}/package`,
      {
        signal: controller.signal,
        credentials: "omit",
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok)
      throw new Error(`Catalog unavailable (${response.status})`);
    const text = await response.text();
    if (text.length > 500000) throw new Error("Case exceeds size limit");
    const checked = validateCase(JSON.parse(text));
    if (!checked.data) throw new Error("Invalid case package");
    const parsed = checked.data;
    if (parsed.versionId !== versionId)
      throw new Error("Case version mismatch");
    return parsed;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

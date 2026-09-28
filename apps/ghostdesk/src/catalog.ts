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
  const timed = AbortSignal.timeout(12000);
  const combined = signal ? AbortSignal.any([signal, timed]) : timed;
  const response = await fetch(
    `${root}/api/v1/ghostdesk/versions/${encodeURIComponent(versionId)}/package`,
    {
      signal: combined,
      credentials: "omit",
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) throw new Error(`Catalog unavailable (${response.status})`);
  const text = await response.text();
  if (text.length > 500000) throw new Error("Case exceeds size limit");
  const checked = validateCase(JSON.parse(text));
  if (!checked.data) throw new Error("Invalid case package");
  const parsed = checked.data;
  if (parsed.versionId !== versionId) throw new Error("Case version mismatch");
  return parsed;
}

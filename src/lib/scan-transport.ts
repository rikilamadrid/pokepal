import { createEdgeTransport, type RecognitionTransport } from "@/lib/recognition";

/** Dev-only URL flag that swaps in the recorded 6-card fixture transport. */
export const DEV_SCAN_FIXTURE_PARAM = "scan-fixture";

/**
 * The recognition transport Batch Scan uses: the Edge Function transport,
 * except in development with `?scan-fixture`, where a recorded fixture replays
 * a 6-card photo with no network or model call. The fixture module is
 * dynamically imported, so it never reaches the production bundle's path.
 */
export async function getScanTransport(): Promise<RecognitionTransport> {
  if (
    process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has(DEV_SCAN_FIXTURE_PARAM)
  ) {
    const { createDevScanTransport } = await import("@/data/dev-scan-fixture");
    return createDevScanTransport();
  }
  return createEdgeTransport();
}

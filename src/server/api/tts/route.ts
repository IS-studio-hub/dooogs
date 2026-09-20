import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * TTS is browser-only now (free). Kept so old clients get a clear response.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "tts_browser_only",
      hint: "Voice uses the free browser speech engine — no API key needed.",
    },
    { status: 501 }
  );
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TTL_SECONDS = 1800;

export async function POST(): Promise<Response> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPGRAM_API_KEY missing" }, { status: 500 });
  }

  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: TTL_SECONDS }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "deepgram_grant_failed", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return NextResponse.json({ accessToken: data.access_token, expiresIn: data.expires_in });
}

import { NextResponse } from "next/server";

export async function GET() {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    null;

  return NextResponse.json(
    {
      googleMapsApiKey,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

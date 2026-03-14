import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    googleMapsApiKey:
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
      null,
  });
}

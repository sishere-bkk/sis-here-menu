import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("staff_session", "", { path: "/", maxAge: 0 });
  response.cookies.set("staff_display_name", "", { path: "/", maxAge: 0 });
  return response;
}

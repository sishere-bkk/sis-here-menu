import { NextRequest, NextResponse } from "next/server";
import { verifyValue } from "./lib/session";

async function getValidStaffName(
  cookieValue: string,
  secret: string
): Promise<string | null> {
  const separatorIndex = cookieValue.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const payload = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);

  const valid = await verifyValue(payload, signature, secret);
  if (!valid) return null;

  const [name, expiresAtStr] = payload.split("|");
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!name || !expiresAt || Date.now() > expiresAt) return null;

  return name;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // หน้า login เข้าได้เสมอ ไม่ต้องเช็ค session
  if (pathname === "/staff/login") {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("staff_session")?.value;
  const secret = process.env.STAFF_SESSION_SECRET as string;
  const staffName = cookie ? await getValidStaffName(cookie, secret) : null;

  if (!staffName) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบใหม่" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/staff/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/:path*", "/api/staff-orders/:path*", "/api/stock/:path*"]
};

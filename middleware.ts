import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const base64Value = authHeader.split(" ")[1] ?? "";
    const [, password] = atob(base64Value).split(":");

    if (password === process.env.STAFF_PASSWORD) {
      return NextResponse.next();
    }
  }

  return new NextResponse("กรุณาใส่รหัสผ่านเพื่อเข้าหน้าพนักงาน", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Staff Area"'
    }
  });
}

export const config = {
  matcher: ["/staff/:path*", "/api/staff-orders/:path*"]
};

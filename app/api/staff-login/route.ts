import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signValue } from "../../../lib/session";

export const runtime = "edge";

const SESSION_HOURS = 12;

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const pin = String(body.pin ?? "").trim();

  if (!pin) {
    return NextResponse.json({ error: "กรุณาใส่ PIN" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data, error } = await admin
    .from("staff")
    .select("name, active")
    .eq("pin", pin)
    .maybeSingle();

  if (error || !data || !data.active) {
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }

  const secret = process.env.STAFF_SESSION_SECRET as string;
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${data.name}|${expiresAt}`;
  const signature = await signValue(payload, secret);
  const cookieValue = `${payload}.${signature}`;

  const response = NextResponse.json({ success: true, name: data.name });

  // cookie หลัก - ใช้ยืนยันตัวตนจริง (แก้ไม่ได้จากฝั่งลูกค้า)
  response.cookies.set("staff_session", cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60
  });

  // cookie สำรอง - เก็บชื่อไว้โชว์บนหน้าจอเฉยๆ ไม่ใช้ยืนยันตัวตน
  response.cookies.set("staff_display_name", data.name, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60
  });

  return response;
}

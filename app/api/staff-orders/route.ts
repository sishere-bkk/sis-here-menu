export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}
function getTodayRangeBangkok() {
  const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
  const nowUtcMs = Date.now();
  const bangkokNowMs = nowUtcMs + BANGKOK_OFFSET_MS;
  const bangkokNow = new Date(bangkokNowMs);
  const startOfDayBangkokMs =
    Date.UTC(
      bangkokNow.getUTCFullYear(),
      bangkokNow.getUTCMonth(),
      bangkokNow.getUTCDate()
    ) - BANGKOK_OFFSET_MS;
  const endOfDayBangkokMs = startOfDayBangkokMs + 24 * 60 * 60 * 1000;
  return {
    startOfDay: new Date(startOfDayBangkokMs),
    endOfDay: new Date(endOfDayBangkokMs)
  };
}
export async function GET(request: NextRequest) {
  const admin = getAdmin();
  const { startOfDay, endOfDay } = getTodayRangeBangkok();
  const { searchParams } = new URL(request.url);
  // status: "new" (ค่าเริ่มต้น, ยังไม่รับ) หรือ "accepted" (รับเงินแล้ว ไว้ดูย้อนหลัง/void คืนได้)
  const status = searchParams.get("status") ?? "new";
  const { data, error } = await admin
    .from("orders")
    .select("*")
    .eq("status", status)
    .gte("created_at", startOfDay.toISOString())
    .lt("created_at", endOfDay.toISOString())
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data });
}
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, action } = body as {
    id: number;
    action?: "print" | "accept" | "cancel" | "unaccept";
  };
  // ดึงชื่อพนักงานจาก cookie ที่ middleware ตรวจสอบผ่านมาแล้ว
  const cookie = request.cookies.get("staff_session")?.value ?? "";
  const separatorIndex = cookie.lastIndexOf(".");
  const payload = separatorIndex !== -1 ? cookie.slice(0, separatorIndex) : "";
  const staffName = payload.split("|")[0] || "ไม่ทราบชื่อ";
  const admin = getAdmin();
  // ไม่ส่ง action มา = ของเดิม (เผื่อโค้ดฝั่งอื่นยังเรียกแบบเก่าอยู่) ถือเป็น "print"
  const effectiveAction = action ?? "print";
  if (effectiveAction === "print") {
    // แค่บันทึกว่าพิมพ์แล้ว ไม่เปลี่ยนสถานะ ไม่เอาออกจากคิว
    const { error } = await admin
      .from("orders")
      .update({ printed_by: staffName, printed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }
  if (effectiveAction === "accept") {
    const { error } = await admin
      .from("orders")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }
  if (effectiveAction === "unaccept") {
    // ยกเลิกการรับเงิน คืนกลับไปเป็นออเดอร์ใหม่เหมือนเดิม (เผื่อรับผิด/กดพลาด)
    const { error } = await admin
      .from("orders")
      .update({ status: "new", accepted_at: null })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }
  if (effectiveAction === "cancel") {
    const { error } = await admin
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// หาช่วงเวลา "วันนี้" ตามเขตเวลาไทย (Asia/Bangkok = UTC+7)
// คำนวณด้วยตัวเลขล้วนๆ เพื่อความชัวร์ ไม่พึ่งการแปลงข้อความวันที่
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

export async function GET() {
  const admin = getAdmin();
  const { startOfDay, endOfDay } = getTodayRangeBangkok();

  const { data, error } = await admin
    .from("orders")
    .select("*")
    .eq("status", "new")
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
  const { id } = body;
  const admin = getAdmin();
  const { error } = await admin
    .from("orders")
    .update({ status: "printed" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

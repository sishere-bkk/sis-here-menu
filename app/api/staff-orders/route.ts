import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// หาช่วงเวลา "วันนี้" ตามเขตเวลาไทย (Asia/Bangkok) แล้วแปลงเป็น UTC
// เพื่อกรองออเดอร์ - ออเดอร์เก่าข้ามวันจะไม่โผล่มาอีก
function getTodayRangeBangkok() {
  const now = new Date();
  const bkkDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now); // "YYYY-MM-DD"

  const startOfDay = new Date(`${bkkDateStr}T00:00:00+07:00`);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return { startOfDay, endOfDay };
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

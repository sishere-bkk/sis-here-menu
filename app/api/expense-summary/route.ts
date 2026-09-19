import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export async function GET() {
  const today = todayBangkok();

  // รายจ่ายวันนี้ (สำหรับการ์ดด้านบน + popup ดูรายละเอียด)
  const { data: todayRows, error: todayError } = await supabase
    .from("expenses")
    .select("*")
    .eq("expense_date", today)
    .order("created_at", { ascending: false });

  if (todayError) {
    return NextResponse.json({ error: todayError.message }, { status: 500 });
  }

  // ยอดสะสมทั้งหมด แยกตามหมวด (สำหรับ bar + donut "สะสมทั้งหมด")
  const { data: allRows, error: allError } = await supabase
    .from("expenses")
    .select("amount, category");

  if (allError) {
    return NextResponse.json({ error: allError.message }, { status: 500 });
  }

  const todayTotal = (todayRows ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const allTimeTotal = (allRows ?? []).reduce((s, r) => s + Number(r.amount), 0);

  const allTimeByCategory: Record<string, number> = {};
  for (const r of allRows ?? []) {
    allTimeByCategory[r.category] = (allTimeByCategory[r.category] ?? 0) + Number(r.amount);
  }

  return NextResponse.json({
    todayTotal,
    todayCount: (todayRows ?? []).length,
    todayEntries: todayRows ?? [],
    allTimeTotal,
    allTimeByCategory,
  });
}

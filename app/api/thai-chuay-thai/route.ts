import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// GET: คืนบันทึกทั้งหมด (ใหม่ไปเก่า) พร้อมยอดรวมสะสม
export async function GET() {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("thai_chuay_thai_log")
    .select("*")
    .order("entry_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = (data ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  return NextResponse.json({ entries: data, total });
}

// POST: เพิ่มบันทึก 1 รายการ
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { entryDate, amount, note } = body as {
    entryDate: string;
    amount: number;
    note?: string;
  };

  if (!entryDate || amount === undefined) {
    return NextResponse.json({ error: "missing entryDate/amount" }, { status: 400 });
  }

  const admin = getAdmin();
  const { error } = await admin
    .from("thai_chuay_thai_log")
    .insert({ entry_date: entryDate, amount, note: note || null });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

// GET: คืนออเดอร์ของช่องทาง+ช่วงวันที่ที่ยังไม่กระทบยอด พร้อมยอดรวมที่คีย์ไว้
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel"); // "grab" | "lineman"
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to"); // YYYY-MM-DD แบบ exclusive (front คำนวณ +1 วันมาให้แล้ว)

  if (!channel || !from || !to) {
    return NextResponse.json({ error: "missing channel/from/to" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data, error } = await admin
    .from("orders")
    .select("id, created_at, total_amount, platform_order_no, status")
    .eq("channel", channel)
    .eq("reconciled", false)
    .neq("status", "cancelled")
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const keyedTotal = (data ?? []).reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

  return NextResponse.json({ orders: data, keyedTotal });
}

// POST: กรอกยอดรวมที่ได้รับจริงของช่วงที่เลือก (ใช้ทั้ง Grab และ LINE MAN เหมือนกัน)
// -> เฉลี่ย fee ลงแต่ละออเดอร์ตามสัดส่วนยอดที่คีย์ไว้ แล้ว mark reconciled = true ทั้งหมด
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { channel, from, to, actualReceived } = body as {
    channel: string;
    from: string;
    to: string;
    actualReceived: number;
  };

  if (!channel || !from || !to || actualReceived === undefined) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data: orders, error } = await admin
    .from("orders")
    .select("id, total_amount")
    .eq("channel", channel)
    .eq("reconciled", false)
    .neq("status", "cancelled")
    .gte("created_at", from)
    .lt("created_at", to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: "ไม่พบออเดอร์ในช่วงที่เลือก" }, { status: 400 });
  }

  const keyedTotal = orders.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);
  const totalFee = Math.max(0, keyedTotal - Number(actualReceived));

  let assignedSoFar = 0;
  const updates = orders.map((o, idx) => {
    const isLast = idx === orders.length - 1;
    const share = keyedTotal > 0 ? Number(o.total_amount ?? 0) / keyedTotal : 0;
    const fee = isLast ? totalFee - assignedSoFar : Math.round(totalFee * share);
    assignedSoFar += fee;
    return { id: o.id, fee };
  });

  for (const u of updates) {
    const { error: updateError } = await admin
      .from("orders")
      .update({ fee: u.fee, reconciled: true })
      .eq("id", u.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, ordersUpdated: updates.length, totalFee });
}

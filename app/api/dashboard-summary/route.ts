import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DRINKS_CATEGORY = "เครื่องดื่ม";

function getTodayRangeBangkok() {
  const now = new Date();
  const bangkokNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
  const startBangkok = new Date(
    bangkokNow.getFullYear(),
    bangkokNow.getMonth(),
    bangkokNow.getDate(),
    0, 0, 0
  );
  const endBangkok = new Date(
    bangkokNow.getFullYear(),
    bangkokNow.getMonth(),
    bangkokNow.getDate(),
    23, 59, 59
  );
  const startUtc = new Date(startBangkok.getTime() - 7 * 60 * 60 * 1000);
  const endUtc = new Date(endBangkok.getTime() - 7 * 60 * 60 * 1000);
  return { startUtc: startUtc.toISOString(), endUtc: endUtc.toISOString() };
}

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const { startUtc, endUtc } = getTodayRangeBangkok();

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id, channel, total_amount, status")
    .gte("created_at", startUtc)
    .lte("created_at", endUtc);

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  // นับเฉพาะออเดอร์ที่ "รับเงินแล้ว" เท่านั้น (ไม่นับออเดอร์ใหม่ที่ยังไม่รับเงิน และที่ยกเลิกไปแล้ว)
  const validOrders = (orders ?? []).filter((o) => o.status === "accepted");
  const orderIds = validOrders.map((o) => o.id);

  const { data: orderItems } = orderIds.length
    ? await supabaseAdmin
        .from("order_items")
        .select("item_name, quantity, order_id")
        .in("order_id", orderIds)
    : { data: [] as { item_name: string; quantity: number; order_id: number }[] };

  // ดึงเมนูมาไว้เช็คหมวดหมู่ (ตัดเครื่องดื่มออกจาก Top 5) — ชื่อในออเดอร์อาจเป็นชื่อออนไลน์หรือชื่อฝั่ง Grab/LINE MAN ก็ได้
  const { data: menuRows } = await supabaseAdmin
    .from("menu")
    .select("name, category, delivery_name");
  const categoryByName = new Map<string, string | null>();
  for (const m of menuRows ?? []) {
    categoryByName.set(m.name, m.category);
    if (m.delivery_name) categoryByName.set(m.delivery_name, m.category);
  }

  const totalSales = validOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);
  const orderCount = validOrders.length;
  const avgOrderValue = orderCount ? totalSales / orderCount : 0;

  const byChannel: Record<string, number> = {};
  for (const o of validOrders) {
    const ch = o.channel ?? "online_menu";
    byChannel[ch] = (byChannel[ch] ?? 0) + (o.total_amount ?? 0);
  }

  const byItem: Record<string, number> = {};
  for (const item of orderItems ?? []) {
    if (categoryByName.get(item.item_name) === DRINKS_CATEGORY) continue; // ตัดหมวดเครื่องดื่มออก
    byItem[item.item_name] = (byItem[item.item_name] ?? 0) + item.quantity;
  }
  const topItems = Object.entries(byItem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalItemQty = Object.values(byItem).reduce((sum, qty) => sum + qty, 0);

  return NextResponse.json({
    totalSales,
    orderCount,
    avgOrderValue,
    byChannel,
    topItems,
    totalItemQty,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
function formatDateTime() {
  const now = new Date();
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${dateFmt.format(now)} ${timeFmt.format(now)}`;
}
function buildReceiptBody(
  orderType: string,
  tableNumber: string | null,
  customerName: string | null,
  customerPhone: string | null,
  items: any[],
  total: number
) {
  const separator = "-".repeat(30);
  const sourceLabel =
    orderType === "table"
      ? `Table ${tableNumber}`
      : orderType === "takeaway"
      ? "Take Away"
      : "อื่นๆ";
  const lines: string[] = [];
  lines.push(`วันที่ / เวลา : ${formatDateTime()}`);
  lines.push(`โต๊ะ / ประเภท : ${sourceLabel}`);
  if (orderType === "takeaway") {
    lines.push(`ชื่อคนสั่ง / เบอร์โทร : ${customerName} / ${customerPhone}`);
  }
  lines.push(separator);
  for (const line of items) {
    const lineTotal = line.unitPrice * line.qty;
    const namePart = `${line.qty} x ${line.name}`;
    const pricePart = `${lineTotal.toFixed(0)} บาท`;
    const gap = Math.max(1, 26 - namePart.length - pricePart.length);
    lines.push(namePart + " ".repeat(gap) + pricePart);
    if (line.options) {
      const opts = String(line.options)
        .split(",")
        .map((o: string) => o.trim())
        .filter(Boolean);
      for (const opt of opts) {
        lines.push(`   + ${opt}`);
      }
    }
    if (line.note) {
      lines.push(`   + ${line.note}`);
    }
  }
  lines.push(separator);
  lines.push(`ราคารวม : ${total} บาท`);
  return lines.join("\n");
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderType, tableNumber, customerName, customerPhone, items, total } = body;
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert({
        order_type: orderType,
        table_number: tableNumber ?? null,
        customer_name: customerName ?? null,
        customer_phone: customerPhone ?? null,
        items,
        status: "new"
      })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const orderId = data.id;

    // เพิ่มรายการอาหารทีละบรรทัดลง order_items (สำหรับ Phase 1 POS)
    // เก็บชื่อ/ราคา ณ ตอนขายจริง ไม่ผูกกับตาราง menu
    const orderItemsRows = (items as any[]).map((line) => ({
      order_id: orderId,
      item_name: line.name,
      quantity: line.qty,
      unit_price: line.unitPrice,
      modifiers: line.options ? { options: line.options } : null,
      note: line.note ?? null,
      line_total: line.unitPrice * line.qty
    }));
    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsRows);
    if (itemsError) {
      // ไม่ทำให้ทั้ง order ล้มเหลว แค่ log ไว้ดู เพราะ order หลักบันทึกสำเร็จแล้ว
      console.error("order_items insert error:", itemsError.message);
    }

    // อัปเดตช่องทาง/ยอดรวมของ order ให้ครบ (เผื่อใช้ทำ Dashboard ทีหลัง)
    await supabaseAdmin
      .from("orders")
      .update({
        channel: "online_menu",
        subtotal: total,
        discount: 0,
        fee: 0,
        total_amount: total
      })
      .eq("id", orderId);

    const receiptBody = buildReceiptBody(
      orderType,
      tableNumber,
      customerName,
      customerPhone,
      items,
      total
    );
    if (process.env.DISCORD_WEBHOOK_URL) {
      const discordMessage = `🔔 ออเดอร์ใหม่ #${orderId}\n\`\`\`\n${receiptBody}\n\`\`\``;
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: discordMessage })
      });
    }
    if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      const lineMessage = `🔔 ออเดอร์ใหม่ #${orderId}\n${receiptBody}`;
      const lineRes = await fetch("https://api.line.me/v2/bot/message/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          messages: [{ type: "text", text: lineMessage }]
        })
      });
      console.log("LINE API status:", lineRes.status);
    }
    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

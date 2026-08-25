import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const summaryLines = items
      .map(
        (line: any) =>
          `${line.name} x${line.qty}${line.note ? ` (${line.note})` : ""}`
      )
      .join("\n");
    const sourceLabel =
      orderType === "table"
        ? `โต๊ะ ${tableNumber}`
        : orderType === "takeaway"
        ? `กลับบ้าน - ${customerName} (${customerPhone})`
        : "ออเดอร์ทดสอบ";
    const messageText = `🔔 ออเดอร์ใหม่ #${orderId}\n${sourceLabel}\n\n${summaryLines}\n\nยอดรวม: ${total} บาท`;

    if (process.env.DISCORD_WEBHOOK_URL) {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText })
      });
    }

    if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      await fetch("https://api.line.me/v2/bot/message/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          messages: [{ type: "text", text: messageText }]
        })
      });
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

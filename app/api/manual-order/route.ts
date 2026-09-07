import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channel, platformOrderNo, keyedBy, items, total } = body;
    // channel: "grab" | "lineman"

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    const { data, error } = await supabaseAdmin
      .from("orders")
      .insert({
        order_type: "manual",
        channel,
        platform_order_no: platformOrderNo ?? null,
        keyed_by: keyedBy ?? null,
        items,
        subtotal: total,
        discount: 0,
        fee: 0,
        total_amount: total,
        reconciled: false,
        status: "new"
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const orderId = data.id;

    const orderItemsRows = (items as any[]).map((line) => ({
      order_id: orderId,
      item_name: line.name,
      quantity: line.qty,
      unit_price: line.unitPrice,
      modifiers: line.options ? { options: line.options } : null,
      note: line.note ?? null,
      line_total: line.unitPrice * line.qty,
      is_custom: line.isCustom ?? false // true = รายการด่วน/พิมพ์เอง ไม่ผูกเมนูจริง
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsRows);
    if (itemsError) {
      console.error("order_items insert error:", itemsError.message);
    }

    return NextResponse.json({ success: true, orderId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase.from("expenses").select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false });
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { expenseDate, amount, category, note, source, slipImageUrl, originalSlipAmount } = body;

  if (!expenseDate || !amount || !category) {
    return NextResponse.json({ error: "ข้อมูลไม่ครบ (วันที่/จำนวนเงิน/หมวด)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      expense_date: expenseDate,
      amount: Number(amount),
      category,
      note: note || null,
      source: source || "manual",
      slip_image_url: slipImageUrl || null,
      original_slip_amount: originalSlipAmount || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, expenseDate, amount, category, note } = body;
  if (!id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  const { data, error } = await supabase
    .from("expenses")
    .update({ expense_date: expenseDate, amount: Number(amount), category, note: note || null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ไม่มี id" }, { status: 400 });

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

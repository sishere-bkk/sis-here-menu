import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

export async function GET() {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("orders")
    .select("*")
    .eq("status", "new")
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

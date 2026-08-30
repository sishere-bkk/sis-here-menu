import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

function itemLine(it: any): string {
  if (it.count_method === "level") return `- ${it.name}`;
  return `- ${it.name} (เหลือ ${it.count_value ?? 0} ${it.unit ?? ""})`;
}

export async function POST() {
  const admin = getAdmin();

  const { data: items, error } = await admin
    .from("stock_items")
    .select("*")
    .eq("active", true)
    .in("status", ["ใกล้หมด", "หมด"])
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ success: true, count: 0 });
  }

  const lowItems = items.filter((it) => it.status === "ใกล้หมด");
  const outItems = items.filter((it) => it.status === "หมด");

  const parts: string[] = [":package: แจ้งเตือนสต๊อก", ""];

  if (lowItems.length > 0) {
    parts.push(":orange_circle: สต๊อกใกล้หมด");
    parts.push(...lowItems.map(itemLine));
    parts.push("");
  }

  if (outItems.length > 0) {
    parts.push(":red_circle: สต๊อกหมด");
    parts.push(...outItems.map(itemLine));
  }

  const content = parts.join("\n").trim();
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL as string;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });

  if (!res.ok) {
    return NextResponse.json({ error: "ส่ง Discord ไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: items.length });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );
}

const LEVEL_TO_STATUS: Record<string, string> = {
  "เยอะ": "ปกติ",
  "ครึ่ง": "เฝ้าดู",
  "ใกล้หมด": "ใกล้หมด",
  "หมด": "หมด"
};

function countStatus(value: number, min: number | null) {
  if (value <= 0) return "หมด";
  if (min !== null && value <= min) return "ใกล้หมด";
  return "ปกติ";
}

function getStaffName(request: NextRequest): string {
  const cookie = request.cookies.get("staff_session")?.value ?? "";
  const separatorIndex = cookie.lastIndexOf(".");
  const payload = separatorIndex !== -1 ? cookie.slice(0, separatorIndex) : "";
  return payload.split("|")[0] || "ไม่ทราบชื่อ";
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, action, value } = body;
  const staffName = getStaffName(request);
  const admin = getAdmin();
  const nowIso = new Date().toISOString();

  const { data: item, error: fetchError } = await admin
    .from("stock_items")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !item) {
    return NextResponse.json({ error: "ไม่พบรายการนี้" }, { status: 404 });
  }

  // action "confirm" = พนักงานเช็คแล้วแต่ค่าเท่าเดิม ไม่ต้องแก้อะไร แค่บันทึกว่าเช็คแล้ว
  if (action === "confirm") {
    const currentValue =
      item.count_method === "level" ? item.level_value ?? "" : String(item.count_value ?? 0);

    const { error: updateError } = await admin
      .from("stock_items")
      .update({ last_checked_at: nowIso, checked_by: staffName })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await admin.from("stock_log").insert({
      stock_id: id,
      item_name: item.name,
      changed_by: staffName,
      from_value: currentValue,
      to_value: currentValue
    });

    return NextResponse.json({ success: true, status: item.status });
  }

  let update: Record<string, any> = {};
  let fromValue = "";
  let toValue = "";

  if (item.count_method === "level") {
    fromValue = item.level_value ?? "";
    const newLevel: string = action === "set_level" ? value : item.level_value;
    if (!LEVEL_TO_STATUS[newLevel]) {
      return NextResponse.json({ error: "ค่าระดับไม่ถูกต้อง" }, { status: 400 });
    }
    update = { level_value: newLevel, status: LEVEL_TO_STATUS[newLevel] };
    toValue = newLevel;
  } else {
    const currentValue = Number(item.count_value ?? 0);
    let newValue = currentValue;
    if (action === "delta") {
      newValue = Math.max(0, currentValue + Number(value));
    } else if (action === "set_count") {
      newValue = Math.max(0, Number(value));
    } else {
      return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
    }
    fromValue = String(currentValue);
    toValue = String(newValue);
    update = {
      count_value: newValue,
      status: countStatus(newValue, item.min_value)
    };
  }

  // updated_at/updated_by = แก้ไขค่าล่าสุดเมื่อไหร่ / โดยใคร
  update.updated_at = nowIso;
  update.updated_by = staffName;
  // last_checked_at/checked_by = เช็ควันนี้แล้วหรือยัง (ใช้กับไฟบนการ์ด)
  update.last_checked_at = nowIso;
  update.checked_by = staffName;

  const { error: updateError } = await admin
    .from("stock_items")
    .update(update)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin.from("stock_log").insert({
    stock_id: id,
    item_name: item.name,
    changed_by: staffName,
    from_value: fromValue,
    to_value: toValue
  });

  return NextResponse.json({ success: true, status: update.status });
}

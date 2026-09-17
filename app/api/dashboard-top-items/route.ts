import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DRINKS_CATEGORY = "เครื่องดื่ม";

// หมวดที่เป็น "เซต" (รวมหลายเมนูไว้ในชื่อเดียว) — ไม่นับยอดเป็นชื่อเซตเอง
// ทั้งฝั่งขายดีและขายน้อย เพราะจะถูกแตกไปนับที่เมนูย่อยแทนทั้งหมด
const SET_CATEGORIES = ["เซตสุดฮิต", "อร่อยซ่ากับโค้ก"];

// ตารางแตกเซต: menu id ของเซต -> menu id ของเมนูย่อยที่นับแทน (ตัดเครื่องดื่มที่ติดมากับเซตออกแล้ว)
// เซตไหนไม่อยู่ในตารางนี้ (เช่นเซตที่เลิกขายไปแล้ว) จะยังนับเป็นชื่อเซตเดิมไปเฉยๆ เหมือนก่อนแก้
const SET_EXPANSIONS: Record<number, number[]> = {
  85: [66, 67], // ข้าวไก่ทอด + ข้าวยำไก่แซ่บ
  84: [61, 65], // ทงคัตสึ ข้าวคลุกกะเพรากรอบ + ข้าวหมูทอด ทงคัตสึ
  81: [66],     // ข้าวไก่ทอด ไข่ดาวเป็ดลาวา + โค้ก
  82: [64],     // ข้าวคลุกกะเพรา อกไก่ ไข่เป็ดลาวา + โค้ก
  80: [62],     // ข้าวผัดคลาสสิก อเมริกัน ไข่ดาว + โค้ก
  79: [67],     // ข้าวยำไก่แซ่บ ไข่ดาวเป็ดลาวา + โค้ก
  77: [65],     // ข้าวหมูทอด ทงคัตสึ + โค้ก
  76: [61],     // ทงคัตสึ ข้าวคลุกกะเพรากรอบ + โค้ก
  78: [59],     // สปาเก็ตตี้ คั่วพริกแห้ง + โค้ก
};

function getBangkokYMD(utcMs: number) {
  const bkk = new Date(utcMs + BANGKOK_OFFSET_MS);
  return { y: bkk.getUTCFullYear(), m: bkk.getUTCMonth(), d: bkk.getUTCDate() };
}

function startOfBangkokDayUtcMs(y: number, m: number, d: number) {
  return Date.UTC(y, m, d) - BANGKOK_OFFSET_MS;
}

type TopItem = [string, number];

export async function GET() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const nowMs = Date.now();
  const today = getBangkokYMD(nowMs);
  const todayStartMs = startOfBangkokDayUtcMs(today.y, today.m, today.d);
  const tomorrowStartMs = todayStartMs + DAY_MS;
  const weekStartMs = todayStartMs - 6 * DAY_MS; // 7 วันล่าสุดรวมวันนี้
  const monthStartMs = startOfBangkokDayUtcMs(today.y, today.m, 1);
  const fetchStartMs = Math.min(weekStartMs, monthStartMs);

  // 1) เมนูทั้งหมด ใช้สร้างตารางจับคู่ชื่อ -> เมนูจริง (ชื่อออนไลน์ กับ ชื่อฝั่ง Grab/LINE MAN อาจไม่เหมือนกัน)
  const { data: menuRows, error: menuError } = await admin
    .from("menu")
    .select("id, name, category, delivery_name, available");
  if (menuError) {
    return NextResponse.json({ error: menuError.message }, { status: 500 });
  }

  type MenuAlias = { menuId: number; canonicalName: string; category: string | null };
  const aliasToMenu = new Map<string, MenuAlias>();
  for (const row of menuRows ?? []) {
    const alias: MenuAlias = { menuId: row.id, canonicalName: row.name, category: row.category };
    aliasToMenu.set(row.name, alias);
    if (row.delivery_name) aliasToMenu.set(row.delivery_name, alias);
  }

  // ไว้หาชื่อจริงของเมนูย่อยตอนแตกเซต
  const menuById = new Map<number, { name: string; category: string | null }>();
  for (const row of menuRows ?? []) {
    menuById.set(row.id, { name: row.name, category: row.category });
  }

  // เมนูขายน้อย: เอาเฉพาะเมนูที่ยังเปิดขายอยู่จริง ไม่ใช่เครื่องดื่ม และไม่ใช่หมวดเซต
  // (หมวดเซตตัดออกเพราะยอดของตัวเองจะเป็น 0 เสมอหลังแตกไปนับที่เมนูย่อยแล้ว ถ้าไม่ตัดจะโผล่เป็น "ขายน้อยสุด" ปลอมๆ)
  const activeNonDrinkMenu = (menuRows ?? []).filter(
    (r) => r.available && r.category !== DRINKS_CATEGORY && !SET_CATEGORIES.includes(r.category ?? "")
  );

  // 2) ออเดอร์ที่ "รับเงินแล้ว" ในช่วงที่ต้องใช้ (ครอบคลุมทั้งสัปดาห์และเดือนนี้)
  const { data: orders, error: ordersError } = await admin
    .from("orders")
    .select("id, created_at, status")
    .eq("status", "accepted")
    .gte("created_at", new Date(fetchStartMs).toISOString())
    .lt("created_at", new Date(tomorrowStartMs).toISOString());
  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }
  const orderMetaById = new Map<number, number>(); // order id -> created_at (ms)
  for (const o of orders ?? []) {
    orderMetaById.set(o.id, new Date(o.created_at as string).getTime());
  }
  const orderIds = [...orderMetaById.keys()];

  // 3) รายการเมนูที่ขายในออเดอร์เหล่านั้น
  const { data: orderItems } = orderIds.length
    ? await admin
        .from("order_items")
        .select("item_name, quantity, order_id")
        .in("order_id", orderIds)
    : { data: [] as { item_name: string; quantity: number; order_id: number }[] };

  const weekSums = new Map<string, number>();
  const monthSums = new Map<string, number>();
  const nameForKey = new Map<string, string>();

  for (const item of orderItems ?? []) {
    const createdMs = orderMetaById.get(item.order_id);
    if (createdMs === undefined) continue;

    const alias = aliasToMenu.get(item.item_name);
    if (alias?.category === DRINKS_CATEGORY) continue; // ตัดหมวดเครื่องดื่มออก

    // ถ้าเป็นเมนูเซตที่มีตารางแตกไว้ ให้บวกยอดให้เมนูย่อยแทน (ซ้อนกันได้หลายตัว)
    // ถ้าไม่ใช่เซต หรือเป็นเซตที่ไม่มีในตาราง (เช่นเลิกขายแล้ว) นับเป็นชื่อเดิมตามปกติ
    const expansionIds = alias ? SET_EXPANSIONS[alias.menuId] : undefined;
    const targets = expansionIds
      ? expansionIds.map((id) => ({
          key: `m:${id}`,
          name: menuById.get(id)?.name ?? `menu-${id}`
        }))
      : [
          {
            key: alias ? `m:${alias.menuId}` : `c:${item.item_name}`,
            name: alias ? alias.canonicalName : item.item_name
          }
        ];

    for (const t of targets) {
      nameForKey.set(t.key, t.name);
      if (createdMs >= weekStartMs) {
        weekSums.set(t.key, (weekSums.get(t.key) ?? 0) + item.quantity);
      }
      if (createdMs >= monthStartMs) {
        monthSums.set(t.key, (monthSums.get(t.key) ?? 0) + item.quantity);
      }
    }
  }

  function topN(sums: Map<string, number>, n: number): TopItem[] {
    return [...sums.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, qty]) => [nameForKey.get(key) ?? key, qty]);
  }

  const topWeekItems = topN(weekSums, 5);
  const topMonthItems = topN(monthSums, 5);
  const totalWeekQty = [...weekSums.values()].reduce((s, v) => s + v, 0);
  const totalMonthQty = [...monthSums.values()].reduce((s, v) => s + v, 0);

  // เมนูขายน้อยสุดของเดือนนี้: ต้องมาจากเมนูที่ "ยังเปิดขายอยู่จริง" เท่านั้น (ไม่เอาเมนูที่ปิดไปแล้วมาป็นข้อมูลหลอก)
  // รวมเมนูที่ยอดขาย 0 ชิ้นด้วย เพราะเป็นข้อมูลสำคัญพอๆ กับเมนูที่ขายได้น้อย
  const bottomCandidates = activeNonDrinkMenu.map((m) => {
    const qty = monthSums.get(`m:${m.id}`) ?? 0;
    return { name: m.name, qty };
  });
  bottomCandidates.sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name, "th"));
  const bottomMonthItems: TopItem[] = bottomCandidates.slice(0, 5).map((r) => [r.name, r.qty]);
  const zeroSoldCount = bottomCandidates.filter((r) => r.qty === 0).length;

  return NextResponse.json({
    topWeekItems,
    topMonthItems,
    bottomMonthItems,
    zeroSoldCount,
    monthDayCount: today.d,
    totalWeekQty,
    totalMonthQty
  });
}

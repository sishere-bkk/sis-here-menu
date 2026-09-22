import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const THAI_DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// แปลงเวลาปัจจุบัน (utc ms) ให้ได้ ปี/เดือน/วัน ตามเวลากรุงเทพ
function getBangkokYMD(utcMs: number) {
  const bkk = new Date(utcMs + BANGKOK_OFFSET_MS);
  return {
    y: bkk.getUTCFullYear(),
    m: bkk.getUTCMonth(), // 0-11
    d: bkk.getUTCDate()
  };
}

// เวลาเริ่มต้นของวันนั้นๆ (เที่ยงคืนตามเวลากรุงเทพ) แปลงกลับเป็น utc ms
function startOfBangkokDayUtcMs(y: number, m: number, d: number) {
  return Date.UTC(y, m, d) - BANGKOK_OFFSET_MS;
}

// ถอยหลัง n เดือนจาก ปี/เดือน ที่กำหนด (จัดการข้ามปีให้ด้วย)
function shiftMonth(y: number, m: number, delta: number) {
  const total = y * 12 + m + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return { y: ny, m: nm };
}

// จำนวนวันในเดือนนั้นๆ (m คือ 0-11)
function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null = ไม่มีฐานเทียบ (เดือน/สัปดาห์ก่อนไม่มียอดเลย)
  return ((current - previous) / previous) * 100;
}

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  );

  const nowMs = Date.now();
  const today = getBangkokYMD(nowMs);
  const todayStartMs = startOfBangkokDayUtcMs(today.y, today.m, today.d);
  const tomorrowStartMs = todayStartMs + DAY_MS;

  const prevMonth = shiftMonth(today.y, today.m, -1);
  const fetchStartMs = startOfBangkokDayUtcMs(prevMonth.y, prevMonth.m, 1);

  // ดึงออเดอร์ตั้งแต่ต้นเดือนก่อนหน้า จนถึงสิ้นวันนี้ (ครอบคลุมทั้งกราฟ 7 วัน / เทียบสัปดาห์ / เทียบเดือน)
  // เพิ่ม fee เข้ามาด้วย เพื่อรวมเป็นค่าคอมมิชชั่น (ออเดอร์ที่ยังไม่กระทบยอด fee จะเป็น 0/null อยู่แล้ว ไม่ต้องกรองเพิ่ม)
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("total_amount, status, created_at, channel, fee")
    .eq("status", "accepted")
    .gte("created_at", new Date(fetchStartMs).toISOString())
    .lt("created_at", new Date(tomorrowStartMs).toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // รวมยอดขาย + ค่าคอมมิชชั่น แยกตามวัน (key = "y-m-d" ตามเวลากรุงเทพ)
  const dailyTotals = new Map<string, number>();
  const dailyFees = new Map<string, number>();
  for (const o of orders ?? []) {
    const createdMs = new Date(o.created_at as string).getTime();
    const { y, m, d } = getBangkokYMD(createdMs);
    const key = `${y}-${m}-${d}`;
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + (o.total_amount ?? 0));
    dailyFees.set(key, (dailyFees.get(key) ?? 0) + Number((o as any).fee ?? 0));
  }

  // สร้างกราฟยอดขายย้อนหลัง 7 วัน (เก่าสุด -> วันนี้)
  const dailySales: { date: string; label: string; total: number }[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const dayStartMs = todayStartMs - offset * DAY_MS;
    const { y, m, d } = getBangkokYMD(dayStartMs);
    const key = `${y}-${m}-${d}`;
    const weekday = new Date(Date.UTC(y, m, d)).getUTCDay();
    dailySales.push({
      date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      label: THAI_DAY_LABELS[weekday],
      total: dailyTotals.get(key) ?? 0
    });
  }

  const thisWeekTotal = dailySales.reduce((sum, day) => sum + day.total, 0);

  // ค่าคอมมิชชั่นวันนี้ (ไว้ใช้คำนวณกำไรวันนี้ในหน้าเปรียบเทียบ)
  const todayFee = dailyFees.get(`${today.y}-${today.m}-${today.d}`) ?? 0;

  // ยอดขายแยกตามช่องทาง ของสัปดาห์นี้ (7 วันล่าสุด) และเดือนนี้ (วันที่ 1 ถึงวันนี้)
  const weekStartMs = todayStartMs - 6 * DAY_MS;
  const monthStartMs = startOfBangkokDayUtcMs(today.y, today.m, 1);
  const weekByChannel: Record<string, number> = {};
  const monthByChannel: Record<string, number> = {};
  let thisWeekFee = 0;
  let thisMonthFee = 0;
  for (const o of orders ?? []) {
    const createdMs = new Date(o.created_at as string).getTime();
    const ch = (o as any).channel ?? "online_menu";
    const fee = Number((o as any).fee ?? 0);
    if (createdMs >= weekStartMs) {
      weekByChannel[ch] = (weekByChannel[ch] ?? 0) + (o.total_amount ?? 0);
      thisWeekFee += fee;
    }
    if (createdMs >= monthStartMs) {
      monthByChannel[ch] = (monthByChannel[ch] ?? 0) + (o.total_amount ?? 0);
      thisMonthFee += fee;
    }
  }

  // สัปดาห์ก่อนหน้า = 7 วันก่อนช่วง 7 วันล่าสุด (วันที่ 8-14 วันก่อนวันนี้)
  let lastWeekTotal = 0;
  let lastWeekFee = 0;
  for (let offset = 13; offset >= 7; offset--) {
    const dayStartMs = todayStartMs - offset * DAY_MS;
    const { y, m, d } = getBangkokYMD(dayStartMs);
    const key = `${y}-${m}-${d}`;
    lastWeekTotal += dailyTotals.get(key) ?? 0;
    lastWeekFee += dailyFees.get(key) ?? 0;
  }

  // เดือนนี้ (ตั้งแต่วันที่ 1 ถึงวันนี้) เทียบกับเดือนก่อนหน้าช่วงจำนวนวันเท่ากัน (เทียบแบบยุติธรรม ไม่เอาทั้งเดือนมาเทียบกับเดือนที่ยังไม่จบ)
  let thisMonthTotal = 0;
  let lastMonthSamePeriodTotal = 0;
  let lastMonthSamePeriodFee = 0;
  const lastMonthDayCap = Math.min(today.d, daysInMonth(prevMonth.y, prevMonth.m));
  for (const [key, amount] of dailyTotals.entries()) {
    const [yStr, mStr, dStr] = key.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (y === today.y && m === today.m && d <= today.d) {
      thisMonthTotal += amount;
    } else if (y === prevMonth.y && m === prevMonth.m && d <= lastMonthDayCap) {
      lastMonthSamePeriodTotal += amount;
      lastMonthSamePeriodFee += dailyFees.get(key) ?? 0;
    }
  }

  return NextResponse.json({
    dailySales,
    thisWeekTotal,
    lastWeekTotal,
    weekChangePct: pctChange(thisWeekTotal, lastWeekTotal),
    thisMonthTotal,
    lastMonthSamePeriodTotal,
    monthChangePct: pctChange(thisMonthTotal, lastMonthSamePeriodTotal),
    monthCompareDayCount: lastMonthDayCap,
    weekByChannel,
    monthByChannel,
    // ค่าคอมมิชชั่น (จากตารางกระทบยอด) — ไว้ให้หน้าเปรียบเทียบดึงไปนับเป็นรายจ่ายเพิ่ม ไม่ต้องคีย์ซ้ำ
    todayFee,
    thisWeekFee,
    lastWeekFee,
    thisMonthFee,
    lastMonthSamePeriodFee
  });
}

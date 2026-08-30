import { supabase } from "./supabaseClient";

// เวลาเปิด-ปิดร้านประจำสัปดาห์ (เขตเวลาไทย)
// key = วันในสัปดาห์ : 0=อาทิตย์, 1=จันทร์, 2=อังคาร, 3=พุธ, 4=พฤหัสบดี, 5=ศุกร์, 6=เสาร์
type DayHours = { open: string; close: string } | null;

const WEEKLY_HOURS: Record<number, DayHours> = {
  0: null, // อาทิตย์ หยุด
  1: { open: "08:30", close: "17:30" },
  2: { open: "08:30", close: "17:30" },
  3: { open: "08:30", close: "17:30" },
  4: { open: "08:30", close: "17:30" },
  5: { open: "08:30", close: "17:30" },
  6: { open: "08:30", close: "14:00" } // เสาร์
};

function getBangkokNowParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };

  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    weekday: weekdayMap[map.weekday] ?? now.getDay()
  };
}

export type StoreStatus = {
  isOpen: boolean;
  reason: "closed_date" | "outside_hours" | "weekly_off" | null;
  todayHours: DayHours;
};

export async function getStoreStatus(): Promise<StoreStatus> {
  const { dateStr, hour, minute, weekday } = getBangkokNowParts();
  const todayHours = WEEKLY_HOURS[weekday];

  const { data } = await supabase
    .from("closed_dates")
    .select("closed_date")
    .eq("closed_date", dateStr)
    .maybeSingle();

  if (data) {
    return { isOpen: false, reason: "closed_date", todayHours };
  }

  if (!todayHours) {
    return { isOpen: false, reason: "weekly_off", todayHours };
  }

  const nowMinutes = hour * 60 + minute;
  const [openH, openM] = todayHours.open.split(":").map(Number);
  const [closeH, closeM] = todayHours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (nowMinutes < openMinutes || nowMinutes >= closeMinutes) {
    return { isOpen: false, reason: "outside_hours", todayHours };
  }

  return { isOpen: true, reason: null, todayHours };
}

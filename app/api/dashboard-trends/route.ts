import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function daysAgoBangkok(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
}

function labelTh(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00+07:00");
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }).format(d);
}

export async function GET() {
  const today = todayBangkok();
  const monthPrefix = today.slice(0, 7);
  const lastMonthDate = new Date(today + "T12:00:00+07:00");
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthPrefix = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" })
    .format(lastMonthDate)
    .slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));

  const from40 = daysAgoBangkok(40);
  const { data: rows, error } = await supabase
    .from("expenses")
    .select("amount, category, expense_date")
    .gte("expense_date", from40)
    .lte("expense_date", today);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const allRows = rows ?? [];

  const last7Dates = Array.from({ length: 7 }, (_, i) => daysAgoBangkok(6 - i));
  const dailyExpenses = last7Dates.map((date) => ({
    date,
    label: labelTh(date),
    total: allRows.filter((r) => r.expense_date === date).reduce((s, r) => s + Number(r.amount), 0),
  }));

  const thisWeekDates = last7Dates;
  const lastWeekDates = Array.from({ length: 7 }, (_, i) => daysAgoBangkok(13 - i));
  const thisWeekTotal = allRows.filter((r) => thisWeekDates.includes(r.expense_date)).reduce((s, r) => s + Number(r.amount), 0);
  const lastWeekTotal = allRows.filter((r) => lastWeekDates.includes(r.expense_date)).reduce((s, r) => s + Number(r.amount), 0);
  const weekChangePct = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : null;

  const thisMonthTotal = allRows
    .filter((r) => r.expense_date.slice(0, 7) === monthPrefix)
    .reduce((s, r) => s + Number(r.amount), 0);
  const lastMonthSamePeriodTotal = allRows
    .filter((r) => r.expense_date.slice(0, 7) === lastMonthPrefix && Number(r.expense_date.slice(8, 10)) <= dayOfMonth)
    .reduce((s, r) => s + Number(r.amount), 0);
  const monthChangePct =
    lastMonthSamePeriodTotal > 0 ? ((thisMonthTotal - lastMonthSamePeriodTotal) / lastMonthSamePeriodTotal) * 100 : null;

  const weekByCategory: Record<string, number> = {};
  for (const r of allRows.filter((r) => thisWeekDates.includes(r.expense_date))) {
    weekByCategory[r.category] = (weekByCategory[r.category] ?? 0) + Number(r.amount);
  }
  const monthByCategory: Record<string, number> = {};
  for (const r of allRows.filter((r) => r.expense_date.slice(0, 7) === monthPrefix)) {
    monthByCategory[r.category] = (monthByCategory[r.category] ?? 0) + Number(r.amount);
  }

  return NextResponse.json({
    dailyExpenses,
    thisWeekTotal,
    lastWeekTotal,
    weekChangePct,
    thisMonthTotal,
    lastMonthSamePeriodTotal,
    monthChangePct,
    monthCompareDayCount: dayOfMonth,
    weekByCategory,
    monthByCategory,
  });
}

"use client";

import { useEffect, useState } from "react";

const CHANNEL_LABELS: Record<string, string> = {
  online_menu: "เมนูออนไลน์",
  grab: "Grab",
  lineman: "LINE MAN",
};

type Summary = {
  totalSales: number;
  orderCount: number;
  avgOrderValue: number;
  byChannel: Record<string, number>;
  topItems: [string, number][];
};

type DailySale = { date: string; label: string; total: number };

type Trends = {
  dailySales: DailySale[];
  thisWeekTotal: number;
  lastWeekTotal: number;
  weekChangePct: number | null;
  thisMonthTotal: number;
  lastMonthSamePeriodTotal: number;
  monthChangePct: number | null;
  monthCompareDayCount: number;
};

export default function DashboardTab() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);

  useEffect(() => {
    function load() {
      fetch("/api/dashboard-summary")
        .then((res) => res.json())
        .then((json) => {
          setData(json);
          setLoading(false);
        });
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function loadTrends() {
      fetch("/api/dashboard-trends")
        .then((res) => res.json())
        .then((json) => {
          setTrends(json);
          setTrendsLoading(false);
        });
    }
    loadTrends();
    // ข้อมูลย้อนหลัง ไม่ต้องอัปเดตถี่เท่ายอดวันนี้ ทุก 30 วินาทีพอ
    const interval = setInterval(loadTrends, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-ink/50">กำลังโหลด...</p>;
  if (!data) return <p className="text-ink/50">โหลดข้อมูลไม่สำเร็จ</p>;

  const maxItemQty = data.topItems.length ? data.topItems[0][1] : 1;

  return (
    <div>
      <div className="mb-6 flex gap-3">
        <Card label="ยอดขายรวม" value={`${data.totalSales.toLocaleString()} บาท`} />
        <Card label="จำนวน Order" value={`${data.orderCount}`} />
        <Card label="เฉลี่ย/บิล" value={`${data.avgOrderValue.toFixed(0)} บาท`} />
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink">ยอดขายย้อนหลัง 7 วัน</h3>
      <div className="mb-6">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && !trends && (
          <p className="text-xs text-ink/40">โหลดข้อมูลไม่สำเร็จ</p>
        )}
        {trends && <DailyBarChart days={trends.dailySales} />}

        {trends && (
          <div className="mt-3 flex gap-3">
            <CompareCard
              label="สัปดาห์นี้ (7 วันล่าสุด)"
              current={trends.thisWeekTotal}
              previous={trends.lastWeekTotal}
              pct={trends.weekChangePct}
              previousLabel="สัปดาห์ก่อน"
            />
            <CompareCard
              label={`เดือนนี้ (${trends.monthCompareDayCount} วันแรก)`}
              current={trends.thisMonthTotal}
              previous={trends.lastMonthSamePeriodTotal}
              pct={trends.monthChangePct}
              previousLabel={`เดือนก่อน (${trends.monthCompareDayCount} วันแรกเท่ากัน)`}
            />
          </div>
        )}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink">ยอดขายแยกตามช่องทาง</h3>
      <div className="mb-6">
        {Object.keys(data.byChannel).length === 0 && <Empty />}
        {Object.entries(data.byChannel).map(([ch, amount]) => (
          <BarRow
            key={ch}
            label={CHANNEL_LABELS[ch] ?? ch}
            value={amount}
            max={data.totalSales || 1}
            display={`${amount.toLocaleString()} บาท`}
          />
        ))}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink">เมนูขายดี Top 5 วันนี้</h3>
      <div>
        {data.topItems.length === 0 && <Empty />}
        {data.topItems.map(([name, qty]) => (
          <BarRow key={name} label={name} value={qty} max={maxItemQty} display={`${qty} ชิ้น`} />
        ))}
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl bg-forest/10 p-4">
      <div className="mb-1 text-xs text-ink/60">{label}</div>
      <div className="text-lg font-bold text-ink">{value}</div>
    </div>
  );
}

function DailyBarChart({ days }: { days: DailySale[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const today = days[days.length - 1]?.date;
  return (
    <div className="flex items-end gap-2 rounded-xl bg-forest/5 px-3 py-4" style={{ height: 160 }}>
      {days.map((day) => {
        const heightPct = Math.max(4, Math.round((day.total / max) * 100));
        const isToday = day.date === today;
        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-ink/50">
              {day.total >= 1000 ? `${(day.total / 1000).toFixed(1)}k` : day.total.toFixed(0)}
            </span>
            <div
              className="flex w-full items-end"
              style={{ height: 90 }}
            >
              <div
                className={isToday ? "w-full rounded-t bg-forestDark" : "w-full rounded-t bg-forest"}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className={isToday ? "text-[11px] font-semibold text-forestDark" : "text-[11px] text-ink/60"}>
              {day.label}
              {isToday ? " (วันนี้)" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CompareCard({
  label,
  current,
  previous,
  pct,
  previousLabel,
}: {
  label: string;
  current: number;
  previous: number;
  pct: number | null;
  previousLabel: string;
}) {
  const isUp = pct != null && pct > 0;
  const isDown = pct != null && pct < 0;
  return (
    <div className="flex-1 rounded-xl bg-forest/10 p-3">
      <div className="mb-1 text-xs text-ink/60">{label}</div>
      <div className="text-base font-bold text-ink">{current.toLocaleString()} บาท</div>
      <div className="mt-1 text-xs">
        {pct == null ? (
          <span className="text-ink/40">ยังไม่มี{previousLabel}ให้เทียบ</span>
        ) : (
          <span className={isUp ? "text-green-700" : isDown ? "text-red-600" : "text-ink/50"}>
            {isUp ? "▲" : isDown ? "▼" : "–"} {Math.abs(pct).toFixed(0)}% จาก{previousLabel} (
            {previous.toLocaleString()} บาท)
          </span>
        )}
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
}) {
  const pct = Math.max(4, Math.round((value / max) * 100));
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-ink">{label}</span>
        <span className="text-ink/60">{display}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-forest/10">
        <div className="h-full bg-forest" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-ink/40">ยังไม่มีข้อมูลวันนี้</p>;
}

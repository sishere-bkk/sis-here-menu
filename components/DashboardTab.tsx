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

type TopItemsData = {
  topWeekItems: [string, number][];
  topMonthItems: [string, number][];
  bottomMonthItems: [string, number][];
  zeroSoldCount: number;
  monthDayCount: number;
};

export default function DashboardTab() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(true);
  const [topItemsData, setTopItemsData] = useState<TopItemsData | null>(null);
  const [topItemsLoading, setTopItemsLoading] = useState(true);

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

  useEffect(() => {
    function loadTopItems() {
      fetch("/api/dashboard-top-items")
        .then((res) => res.json())
        .then((json) => {
          setTopItemsData(json);
          setTopItemsLoading(false);
        });
    }
    loadTopItems();
    const interval = setInterval(loadTopItems, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-ink/50">กำลังโหลด...</p>;
  if (!data) return <p className="text-ink/50">โหลดข้อมูลไม่สำเร็จ</p>;

  const maxItemQty = data.topItems.length ? data.topItems[0][1] : 1;

  return (
    <div>
      <div className="mb-6 flex gap-3">
        <Card label="ยอดขายวันนี้" value={`${data.totalSales.toLocaleString()} บาท`} />
        <Card label="จำนวน Order วันนี้" value={`${data.orderCount}`} />
        <Card label="เฉลี่ย/บิล วันนี้" value={`${data.avgOrderValue.toFixed(0)} บาท`} />
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
      <div className="mb-6">
        {data.topItems.length === 0 && <Empty />}
        {data.topItems.map(([name, qty]) => (
          <BarRow key={name} label={name} value={qty} max={maxItemQty} display={`${qty} ชิ้น`} />
        ))}
      </div>

      <p className="mb-3 text-xs text-ink/40">
        3 รายการด้านล่างนี้ไม่รวมหมวด &quot;เครื่องดื่ม&quot;
      </p>

      <h3 className="mb-2 text-sm font-semibold text-ink">เมนูขายดี Top 5 สัปดาห์นี้</h3>
      <div className="mb-6">
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <TopItemsList items={topItemsData.topWeekItems} unit="ชิ้น" />
        )}
      </div>

      <h3 className="mb-2 text-sm font-semibold text-ink">เมนูขายดี Top 5 เดือนนี้</h3>
      <div className="mb-6">
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <TopItemsList items={topItemsData.topMonthItems} unit="ชิ้น" />
        )}
      </div>

      <h3 className="mb-1 text-sm font-semibold text-ink">เมนูขายน้อยสุด Top 5 เดือนนี้</h3>
      {!topItemsLoading && topItemsData && topItemsData.zeroSoldCount > 0 && (
        <p className="mb-2 text-xs text-ink/40">
          มีเมนูที่ยอดขาย 0 ชิ้นเดือนนี้ทั้งหมด {topItemsData.zeroSoldCount} รายการ
        </p>
      )}
      <div>
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <TopItemsList items={topItemsData.bottomMonthItems} unit="ชิ้น" />
        )}
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
  const BAR_AREA_PX = 120; // ความสูงพื้นที่แท่งกราฟ (ไม่รวมตัวเลขและป้ายวัน)
  const today = days[days.length - 1]?.date;
  return (
    <div>
      <div
        className="flex items-end gap-2 rounded-xl border border-forest/15 bg-white px-3 pb-3 pt-4"
      >
        {days.map((day) => {
          // ใช้พิกเซลตรงๆ แทน % เพื่อกันไม่ให้ค่าน้อยๆ (หรือ 0) เตี้ยจนมองไม่เห็นเป็นแท่ง
          const heightPx = Math.max(6, Math.round((day.total / max) * BAR_AREA_PX));
          const isToday = day.date === today;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <span
                className="whitespace-nowrap text-[11px] font-medium text-ink/70"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {Math.round(day.total).toLocaleString()}
              </span>
              <div className="flex w-full items-end justify-center" style={{ height: BAR_AREA_PX }}>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: heightPx,
                    backgroundColor: isToday ? "#E8792F" : "#8B3A2B"
                  }}
                />
              </div>
              <span
                className={
                  isToday
                    ? "text-xs font-bold"
                    : "text-xs text-ink/60"
                }
                style={isToday ? { color: "#E8792F" } : undefined}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-ink/40">
        <span style={{ color: "#E8792F" }}>■</span> แท่งสีส้ม = วันนี้ (หน่วย: บาท)
      </p>
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

function TopItemsList({ items, unit }: { items: [string, number][]; unit: string }) {
  if (items.length === 0) return <Empty />;
  const max = Math.max(1, ...items.map(([, qty]) => qty));
  return (
    <div>
      {items.map(([name, qty]) => (
        <BarRow key={name} label={name} value={qty} max={max} display={`${qty} ${unit}`} />
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-ink/40">ยังไม่มีข้อมูลวันนี้</p>;
}

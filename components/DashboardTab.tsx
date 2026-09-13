"use client";

import { useEffect, useState, type ReactNode } from "react";

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
  totalItemQty: number;
  allTimeByChannel: Record<string, number>;
  allTimeTotalSales: number;
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
  weekByChannel: Record<string, number>;
  monthByChannel: Record<string, number>;
};

type TopItemsData = {
  topWeekItems: [string, number][];
  topMonthItems: [string, number][];
  bottomMonthItems: [string, number][];
  zeroSoldCount: number;
  monthDayCount: number;
  totalWeekQty: number;
  totalMonthQty: number;
};

// สีสำหรับกราฟวงกลม เมนู (ไล่ตามลำดับ 1-5 ของ top5 แล้วที่เหลือใช้สีเทาเป็น "อื่นๆ")
const ITEM_PIE_COLORS = ["#8B3A2B", "#E8792F", "#B85A1F", "#F2B705", "#3A2A18"];
const OTHERS_COLOR = "#C9C2B4";
// สีช่องทาง ใช้สีเดียวกับที่ตั้งไว้ในหน้าคีย์ออเดอร์ ให้สอดคล้องกันทั้งระบบ
const CHANNEL_COLORS: Record<string, string> = {
  online_menu: "#E8792F",
  grab: "#0F6B3D",
  lineman: "#16A34A",
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

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Card label="ยอดขายวันนี้" value={`${data.totalSales.toLocaleString()} บาท`} />
        <Card label="Order วันนี้" value={`${data.orderCount}`} />
        <Card label="เฉลี่ย/บิล วันนี้" value={`${data.avgOrderValue.toFixed(0)} บาท`} />
      </div>

      <Section icon="📈" title="ยอดขายย้อนหลัง 7 วัน">
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
      </Section>

      <Section icon="🛍️" title="ยอดขายแยกตามช่องทาง" subtitle="ยอดสะสมทั้งหมด">
        {Object.keys(data.allTimeByChannel).length === 0 && <Empty />}
        {Object.entries(data.allTimeByChannel).map(([ch, amount]) => (
          <BarRow
            key={ch}
            label={CHANNEL_LABELS[ch] ?? ch}
            value={amount}
            max={data.allTimeTotalSales || 1}
            display={`${amount.toLocaleString()} บาท`}
          />
        ))}
        {Object.keys(data.allTimeByChannel).length > 0 && (
          <div className="mt-3">
            <DonutChart
              segments={Object.entries(data.allTimeByChannel).map(([ch, amount]) => ({
                label: CHANNEL_LABELS[ch] ?? ch,
                value: amount,
                color: CHANNEL_COLORS[ch] ?? OTHERS_COLOR,
              }))}
            />
          </div>
        )}
      </Section>

      <Section icon="🛍️" title="ยอดขายแยกตามช่องทาง สัปดาห์นี้">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && trends && Object.keys(trends.weekByChannel).length === 0 && <Empty />}
        {!trendsLoading &&
          trends &&
          Object.entries(trends.weekByChannel).map(([ch, amount]) => (
            <BarRow
              key={ch}
              label={CHANNEL_LABELS[ch] ?? ch}
              value={amount}
              max={trends.thisWeekTotal || 1}
              display={`${amount.toLocaleString()} บาท`}
            />
          ))}
      </Section>

      <Section icon="🛍️" title="ยอดขายแยกตามช่องทาง เดือนนี้">
        {trendsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!trendsLoading && trends && Object.keys(trends.monthByChannel).length === 0 && <Empty />}
        {!trendsLoading &&
          trends &&
          Object.entries(trends.monthByChannel).map(([ch, amount]) => (
            <BarRow
              key={ch}
              label={CHANNEL_LABELS[ch] ?? ch}
              value={amount}
              max={trends.thisMonthTotal || 1}
              display={`${amount.toLocaleString()} บาท`}
            />
          ))}
      </Section>

      <Section icon="🔥" title="เมนูขายดี Top 5 สัปดาห์นี้" subtitle="ไม่รวมหมวดเครื่องดื่ม">
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <>
            <TopItemsList items={topItemsData.topWeekItems} unit="ชิ้น" />
            {topItemsData.topWeekItems.length > 0 && (
              <div className="mt-3">
                <ItemPie items={topItemsData.topWeekItems} totalQty={topItemsData.totalWeekQty} />
              </div>
            )}
          </>
        )}
      </Section>

      <Section icon="🔥" title="เมนูขายดี Top 5 เดือนนี้" subtitle="ไม่รวมหมวดเครื่องดื่ม">
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <>
            <TopItemsList items={topItemsData.topMonthItems} unit="ชิ้น" />
            {topItemsData.topMonthItems.length > 0 && (
              <div className="mt-3">
                <ItemPie items={topItemsData.topMonthItems} totalQty={topItemsData.totalMonthQty} />
              </div>
            )}
          </>
        )}
      </Section>

      <Section
        icon="📉"
        title="เมนูขายน้อยสุด Top 5 เดือนนี้"
        subtitle={
          "ไม่รวมหมวดเครื่องดื่ม" +
          (!topItemsLoading && topItemsData && topItemsData.zeroSoldCount > 0
            ? ` • มีเมนูขาย 0 ชิ้นเดือนนี้ทั้งหมด ${topItemsData.zeroSoldCount} รายการ`
            : "")
        }
      >
        {topItemsLoading && <p className="text-xs text-ink/40">กำลังโหลด...</p>}
        {!topItemsLoading && topItemsData && (
          <TopItemsList items={topItemsData.bottomMonthItems} unit="ชิ้น" />
        )}
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="mb-4 rounded-2xl border border-forest/15 bg-white"
      style={{ padding: 16 }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#3A2A18", margin: 0 }}>
        {icon ? `${icon} ` : ""}
        {title}
      </h3>
      {subtitle && (
        <p style={{ fontSize: 11, color: "#3A2A18", opacity: 0.45, marginTop: 2 }}>{subtitle}</p>
      )}
      <div style={{ marginTop: 12 }}>{children}</div>
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
      <div className="flex items-end gap-2" style={{ paddingTop: 4 }}>
        {days.map((day) => {
          // ใช้พิกเซลตรงๆ แทน % เพื่อกันไม่ให้ค่าน้อยๆ (หรือ 0) เตี้ยจนมองไม่เห็นเป็นแท่ง
          const heightPx = Math.max(6, Math.round((day.total / max) * BAR_AREA_PX));
          const isToday = day.date === today;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center" style={{ gap: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#3A2A18",
                  opacity: 0.65,
                  whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums"
                }}
              >
                {Math.round(day.total).toLocaleString()}
         

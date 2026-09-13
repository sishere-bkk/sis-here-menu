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

  const maxItemQty = data.topItems.length ? data.topItems[0][1] : 1;

  return (
    <div>
      <div className="mb-4 flex gap-3">
        <Card label="ยอดขายวันนี้" value={`${data.totalSales.toLocaleString()} บาท`} />
        <Card label="จำนวน Order วันนี้" value={`${data.orderCount}`} />
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

      <Section icon="🛍️" title="ยอดขายแยกตามช่องทาง">
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
        {Object.keys(data.byChannel).length > 0 && (
          <div className="mt-3">
            <DonutChart
              segments={Object.entries(data.byChannel).map(([ch, amount]) => ({
                label: CHANNEL_LABELS[ch] ?? ch,
                value: amount,
                color: CHANNEL_COLORS[ch] ?? OTHERS_COLOR,
              }))}
            />
          </div>
        )}
      </Section>

      <Section icon="🔥" title="เมนูขายดี Top 5 วันนี้" subtitle="ไม่รวมหมวดเครื่องดื่ม">
        {data.topItems.length === 0 && <Empty />}
        {data.topItems.map(([name, qty]) => (
          <BarRow key={name} label={name} value={qty} max={maxItemQty} display={`${qty} ชิ้น`} />
        ))}
        {data.topItems.length > 0 && (
          <div className="mt-3">
            <ItemPie items={data.topItems} totalQty={data.totalItemQty} />
          </div>
        )}
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
                style={{
                  fontSize: 12,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? "#E8792F" : "#3A2A18",
                  opacity: isToday ? 1 : 0.6
                }}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: 8, paddingLeft: 4, fontSize: 11, color: "#3A2A18", opacity: 0.4 }}>
        <span style={{ color: "#E8792F" }}>■</span> แท่งสีส้ม = วันนี้ (หน่วย: บาท)
      </p>
    </div>
  );
}

// กราฟวงกลมแบบทั่วไป: รับ segments (ป้าย, ค่า, สี) มาวาดเป็นวงแหวน + คำอธิบายสี พร้อม % ด้านข้าง
function DonutChart({
  segments,
  size = 108,
  strokeWidth = 20,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EFE9DA"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const offset = -cumulativeFraction * circumference;
          cumulativeFraction += fraction;
          if (fraction <= 0) return null;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: seg.color,
                flexShrink: 0,
                display: "inline-block"
              }}
            />
            <span
              style={{ fontSize: 12, color: "#3A2A18", flex: 1, minWidth: 0 }}
              className="truncate"
            >
              {seg.label}
            </span>
            <span style={{ fontSize: 12, color: "#3A2A18", opacity: 0.6, flexShrink: 0 }}>
              {((seg.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// กราฟวงกลมเฉพาะสำหรับเมนูขายดี: top5 แต่ละอันเป็น 1 ชิ้นส่วน ที่เหลือนอก top5 มัดรวมเป็น "เมนูอื่นๆ"
function ItemPie({ items, totalQty }: { items: [string, number][]; totalQty: number }) {
  const top5Qty = items.reduce((sum, [, qty]) => sum + qty, 0);
  const othersQty = Math.max(0, totalQty - top5Qty);
  const segments = items.map(([name, qty], i) => ({
    label: name,
    value: qty,
    color: ITEM_PIE_COLORS[i % ITEM_PIE_COLORS.length]
  }));
  if (othersQty > 0) {
    segments.push({ label: "เมนูอื่นๆ", value: othersQty, color: OTHERS_COLOR });
  }
  const top5Pct = totalQty > 0 ? (top5Qty / totalQty) * 100 : 0;
  return (
    <div>
      <p style={{ fontSize: 12, color: "#3A2A18", opacity: 0.6, marginBottom: 8 }}>
        5 เมนูนี้รวมกันคิดเป็น <strong style={{ opacity: 1 }}>{top5Pct.toFixed(0)}%</strong> ของยอดขายชิ้นทั้งหมด
      </p>
      <DonutChart segments={segments} />
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

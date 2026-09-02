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

export default function DashboardTab() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

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

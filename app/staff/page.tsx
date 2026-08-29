"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type OrderRow = {
  id: number;
  order_type: string;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: any[];
  status: string;
  created_at: string;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${dateFmt.format(d)} ${timeFmt.format(d)}`;
}

function sourceLabel(o: OrderRow) {
  if (o.order_type === "table") return `โต๊ะ ${o.table_number}`;
  if (o.order_type === "takeaway")
    return `กลับบ้าน - ${o.customer_name} (${o.customer_phone})`;
  return "อื่นๆ";
}

export default function StaffPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "new")
      .order("created_at", { ascending: true });
    if (!error && data) setOrders(data as OrderRow[]);
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!printOrder) return;
    const timer = setTimeout(() => window.print(), 200);

    function handleAfterPrint() {
      markPrinted(printOrder!.id);
      setPrintOrder(null);
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printOrder]);

  async function markPrinted(id: number) {
    await supabase.from("orders").update({ status: "printed" }).eq("id", id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  const printTotal = printOrder
    ? printOrder.items.reduce(
        (sum: number, line: any) => sum + line.unitPrice * line.qty,
        0
      )
    : 0;

  return (
    <div>
      <div className="no-print p-6">
        <h1 className="mb-1 text-2xl font-semibold text-forestDark">
          หน้าพนักงาน — ออเดอร์ใหม่
        </h1>
        <p className="mb-6 text-sm text-ink/60">
          เปิดหน้านี้ค้างไว้บนคอมหรือแท็บเล็ตที่ต่อกับเครื่องพิมพ์ในร้าน
          รายการจะอัปเดตเองทุก 5 วินาที กดปุ่ม "พิมพ์บิล" เมื่อพร้อม
        </p>

        {orders.length === 0 && (
          <p className="text-ink/50">ยังไม่มีออเดอร์ใหม่</p>
        )}

        <div className="space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-xl border border-forest/15 bg-white p-4"
            >
              <div>
                <p className="font-semibold text-ink">ออเดอร์ #{o.id}</p>
                <p className="text-sm text-ink/60">{sourceLabel(o)}</p>
                <p className="text-xs text-ink/40">
                  {formatDateTime(o.created_at)}
                </p>
              </div>
              <button
                onClick={() => setPrintOrder(o)}
                className="rounded-full bg-forest px-5 py-2 text-sm font-medium text-sand"
              >
                พิมพ์บิล
              </button>
            </div>
          ))}
        </div>
      </div>

      {printOrder && (
        <div className="print-area hidden">
          <div style={{ fontFamily: "monospace", width: "72mm", fontSize: 12 }}>
            <p style={{ textAlign: "center", fontWeight: "bold" }}>SiS HERE</p>
            <p>ออเดอร์ #{printOrder.id}</p>
            <p>{formatDateTime(printOrder.created_at)}</p>
            <p>{sourceLabel(printOrder)}</p>
            <p>------------------------------</p>
            {printOrder.items.map((line: any, idx: number) => (
              <div key={idx}>
                <p>
                  {line.qty} x {line.name} {(line.unitPrice * line.qty).toFixed(0)} บาท
                </p>
                {line.options &&
                  String(line.options)
                    .split(",")
                    .map((o: string) => o.trim())
                    .filter(Boolean)
                    .map((opt: string, i: number) => <p key={i}>   + {opt}</p>)}
                {line.note && <p>   + {line.note}</p>}
              </div>
            ))}
            <p>------------------------------</p>
            <p>รวม: {printTotal.toFixed(0)} บาท</p>
          </div>
        </div>
      )}
    </div>
  );
}

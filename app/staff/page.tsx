"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StockTab from "../../components/StockTab";
import UploadImageTab from "../../components/UploadImageTab";
import DashboardTab from "../../components/DashboardTab";
import TestOrderTab from "../../components/TestOrderTab";

// เห็นแท็บ Dashboard / ทดสอบ ได้เฉพาะชื่อนี้เท่านั้น
const OWNER_NAME = "พี่ดี๋";

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

function orderTotal(o: OrderRow) {
  return o.items.reduce(
    (sum: number, line: any) => sum + line.unitPrice * line.qty,
    0
  );
}

function getCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

export default function StaffPage() {
  const router = useRouter();
  const [tab, setTab] = useState<
    "orders" | "stock" | "upload" | "dashboard" | "test"
  >("orders");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);
  const [staffName, setStaffName] = useState("");
  const isOwner = staffName === OWNER_NAME;

  useEffect(() => {
    setStaffName(getCookie("staff_display_name"));
  }, []);

  async function loadOrders() {
    try {
      const res = await fetch("/api/staff-orders");
      if (res.status === 401) {
        router.push("/staff/login");
        return;
      }
      const data = await res.json();
      if (res.ok && data.orders) setOrders(data.orders as OrderRow[]);
    } catch (err) {
      // ignore, will retry on next poll
    }
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    await fetch("/api/staff-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleLogout() {
    await fetch("/api/staff-logout", { method: "POST" });
    router.push("/staff/login");
  }

  const printTotal = printOrder ? orderTotal(printOrder) : 0;

  return (
    <div>
      <div className="no-print p-6">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-forestDark">
            หน้าพนักงาน
          </h1>
          <div className="flex items-center gap-3">
            {staffName && (
              <span className="text-sm text-ink/60">สวัสดี {staffName}</span>
            )}
            <button
              onClick={handleLogout}
              className="rounded-full border border-forest/20 px-4 py-1.5 text-sm text-forestDark"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        <div className="mb-6 mt-3 inline-flex flex-wrap gap-1 rounded-2xl bg-forest/10 p-1">
          <button
            onClick={() => setTab("orders")}
            style={{ whiteSpace: "nowrap" }}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-6 sm:py-2.5 sm:text-sm ${
              tab === "orders" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
            }`}
          >
            📋 ออเดอร์
          </button>
          <button
            onClick={() => setTab("stock")}
            style={{ whiteSpace: "nowrap" }}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-6 sm:py-2.5 sm:text-sm ${
              tab === "stock" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
            }`}
          >
            📦 สต็อก
          </button>
          <button
            onClick={() => setTab("upload")}
            style={{ whiteSpace: "nowrap" }}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-6 sm:py-2.5 sm:text-sm ${
              tab === "upload" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
            }`}
          >
            📷 อัปโหลดรูป
          </button>
        </div>

        {isOwner && (
          <div className="mb-6 inline-flex flex-wrap gap-1 rounded-2xl bg-[#8B3A2B]/10 p-1">
            <button
              onClick={() => setTab("dashboard")}
              style={{ whiteSpace: "nowrap" }}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-6 sm:py-2.5 sm:text-sm ${
                tab === "dashboard" ? "bg-[#8B3A2B] text-sand shadow-sm" : "text-[#8B3A2B]/70"
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setTab("test")}
              style={{ whiteSpace: "nowrap" }}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-6 sm:py-2.5 sm:text-sm ${
                tab === "test" ? "bg-[#8B3A2B] text-sand shadow-sm" : "text-[#8B3A2B]/70"
              }`}
            >
              🧪 ทดสอบ
            </button>
          </div>
        )}

        {tab === "orders" && (
          <>
            <p className="mb-6 text-sm text-ink/60">
              เปิดหน้านี้ค้างไว้บนคอมหรือแท็บเล็ตที่ต่อกับเครื่องพิมพ์ในร้าน
              รายการจะอัปเดตเองทุก 5 วินาที กดปุ่ม "พิมพ์บิล" เมื่อพร้อม
              (แสดงเฉพาะออเดอร์ของวันนี้เท่านั้น)
            </p>

            {orders.length === 0 && (
              <p className="text-ink/50">ยังไม่มีออเดอร์ใหม่</p>
            )}

            <div className="space-y-3">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-forest/15 bg-white p-4"
                >
                  <div className="mb-2 flex items-start justify-between">
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

                  <div className="mt-2 space-y-1 border-t border-forest/10 pt-2 text-sm">
                    {o.items.map((line: any, idx: number) => (
                      <div key={idx}>
                        <p className="text-ink">
                          {line.qty} x {line.name}{" "}
                          <span className="text-[#8B3A2B]">
                            {(line.unitPrice * line.qty).toFixed(0)} บาท
                          </span>
                        </p>
                        {line.options &&
                          String(line.options)
                            .split(",")
                            .map((opt: string) => opt.trim())
                            .filter(Boolean)
                            .map((opt: string, i: number) => (
                              <p key={i} className="pl-4 text-xs text-ink/60">
                                + {opt}
                              </p>
                            ))}
                        {line.note && (
                          <p className="pl-4 text-xs text-ink/60">+ {line.note}</p>
                        )}
                      </div>
                    ))}
                    <p className="pt-1 text-right font-semibold text-[#8B3A2B]">
                      รวม {orderTotal(o).toFixed(0)} บาท
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "stock" && <StockTab />}
        {tab === "upload" && <UploadImageTab />}
        {tab === "dashboard" && isOwner && <DashboardTab />}
        {tab === "test" && isOwner && <TestOrderTab />}
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
            {staffName && <p>พนักงาน: {staffName}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

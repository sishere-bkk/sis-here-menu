"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StockTab from "../../components/StockTab";
import UploadImageTab from "../../components/UploadImageTab";
import DashboardTab from "../../components/DashboardTab";
import TestOrderTab from "../../components/TestOrderTab";
import ManualOrderTab from "../../components/ManualOrderTab";
import ReconcileTab from "../../components/ReconcileTab";

// เห็นแท็บ Dashboard / ทดสอบ ได้เฉพาะชื่อนี้เท่านั้น
const OWNER_NAME = "พี่ดี๋";

type OrderRow = {
  id: number;
  order_type: string;
  table_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  channel: string | null;
  platform_order_no: string | null;
  needs_utensils: boolean;
  items: any[];
  status: string;
  created_at: string;
  discount: number | null;
  total_amount: number | null;
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
  if (o.channel === "grab")
    return `Grab${o.platform_order_no ? " · " + o.platform_order_no : ""}`;
  if (o.channel === "lineman")
    return `LINE MAN${o.platform_order_no ? " · " + o.platform_order_no : ""}`;
  if (o.order_type === "table") return `โต๊ะ ${o.table_number}`;
  if (o.order_type === "takeaway")
    return `กลับบ้าน - ${o.customer_name} (${o.customer_phone})`;
  return "อื่นๆ";
}

// เฉพาะบิลปริ้น: รวมประเภทออเดอร์ + เลขออเดอร์ไว้บรรทัดเดียว ตามฟอร์แมตบิลที่ต้องการ
function printHeaderLabel(o: OrderRow) {
  if (o.channel === "grab")
    return `Grab / #${o.platform_order_no || o.id}`;
  if (o.channel === "lineman")
    return `LINE MAN / #${o.platform_order_no || o.id}`;
  if (o.order_type === "table") return `โต๊ะ ${o.table_number} / #${o.id}`;
  if (o.order_type === "takeaway") return `Take Away / #${o.id}`;
  return `#${o.id}`;
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

// ข้อ 12: มือถือ/แท็บเล็ตบางรุ่นค้างซูมหลังสั่งพิมพ์ ลองบังคับรีเซ็ต viewport
// เป็น workaround ที่คนอื่นใช้กันบ่อย ไม่ได้การันตีว่าหายทุกเครื่อง
function resetZoomAfterPrint() {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  const original = viewport.getAttribute("content");
  viewport.setAttribute(
    "content",
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
  );
  window.scrollTo(0, 0);
  setTimeout(() => {
    if (original) viewport.setAttribute("content", original);
  }, 300);
}

export default function StaffPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"orders" | "manualorder" | "stock" | "upload" | "dashboard" | "test" | "reconcile">("orders");
  const [menuOpen, setMenuOpen] = useState(false);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [acceptedOrders, setAcceptedOrders] = useState<OrderRow[]>([]);
  const [ordersView, setOrdersView] = useState<"new" | "accepted">("new");
  const [printOrder, setPrintOrder] = useState<OrderRow | null>(null);
  const [staffName, setStaffName] = useState("");
  const isOwner = staffName === OWNER_NAME;

  useEffect(() => {
    setStaffName(getCookie("staff_display_name"));
  }, []);

  async function loadOrders() {
    try {
      const [newRes, acceptedRes] = await Promise.all([
        fetch("/api/staff-orders?status=new"),
        fetch("/api/staff-orders?status=accepted")
      ]);
      if (newRes.status === 401 || acceptedRes.status === 401) {
        router.push("/staff/login");
        return;
      }
      const newData = await newRes.json();
      const acceptedData = await acceptedRes.json();
      if (newRes.ok && newData.orders) setOrders(newData.orders as OrderRow[]);
      if (acceptedRes.ok && acceptedData.orders) setAcceptedOrders(acceptedData.orders as OrderRow[]);
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
      resetZoomAfterPrint();
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
      body: JSON.stringify({ id, action: "print" })
    });
  }

  async function handleAccept(id: number) {
    await fetch("/api/staff-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "accept" })
    });
    loadOrders();
  }

  async function handleUnaccept(id: number) {
    if (!confirm("ยกเลิกการรับเงินออเดอร์นี้ กลับไปเป็นออเดอร์ใหม่ใช่ไหม?")) return;
    await fetch("/api/staff-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "unaccept" })
    });
    loadOrders();
  }

  async function handleCancel(id: number) {
    if (!confirm("ยืนยันยกเลิกออเดอร์นี้?")) return;
    await fetch("/api/staff-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "cancel" })
    });
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleLogout() {
    await fetch("/api/staff-logout", { method: "POST" });
    router.push("/staff/login");
  }

  const printTotal = printOrder ? orderTotal(printOrder) : 0;
  const isDeliveryPrint =
    !!printOrder && (printOrder.channel === "grab" || printOrder.channel === "lineman");

  return (
    <div>
      <div className="no-print p-6">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOwner && (
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="เมนู"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-forest/20 text-lg text-forestDark"
              >
                ☰
              </button>
            )}
            <h1 className="text-lg font-semibold text-forestDark sm:text-2xl">
              หน้าพนักงาน
            </h1>
          </div>
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

        <div className="mb-2 flex gap-1 rounded-2xl bg-forest/10 p-1">
          <button
            onClick={() => setTab("orders")}
            className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
              tab === "orders" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
            }`}
          >
            📋 ออเดอร์
          </button>
          <button
            onClick={() => setTab("manualorder")}
            className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
              tab === "manualorder" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
            }`}
          >
            ⌨️ คีย์ออเดอร์
          </button>
          <button
            onClick={() => setTab("stock")}
            className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
              tab === "stock" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
            }`}
          >
            📦 สต็อก
          </button>
        </div>

        {isOwner && menuOpen && (
          <div className="fixed inset-0 z-40 flex items-end bg-ink/40" onClick={() => setMenuOpen(false)}>
            <div
              className="w-full rounded-t-3xl bg-white p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-forestDark">เมนูเจ้าของร้าน</h3>
                <button onClick={() => setMenuOpen(false)} className="text-sm text-ink/50">ปิด</button>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => { setTab("dashboard"); setMenuOpen(false); }}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                    tab === "dashboard" ? "bg-[#8B3A2B] text-sand" : "bg-[#8B3A2B]/10 text-[#8B3A2B]"
                  }`}
                >
                  📊 Dashboard
                </button>
                <button
                  onClick={() => { setTab("reconcile"); setMenuOpen(false); }}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                    tab === "reconcile" ? "bg-[#8B3A2B] text-sand" : "bg-[#8B3A2B]/10 text-[#8B3A2B]"
                  }`}
                >
                  💰 กระทบยอด
                </button>
                <button
                  onClick={() => { setTab("upload"); setMenuOpen(false); }}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                    tab === "upload" ? "bg-[#8B3A2B] text-sand" : "bg-[#8B3A2B]/10 text-[#8B3A2B]"
                  }`}
                >
                  📷 อัปโหลดรูป
                </button>
                <button
                  onClick={() => { setTab("test"); setMenuOpen(false); }}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${
                    tab === "test" ? "bg-[#8B3A2B] text-sand" : "bg-[#8B3A2B]/10 text-[#8B3A2B]"
                  }`}
                >
                  🧪 ทดสอบ
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <>
            <p className="mb-4 text-sm text-ink/60">
              เปิดหน้านี้ค้างไว้บนคอมหรือแท็บเล็ตที่ต่อกับเครื่องพิมพ์ในร้าน
              รายการจะอัปเดตเองทุก 5 วินาที กดปุ่ม "พิมพ์บิล" เมื่อพร้อม
              (แสดงเฉพาะออเดอร์ของวันนี้เท่านั้น)
            </p>

            <div className="mb-4 flex gap-1 rounded-2xl bg-forest/10 p-1">
              <button
                onClick={() => setOrdersView("new")}
                className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                  ordersView === "new" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
                }`}
              >
                ออเดอร์ใหม่ ({orders.length})
              </button>
              <button
                onClick={() => setOrdersView("accepted")}
                className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                  ordersView === "accepted" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
                }`}
              >
                รับแล้ว ({acceptedOrders.length})
              </button>
            </div>

            {ordersView === "new" && (
              <>
                {orders.length === 0 && (
                  <p className="text-ink/50">ยังไม่มีออเดอร์ใหม่</p>
                )}
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-forest/15 bg-white p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-ink">ออเดอร์ #{o.id}</p>
                          <p className="text-sm text-ink/60">{sourceLabel(o)}</p>
                          <p className="text-xs text-ink/40">{formatDateTime(o.created_at)}</p>
                        </div>
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
                        <p className="pt-1 text-right">
                          {o.discount != null && o.discount > 0 && (
                            <>
                              <span className="block text-xs text-ink/50">
                                ยอดรวมรายการ {orderTotal(o).toFixed(0)} บาท
                              </span>
                              <span className="block text-xs text-red-600">
                                ส่วนลด −{o.discount.toFixed(0)} บาท
                              </span>
                            </>
                          )}
                          <span className="font-semibold text-[#8B3A2B]">
                            รวม {(o.total_amount ?? orderTotal(o)).toFixed(0)} บาท
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setPrintOrder(o)}
                          className="flex-1 rounded-full bg-forest px-3 py-2 text-xs font-medium text-sand sm:text-sm"
                        >
                          🖨️ พิมพ์บิล
                        </button>
                        <button
                          onClick={() => handleAccept(o.id)}
                          className="flex-1 rounded-full bg-green-700 px-3 py-2 text-xs font-medium text-white sm:text-sm"
                        >
                          ✅ รับเงินแล้ว
                        </button>
                        <button
                          onClick={() => handleCancel(o.id)}
                          className="flex-1 rounded-full bg-red-700 px-3 py-2 text-xs font-medium text-white sm:text-sm"
                        >
                          ❌ ยกเลิก
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {ordersView === "accepted" && (
              <>
                {acceptedOrders.length === 0 && (
                  <p className="text-ink/50">ยังไม่มีออเดอร์ที่รับเงินแล้ววันนี้</p>
                )}
                <div className="space-y-3">
                  {acceptedOrders.map((o) => (
                    <div key={o.id} className="rounded-xl border border-forest/15 bg-white p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-ink">ออเดอร์ #{o.id}</p>
                          <p className="text-sm text-ink/60">{sourceLabel(o)}</p>
                          <p className="text-xs text-ink/40">{formatDateTime(o.created_at)}</p>
                        </div>
                        <p className="font-semibold text-[#8B3A2B]">{(o.total_amount ?? orderTotal(o)).toFixed(0)} บาท</p>
                      </div>
                      <button
                        onClick={() => handleUnaccept(o.id)}
                        className="w-full rounded-full bg-red-700 px-3 py-2 text-xs font-medium text-white sm:text-sm"
                      >
                        ↩️ ยกเลิกการรับเงิน (คืนเป็นออเดอร์ใหม่)
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === "manualorder" && <ManualOrderTab staffName={staffName} />}
        {tab === "stock" && <StockTab />}
        {tab === "upload" && isOwner && <UploadImageTab />}
        {tab === "dashboard" && isOwner && <DashboardTab />}
        {tab === "test" && isOwner && <TestOrderTab />}
        {tab === "reconcile" && isOwner && <ReconcileTab />}
      </div>

      {printOrder && (
        <>
          <style>{`
            @media print {
              @page { size: 58mm auto; margin: 0; }
            }
          `}</style>
          <div className="print-area hidden">
            <div
              style={{
                fontFamily: "monospace",
                width: "58mm",
                fontWeight: 900,
                lineHeight: 1.5,
                fontSize: 16
              }}
            >
              <p style={{ textAlign: "center", fontWeight: 900, fontSize: 34, margin: "0 0 4px" }}>
                SiS HERE
              </p>
              <p style={{ textAlign: "center", fontSize: 26, margin: "0 0 6px" }}>
                {printHeaderLabel(printOrder)}
              </p>
              <p style={{ margin: "0 0 4px" }}>------------------------</p>

              {printOrder.items.map((line: any, idx: number) => (
                <div key={idx} style={{ marginBottom: 4 }}>
                  <p style={{ fontSize: 20, margin: 0 }}>
                    {line.qty} x {line.name}
                    {!isDeliveryPrint && ` ${line.unitPrice.toFixed(0)} บาท`}
                  </p>
                  {line.options &&
                    String(line.options)
                      .split(",")
                      .map((o: string) => o.trim())
                      .filter(Boolean)
                      .map((opt: string, i: number) => (
                        <p key={i} style={{ fontSize: 16, margin: 0, paddingLeft: 10 }}>
                          + {opt}
                        </p>
                      ))}
                  {line.note && (
                    <p style={{ fontSize: 16, margin: 0, paddingLeft: 10 }}>+ {line.note}</p>
                  )}
                </div>
              ))}

              <p style={{ margin: "4px 0" }}>------------------------</p>

              {isDeliveryPrint && (
                <p style={{ textAlign: "center", fontSize: 20, margin: "0 0 4px" }}>
                  {printOrder.needs_utensils ? "รับช้อนส้อม" : "ไม่รับช้อนส้อม"}
                </p>
              )}

              {!isDeliveryPrint && (
                <p style={{ fontSize: 24, margin: 0 }}>รวม: {printTotal.toFixed(0)} บาท</p>
              )}

              {staffName && <p style={{ fontSize: 14, margin: "6px 0 0" }}>พนักงาน: {staffName}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

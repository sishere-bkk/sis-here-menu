"use client";

import { useState } from "react";

type OrderRow = {
  id: number;
  created_at: string;
  total_amount: number;
  platform_order_no: string | null;
  status: string;
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function timeOnly(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

export default function ReconcileTab() {
  const [channel, setChannel] = useState<"grab" | "lineman">("grab");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [keyedTotal, setKeyedTotal] = useState(0);

  // โหมด Grab: กรอกยอดที่ได้จริงทีละออเดอร์
  const [perOrderNet, setPerOrderNet] = useState<Record<number, string>>({});
  // โหมด LINE MAN: กรอกยอดรวมทั้งรอบ
  const [actualReceived, setActualReceived] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadOrders() {
    setLoading(true);
    setMessage("");
    setOrders(null);
    setPerOrderNet({});
    try {
      const toExclusive = addDays(to, 1);
      const res = await fetch(`/api/reconcile?channel=${channel}&from=${from}&to=${toExclusive}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage("โหลดไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setOrders(data.orders);
      setKeyedTotal(data.keyedTotal);
    } catch {
      setMessage("โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function submitGrab() {
    if (!orders) return;
    const entries = orders
      .filter((o) => perOrderNet[o.id] !== undefined && perOrderNet[o.id] !== "")
      .map((o) => ({ id: o.id, actualNet: Number(perOrderNet[o.id]) }));
    if (entries.length === 0) {
      alert("กรอกยอดที่ได้จริงอย่างน้อย 1 ออเดอร์ก่อนครับ");
      return;
    }
    if (!confirm(`ยืนยันกระทบยอด ${entries.length} ออเดอร์ ใช่ไหม?`)) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "per_order", entries })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage("บันทึกไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setMessage(`กระทบยอดสำเร็จ ${data.ordersUpdated} ออเดอร์`);
      setOrders(null);
      setPerOrderNet({});
    } catch {
      setMessage("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLineman() {
    if (!actualReceived) {
      alert("กรอกยอดที่ได้รับจริงก่อนครับ");
      return;
    }
    if (!confirm(`ยืนยันกระทบยอด ${orders?.length ?? 0} ออเดอร์ ใช่ไหม?`)) return;
    setSubmitting(true);
    setMessage("");
    try {
      const toExclusive = addDays(to, 1);
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "lump_sum",
          channel,
          from,
          to: toExclusive,
          actualReceived: Number(actualReceived)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage("บันทึกไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setMessage(`กระทบยอดสำเร็จ ${data.ordersUpdated} ออเดอร์ (ค่าคอมมิชชั่นรวม ${data.totalFee.toFixed(0)} บาท)`);
      setOrders(null);
      setActualReceived("");
    } catch {
      setMessage("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md pb-10">
      <p className="mb-4 text-sm text-ink/60">
        Grab กรอกยอดที่ได้จริงทีละออเดอร์ (ตามที่แอป Grab โชว์) / LINE MAN กรอกเป็นยอดรวมต่อรอบที่โอนเข้ามา
      </p>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => { setChannel("grab"); setOrders(null); setMessage(""); }}
          className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold border"
          style={
            channel === "grab"
              ? { backgroundColor: "#0F6B3D", color: "#ffffff", borderColor: "#0F6B3D" }
              : { backgroundColor: "#ffffff", color: "#3A2A1899", borderColor: "#E8792F26" }
          }
        >
          Grab
        </button>
        <button
          onClick={() => { setChannel("lineman"); setOrders(null); setMessage(""); }}
          className="flex-1 rounded-full px-4 py-2.5 text-sm font-semibold border"
          style={
            channel === "lineman"
              ? { backgroundColor: "#8BD84A", color: "#153A1E", borderColor: "#8BD84A" }
              : { backgroundColor: "#ffffff", color: "#3A2A1899", borderColor: "#E8792F26" }
          }
        >
          LINE MAN
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-ink/50">ตั้งแต่วันที่</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setOrders(null); }}
            className="w-full rounded-lg border border-forest/15 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-ink/50">ถึงวันที่</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setOrders(null); }}
            className="w-full rounded-lg border border-forest/15 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <button
        onClick={loadOrders}
        disabled={loading}
        className="mb-4 w-full rounded-full bg-forest py-2.5 text-sm font-medium text-sand disabled:opacity-50"
      >
        {loading ? "กำลังโหลด..." : "ดึงยอดที่ยังไม่กระทบยอด"}
      </button>

      {orders && orders.length === 0 && (
        <p className="mb-4 text-sm text-ink/50">ไม่มีออเดอร์ที่ยังไม่กระทบยอดในช่วงนี้</p>
      )}

      {orders && orders.length > 0 && channel === "grab" && (
        <>
          <p className="mb-2 text-sm text-ink/60">พบ {orders.length} ออเดอร์ — กรอกยอดที่ได้จริงต่อออเดอร์ (เว้นว่างได้ถ้ายังไม่รู้ยอด จะข้ามบิลนั้นไปก่อน)</p>
          <div className="mb-4 space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-forest/10 bg-white p-3">
                <div>
                  <p className="text-sm text-ink">#{o.id} {o.platform_order_no ? `· ${o.platform_order_no}` : ""}</p>
                  <p className="text-xs text-ink/40">{timeOnly(o.created_at)} — คีย์ไว้ {Number(o.total_amount).toFixed(0)} บาท</p>
                </div>
                <input
                  type="number"
                  value={perOrderNet[o.id] ?? ""}
                  onChange={(e) => setPerOrderNet((prev) => ({ ...prev, [o.id]: e.target.value }))}
                  placeholder="ยอดจริง"
                  className="w-24 rounded-lg border border-forest/15 px-2 py-1.5 text-right text-sm"
                />
              </div>
            ))}
          </div>
          <button
            onClick={submitGrab}
            disabled={submitting}
            className="w-full rounded-full bg-forest py-3 font-medium text-sand disabled:opacity-50"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกกระทบยอด"}
          </button>
        </>
      )}

      {orders && orders.length > 0 && channel === "lineman" && (
        <>
          <div className="mb-4 rounded-xl border border-forest/10 bg-white p-4">
            <p className="mb-2 text-sm text-ink/60">พบ {orders.length} ออเดอร์ ยังไม่กระทบยอด</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/60">ยอดที่คีย์ไว้ทั้งหมด</span>
              <span className="text-lg font-semibold text-forestDark">{keyedTotal.toFixed(0)} บาท</span>
            </div>
          </div>

          <label className="mb-2 block text-sm font-semibold text-ink">ยอดที่โอนเข้ามาจริงทั้งรอบ (บาท)</label>
          <input
            type="number"
            value={actualReceived}
            onChange={(e) => setActualReceived(e.target.value)}
            placeholder="เช่น 4200"
            className="mb-3 w-full rounded-lg border border-forest/15 px-3 py-2 text-sm"
          />
          {actualReceived && (
            <p className="mb-4 text-sm text-ink/60">
              ส่วนต่าง (ค่าคอมมิชชั่นรวมโดยประมาณ ไม่แยกรายบิล): <span className="font-semibold text-red-600">{(keyedTotal - Number(actualReceived)).toFixed(0)} บาท</span>
            </p>
          )}
          <button
            onClick={submitLineman}
            disabled={submitting}
            className="w-full rounded-full bg-forest py-3 font-medium text-sand disabled:opacity-50"
          >
            {submitting ? "กำลังบันทึก..." : "บันทึกกระทบยอด"}
          </button>
        </>
      )}

      {message && <p className="mt-4 text-sm text-ink/70">{message}</p>}
    </div>
  );
}

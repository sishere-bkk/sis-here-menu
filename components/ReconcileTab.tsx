"use client";

import { useEffect, useState } from "react";

type OrderRow = {
  id: number;
  created_at: string;
  total_amount: number;
  platform_order_no: string | null;
  status: string;
};

type ThaiChuayThaiEntry = {
  id: string;
  entry_date: string;
  amount: number;
  note: string | null;
};

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function ReconcileTab() {
  const [channel, setChannel] = useState<"grab" | "lineman" | "thaichuaythai">("grab");

  // --- Grab / LINE MAN ปกติ ---
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [keyedTotal, setKeyedTotal] = useState(0);
  const [actualReceived, setActualReceived] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // --- ไทยช่วยไทย (สมุดจด) ---
  const [tctEntries, setTctEntries] = useState<ThaiChuayThaiEntry[] | null>(null);
  const [tctTotal, setTctTotal] = useState(0);
  const [tctDate, setTctDate] = useState(todayStr());
  const [tctAmount, setTctAmount] = useState("");
  const [tctNote, setTctNote] = useState("");
  const [tctLoading, setTctLoading] = useState(false);
  const [tctSubmitting, setTctSubmitting] = useState(false);
  const [tctMessage, setTctMessage] = useState("");

  useEffect(() => {
    if (channel === "thaichuaythai") loadThaiChuayThai();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  async function loadOrders() {
    setLoading(true);
    setMessage("");
    setOrders(null);
    try {
      const res = await fetch(`/api/reconcile?channel=${channel}&from=${from}&to=${to}`);
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

  async function submitReconcile() {
    if (!actualReceived) {
      alert("กรอกยอดที่ได้รับจริงก่อนครับ");
      return;
    }
    if (!confirm(`ยืนยันกระทบยอด ${orders?.length ?? 0} ออเดอร์ ใช่ไหม?`)) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          from,
          to,
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

  async function loadThaiChuayThai() {
    setTctLoading(true);
    setTctMessage("");
    try {
      const res = await fetch("/api/thai-chuay-thai");
      const data = await res.json();
      if (!res.ok) {
        setTctMessage("โหลดไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setTctEntries(data.entries);
      setTctTotal(data.total);
    } catch {
      setTctMessage("โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setTctLoading(false);
    }
  }

  async function submitThaiChuayThai() {
    if (!tctAmount) {
      alert("กรอกจำนวนเงินก่อนครับ");
      return;
    }
    setTctSubmitting(true);
    setTctMessage("");
    try {
      const res = await fetch("/api/thai-chuay-thai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryDate: tctDate,
          amount: Number(tctAmount),
          note: tctNote || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setTctMessage("บันทึกไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setTctAmount("");
      setTctNote("");
      loadThaiChuayThai();
    } catch {
      setTctMessage("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setTctSubmitting(false);
    }
  }

  const diff = orders ? keyedTotal - Number(actualReceived || 0) : 0;

  return (
    <div className="max-w-md pb-10">
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => { setChannel("grab"); setOrders(null); setMessage(""); }}
          style={{
            flex: 1, borderRadius: 9999, padding: "10px 8px", fontSize: 14, fontWeight: 600, border: "1px solid",
            ...(channel === "grab"
              ? { backgroundColor: "#0F6B3D", color: "#ffffff", borderColor: "#0F6B3D" }
              : { backgroundColor: "#ffffff", color: "#3A2A18", borderColor: "#E8792F26" })
          }}
        >
          Grab
        </button>
        <button
          onClick={() => { setChannel("lineman"); setOrders(null); setMessage(""); }}
          style={{
            flex: 1, borderRadius: 9999, padding: "10px 8px", fontSize: 14, fontWeight: 600, border: "1px solid",
            ...(channel === "lineman"
              ? { backgroundColor: "#16A34A", color: "#ffffff", borderColor: "#16A34A" }
              : { backgroundColor: "#ffffff", color: "#3A2A18", borderColor: "#E8792F26" })
          }}
        >
          LINE MAN
        </button>
        <button
          onClick={() => { setChannel("thaichuaythai"); }}
          style={{
            flex: 1, borderRadius: 9999, padding: "10px 8px", fontSize: 14, fontWeight: 600, border: "1px solid",
            ...(channel === "thaichuaythai"
              ? { backgroundColor: "#2563EB", color: "#ffffff", borderColor: "#2563EB" }
              : { backgroundColor: "#ffffff", color: "#3A2A18", borderColor: "#E8792F26" })
          }}
        >
          ไทยช่วยไทย
        </button>
      </div>

      {channel !== "thaichuaythai" && (
        <>
          <p className="mb-4 text-sm text-ink/60">
            {channel === "grab"
              ? "เลือกวันที่ แล้วกรอกยอดรวมที่ได้รับจริงของวันนั้น"
              : "เลือกช่วงวันที่ แล้วกรอกยอดรวมที่ได้รับจริงในช่วงนั้น (ตามรอบที่โอนเข้ามา)"}
          </p>

          {channel === "grab" ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ marginBottom: 4, display: "block", fontSize: 12, color: "#3A2A1880" }}>วันที่</label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setTo(e.target.value);
                  setOrders(null);
                }}
                style={{
                  display: "block", width: "100%", minWidth: 0, maxWidth: "100%",
                  boxSizing: "border-box", borderRadius: 8, WebkitAppearance: "none", appearance: "none",
                  border: "1px solid #E8792F26", backgroundColor: "#ffffff", padding: "10px 12px", fontSize: 14
                }}
              />
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ marginBottom: 4, display: "block", fontSize: 12, color: "#3A2A1880" }}>ตั้งแต่วันที่</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); setOrders(null); }}
                  style={{
                    display: "block", width: "100%", minWidth: 0, maxWidth: "100%",
                    boxSizing: "border-box", borderRadius: 8, WebkitAppearance: "none", appearance: "none",
                    border: "1px solid #E8792F26", backgroundColor: "#ffffff", padding: "10px 12px", fontSize: 14
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ marginBottom: 4, display: "block", fontSize: 12, color: "#3A2A1880" }}>ถึงวันที่</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); setOrders(null); }}
                  style={{
                    display: "block", width: "100%", minWidth: 0, maxWidth: "100%",
                    boxSizing: "border-box", borderRadius: 8, WebkitAppearance: "none", appearance: "none",
                    border: "1px solid #E8792F26", backgroundColor: "#ffffff", padding: "10px 12px", fontSize: 14
                  }}
                />
              </div>
            </div>
          )}

          <button
            onClick={loadOrders}
            disabled={loading}
            style={{
              width: "100%", marginBottom: 16, borderRadius: 9999, backgroundColor: "#E8792F",
              padding: "14px 20px", fontSize: 16, fontWeight: 700, color: "#FCEFC0", border: "none",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)", opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? "กำลังโหลด..." : "ดึงยอดที่ยังไม่กระทบยอด"}
          </button>

          {orders && orders.length === 0 && (
            <p className="mb-4 text-sm text-ink/50">ไม่มีออเดอร์ที่ยังไม่กระทบยอดในช่วงนี้</p>
          )}

          {orders && orders.length > 0 && (
            <>
              <div className="mb-4 rounded-xl border border-forest/10 bg-white p-4">
                <p className="mb-2 text-sm text-ink/60">พบ {orders.length} ออเดอร์ ยังไม่กระทบยอด</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink/60">ยอดที่คีย์ไว้ทั้งหมด</span>
                  <span className="text-lg font-semibold text-forestDark">{keyedTotal.toFixed(0)} บาท</span>
                </div>
              </div>

              <label className="mb-2 block text-sm font-semibold text-ink">ยอดที่ได้รับจริง (บาท)</label>
              <input
                type="number"
                value={actualReceived}
                onChange={(e) => setActualReceived(e.target.value)}
                placeholder="เช่น 4200"
                className="mb-3 w-full rounded-lg border border-forest/15 px-3 py-2 text-sm"
              />

              {actualReceived && (
                <p className="mb-4 text-sm text-ink/60">
                  ส่วนต่าง (ค่าคอมมิชชั่นรวมโดยประมาณ): <span className="font-semibold text-red-600">{diff.toFixed(0)} บาท</span>
                </p>
              )}

              <button
                onClick={submitReconcile}
                disabled={submitting || orders.length === 0}
                style={{
                  width: "100%", borderRadius: 9999, backgroundColor: "#E8792F",
                  padding: "14px 20px", fontSize: 16, fontWeight: 700, color: "#FCEFC0", border: "none",
                  opacity: (submitting || orders.length === 0) ? 0.5 : 1
                }}
              >
                {submitting ? "กำลังบันทึก..." : "บันทึกกระทบยอด"}
              </button>
            </>
          )}

          {message && <p className="mt-4 text-sm text-ink/70">{message}</p>}
        </>
      )}

      {channel === "thaichuaythai" && (
        <>
          <p className="mb-4 text-sm text-ink/60">
            แอป LINE MAN ไม่บอกยอดของโครงการนี้แยกให้ ก็เลยเป็นแค่สมุดจดว่าวันไหนได้เงินโครงการมาเท่าไหร่
            ไม่เชื่อมกับออเดอร์ไหนเป็นพิเศษ
          </p>

          <div style={{ marginBottom: 16, borderRadius: 12, border: "1px solid #E8792F1A", backgroundColor: "#ffffff", padding: 16 }}>
            <label style={{ marginBottom: 8, display: "block", fontSize: 12, color: "#3A2A1880" }}>วันที่ได้รับเงินโอน</label>
            <input
              type="date"
              value={tctDate}
              onChange={(e) => setTctDate(e.target.value)}
              style={{
                marginBottom: 12, display: "block", width: "100%", minWidth: 0, maxWidth: "100%",
                boxSizing: "border-box", borderRadius: 8, WebkitAppearance: "none", appearance: "none",
                border: "1px solid #E8792F26", backgroundColor: "#ffffff", padding: "10px 12px", fontSize: 14
              }}
            />
            <label style={{ marginBottom: 8, display: "block", fontSize: 12, color: "#3A2A1880" }}>จำนวนเงิน (บาท)</label>
            <input
              type="number"
              value={tctAmount}
              onChange={(e) => setTctAmount(e.target.value)}
              placeholder="เช่น 1500"
              style={{
                marginBottom: 12, width: "100%", boxSizing: "border-box", borderRadius: 8,
                border: "1px solid #E8792F26", padding: "10px 12px", fontSize: 14
              }}
            />
            <label style={{ marginBottom: 8, display: "block", fontSize: 12, color: "#3A2A1880" }}>โน้ต (ไม่บังคับ)</label>
            <input
              type="text"
              value={tctNote}
              onChange={(e) => setTctNote(e.target.value)}
              placeholder="เช่น ยอดขาย 5-7 ก.ย."
              style={{
                marginBottom: 12, width: "100%", boxSizing: "border-box", borderRadius: 8,
                border: "1px solid #E8792F26", padding: "10px 12px", fontSize: 14
              }}
            />
            <button
              onClick={submitThaiChuayThai}
              disabled={tctSubmitting}
              style={{
                width: "100%", borderRadius: 9999, backgroundColor: "#E8792F",
                padding: "14px 20px", fontSize: 16, fontWeight: 700, color: "#FCEFC0", border: "none",
                boxShadow: "0 4px 10px rgba(0,0,0,0.15)", opacity: tctSubmitting ? 0.5 : 1
              }}
            >
              {tctSubmitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>

          {tctMessage && <p className="mb-3 text-sm text-red-600">{tctMessage}</p>}

          <div className="mb-3 rounded-xl border border-forest/10 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/60">ยอดสะสมทั้งหมดที่เคยได้รับ</span>
              <span className="text-lg font-semibold text-forestDark">{tctTotal.toFixed(0)} บาท</span>
            </div>
          </div>

          {tctLoading && <p className="text-sm text-ink/50">กำลังโหลด...</p>}

          {tctEntries && tctEntries.length === 0 && (
            <p className="text-sm text-ink/50">ยังไม่มีบันทึก</p>
          )}

          {tctEntries && tctEntries.length > 0 && (
            <div className="space-y-2">
              {tctEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-forest/10 bg-white p-3">
                  <div>
                    <p className="text-sm text-ink">{e.entry_date}</p>
                    {e.note && <p className="text-xs text-ink/50">{e.note}</p>}
                  </div>
                  <p className="font-semibold text-[#8B3A2B]">{Number(e.amount).toFixed(0)} บาท</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

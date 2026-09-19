"use client";

import { useEffect, useRef, useState } from "react";

type ExpenseEntry = {
  id: number;
  expense_date: string;
  amount: number;
  category: string;
  note: string | null;
  source: string;
  slip_image_url: string | null;
  original_slip_amount: number | null;
  created_at: string;
};

// ต้องตรงกับ CATEGORIES ใน app/api/expenses/upload-slip/route.ts เป๊ะๆ
const CATEGORIES = ["วัตถุดิบ", "ค่าแรง", "ค่าแก๊ส", "ค่าบรรจุภัณฑ์", "ค่าซ่อมอุปกรณ์", "ค่าเดินทาง", "ส่วนตัว", "อื่นๆ"];

// เวลาไทย (Bangkok) เสมอ ไม่ใช้ toISOString() เพราะนั่นคือเวลา UTC จะเพี้ยนวันตอนดึก
function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function daysAgoBangkok(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
}

function formatRaw(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function dayLabelTh(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00+07:00");
  return new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" }).format(d);
}

type PendingSlip = {
  amount: number | null;
  note: string | null;
  suggestedCategory: string | null;
  slipImageUrl: string;
};

export default function ExpenseTab() {
  const [entries, setEntries] = useState<ExpenseEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // --- คิวอัปโหลดหลายรูปพร้อมกัน ---
  // uploadQueue = ไฟล์ที่ยังไม่ได้ประมวลผล (ไม่รวมรูปที่กำลังรีวิวอยู่ตอนนี้ใน pendingSlip)
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const queuePosition = queueTotal > 0 ? queueTotal - uploadQueue.length : 0;

  // --- popup ยืนยันหลังอัปโหลดสลิป (แสดงทีละรูป ทีละใบตามคิว) ---
  const [pendingSlip, setPendingSlip] = useState<PendingSlip | null>(null);
  const [slipDate, setSlipDate] = useState(todayBangkok());
  const [slipCategory, setSlipCategory] = useState(CATEGORIES[0]);
  const [slipSplit, setSlipSplit] = useState(false);
  const [slipStoreAmount, setSlipStoreAmount] = useState("");
  const [slipSubmitting, setSlipSubmitting] = useState(false);

  // --- ฟอร์มบันทึกด้วยมือ ---
  const [manualDate, setManualDate] = useState(todayBangkok());
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState(CATEGORIES[0]);
  const [manualNote, setManualNote] = useState("");
  const [manualSplit, setManualSplit] = useState(false);
  const [manualStoreAmount, setManualStoreAmount] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualMessage, setManualMessage] = useState("");

  // --- แก้ไข/ลบรายการเดิม ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editPendingDelete, setEditPendingDelete] = useState(false);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEntries() {
    setLoading(true);
    setMessage("");
    try {
      const from = daysAgoBangkok(35);
      const to = todayBangkok();
      const res = await fetch(`/api/expenses?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage("โหลดไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setEntries(data.entries);
    } catch {
      setMessage("โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  // ---- อัปโหลดรูปสลิป (รองรับเลือกหลายรูปพร้อมกัน) ----
  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  // เลือกไฟล์เสร็จ -> ตั้งคิวไว้ แล้วเริ่มประมวลผลรูปแรกทันที ที่เหลือรอในคิว
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;

    setQueueTotal(files.length);
    const [first, ...rest] = files;
    setUploadQueue(rest);
    await processFile(first);
  }

  // อ่าน 1 ไฟล์ด้วย AI แล้วเปิด popup ให้ยืนยัน (ยังไม่บันทึกจริง)
  async function processFile(file: File) {
    setUploading(true);
    setMessage("");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/expenses/upload-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage("อ่านสลิปไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        // อ่านรูปนี้ไม่สำเร็จ ข้ามไปรูปถัดไปในคิวอัตโนมัติ (ถ้ามี)
        await advanceQueue();
        return;
      }
      setPendingSlip({
        amount: data.amount,
        note: data.note,
        suggestedCategory: data.suggestedCategory,
        slipImageUrl: data.slipImageUrl,
      });
      setSlipDate(todayBangkok());
      setSlipCategory(data.suggestedCategory ?? CATEGORIES[0]);
      setSlipSplit(false);
      setSlipStoreAmount("");
    } catch {
      setMessage("อ่านสลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
      await advanceQueue();
    } finally {
      setUploading(false);
    }
  }

  // หยิบไฟล์ถัดไปจากคิวมาประมวลผลต่อ ถ้าคิวหมดแล้วก็เคลียร์สถานะคิว
  async function advanceQueue() {
    setUploadQueue((current) => {
      if (current.length === 0) {
        setQueueTotal(0);
        return current;
      }
      const [next, ...rest] = current;
      processFile(next);
      return rest;
    });
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }

  async function confirmPendingSlip() {
    if (!pendingSlip) return;
    const totalAmount = pendingSlip.amount ?? 0;
    const amountToSave = slipSplit ? Number(slipStoreAmount || 0) : totalAmount;
    if (!amountToSave || amountToSave <= 0) {
      setMessage("กรอกจำนวนเงินให้ถูกต้องก่อนบันทึก");
      return;
    }
    setSlipSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseDate: slipDate,
          amount: amountToSave,
          category: slipCategory,
          note: pendingSlip.note,
          source: "slip",
          slipImageUrl: pendingSlip.slipImageUrl,
          originalSlipAmount: slipSplit ? totalAmount : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage("บันทึกไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setPendingSlip(null);
      loadEntries();
      // บันทึกรูปนี้เสร็จแล้ว ไปรูปถัดไปในคิวต่ออัตโนมัติ (ถ้ามี)
      await advanceQueue();
    } catch {
      setMessage("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSlipSubmitting(false);
    }
  }

  // ข้ามรูปนี้ (ไม่บันทึก) แล้วไปรูปถัดไปในคิวต่อ
  async function skipPendingSlip() {
    setPendingSlip(null);
    await advanceQueue();
  }

  // ---- บันทึกด้วยมือ ----
  async function submitManual() {
    if (!manualAmount) {
      setManualMessage("กรอกจำนวนเงินก่อนครับ");
      return;
    }
    const totalAmount = Number(manualAmount);
    const amountToSave = manualSplit ? Number(manualStoreAmount || 0) : totalAmount;
    if (!amountToSave || amountToSave <= 0) {
      setManualMessage("กรอกจำนวนเงินให้ถูกต้อง");
      return;
    }
    setManualSubmitting(true);
    setManualMessage("");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseDate: manualDate,
          amount: amountToSave,
          category: manualCategory,
          note: manualNote || null,
          source: "manual",
          originalSlipAmount: manualSplit ? totalAmount : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualMessage("บันทึกไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setManualAmount("");
      setManualNote("");
      setManualSplit(false);
      setManualStoreAmount("");
      loadEntries();
    } catch {
      setManualMessage("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setManualSubmitting(false);
    }
  }

  // ---- แก้ไข/ลบ ----
  function startEdit(entry: ExpenseEntry) {
    setEditingId(entry.id);
    setEditDate(entry.expense_date.slice(0, 10));
    setEditAmount(String(entry.amount));
    setEditCategory(entry.category);
    setEditNote(entry.note ?? "");
    setEditPendingDelete(false);
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPendingDelete(false);
  }

  async function saveEdit() {
    if (!editingId || !editDate || !editAmount || !editCategory) {
      setMessage("กรอกข้อมูลให้ครบก่อนครับ");
      return;
    }
    setEditSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          expenseDate: editDate,
          amount: Number(editAmount),
          category: editCategory,
          note: editNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage("แก้ไขไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setEditingId(null);
      loadEntries();
    } catch {
      setMessage("แก้ไขไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function deleteEntry() {
    if (!editingId) return;
    if (!editPendingDelete) {
      setEditPendingDelete(true);
      return;
    }
    setEditSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/expenses?id=${editingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setMessage("ลบไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      setEditingId(null);
      setEditPendingDelete(false);
      loadEntries();
    } catch {
      setMessage("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setEditSubmitting(false);
    }
  }

  // ---- คำนวณสรุปเดือนนี้ + วันที่ยังไม่มีข้อมูล (7 วันล่าสุด) ----
  const today = todayBangkok();
  const thisMonthPrefix = today.slice(0, 7); // YYYY-MM
  const monthEntries = (entries ?? []).filter((e) => e.expense_date.slice(0, 7) === thisMonthPrefix);
  const monthTotal = monthEntries.reduce((s, e) => s + Number(e.amount), 0);
  const monthCount = monthEntries.length;

  const last7Dates = Array.from({ length: 7 }, (_, i) => daysAgoBangkok(6 - i));
  const missingDays = last7Dates.filter((d) => !(entries ?? []).some((e) => e.expense_date.slice(0, 10) === d));

  return (
    <div style={{ maxWidth: 420, paddingBottom: 40 }}>
      {/* ไม่ใส่ capture="environment" แล้ว เพื่อให้กดแล้วเลือกได้ทั้งถ่ายรูปใหม่ หรือเลือกจากคลังรูปเดิม
          ใส่ multiple ไว้ด้วย เพื่อเลือกได้หลายรูปพร้อมกันตอนเลือกจากคลังรูป (อัปทีละหลายใบ) */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <button
        onClick={handleUploadClick}
        disabled={uploading}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          borderRadius: 9999, backgroundColor: "#E8792F", padding: "14px 20px", fontSize: 16,
          fontWeight: 700, color: "#FCEFC0", border: "none", boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
          marginBottom: 16, opacity: uploading ? 0.6 : 1
        }}
      >
        {uploading
          ? queueTotal > 1
            ? `กำลังอ่านสลิป (${queuePosition}/${queueTotal})...`
            : "กำลังอ่านสลิป..."
          : "📷 ถ่ายรูปสลิป / อัปโหลด (เลือกได้หลายรูป)"}
      </button>

      <div style={{ borderRadius: 16, border: "1px solid #0F6B3D26", backgroundColor: "#fff", padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontSize: 13, color: "#3A2A1899" }}>รายจ่ายที่บันทึกแล้วเดือนนี้</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#3A2A18" }}>{formatRaw(monthTotal)} บาท</span>
        </div>
        <div style={{ fontSize: 11, color: "#3A2A1866" }}>จาก {monthCount} รายการ</div>
      </div>

      {missingDays.length > 0 && (
        <div style={{ borderRadius: 16, border: "1px solid #D6282833", backgroundColor: "#FCEAEA", padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#D62828", margin: "0 0 8px" }}>
            ⚠️ ยังไม่มีข้อมูล {missingDays.length} วัน (7 วันล่าสุด)
          </p>
          {missingDays.map((d) => (
            <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "#3A2A18" }}>{dayLabelTh(d)}</span>
              <button
                onClick={() => setManualDate(d)}
                style={{ fontSize: 12, fontWeight: 600, color: "#D62828", background: "none", border: "1px solid #D6282855", borderRadius: 9999, padding: "5px 12px" }}
              >
                เพิ่มเลย
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingSlip && (
        <div
          onClick={() => !slipSubmitting && skipPendingSlip()}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(58,42,24,0.45)", display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxHeight: "85vh", overflowY: "auto", background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#3A2A18", margin: 0 }}>ยืนยันรายการจากสลิป</h3>
              {queueTotal > 1 && (
                <span style={{ fontSize: 12, color: "#3A2A1899", fontWeight: 600 }}>
                  รูปที่ {queuePosition} / {queueTotal}
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: "#3A2A1873", marginBottom: 14 }}>
              {pendingSlip.note ? `หมายเหตุที่อ่านได้: "${pendingSlip.note}"` : "ไม่มีหมายเหตุในสลิป"}
            </p>

            <div style={{ backgroundColor: "#3A2A180D", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: "#3A2A1899" }}>ยอดรวมจากสลิป</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#3A2A18" }}>
                {pendingSlip.amount != null ? formatRaw(pendingSlip.amount) : "อ่านไม่ได้"} บาท
              </div>
            </div>

            <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 4 }}>วันที่ของรายการ</label>
            <input
              type="date"
              value={slipDate}
              onChange={(e) => setSlipDate(e.target.value)}
              style={{ marginBottom: 12, display: "block", width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #E8792F26", padding: "10px 12px", fontSize: 14 }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "10px 12px", borderRadius: 10, backgroundColor: "#E8792F14" }}>
              <span style={{ fontSize: 13, color: "#3A2A18", fontWeight: 600 }}>บิลนี้มีของปนกัน (ร้าน+ส่วนตัว)</span>
              <input type="checkbox" checked={slipSplit} onChange={(e) => setSlipSplit(e.target.checked)} style={{ width: 20, height: 20 }} />
            </div>

            {slipSplit && (
              <>
                <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 4 }}>ส่วนที่เป็นของร้าน (บาท)</label>
                <input
                  type="number"
                  value={slipStoreAmount}
                  onChange={(e) => setSlipStoreAmount(e.target.value)}
                  placeholder="เช่น 300"
                  style={{ marginBottom: 8, width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1.5px solid #8B3A2B", padding: "10px 12px", fontSize: 14 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, backgroundColor: "#3A2A180D", marginBottom: 14, fontSize: 12, color: "#3A2A1899" }}>
                  <span>ส่วนที่เหลือ (ไม่นับเป็นรายจ่ายร้าน)</span>
                  <span>{formatRaw(Math.max(0, (pendingSlip.amount ?? 0) - Number(slipStoreAmount || 0)))} บาท</span>
                </div>
              </>
            )}

            <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 6 }}>หมวด</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setSlipCategory(c)}
                  style={{
                    fontSize: 12, padding: "6px 12px", borderRadius: 9999, border: "none",
                    backgroundColor: slipCategory === c ? "#8B3A2B" : "#3A2A180D",
                    color: slipCategory === c ? "#FCEFC0" : "#3A2A18"
                  }}
                >
                  {c}
                </button>
              ))}
            </div>

            <button
              onClick={confirmPendingSlip}
              disabled={slipSubmitting}
              style={{ width: "100%", borderRadius: 9999, backgroundColor: "#E8792F", padding: "12px 20px", fontSize: 14, fontWeight: 700, color: "#FCEFC0", border: "none", opacity: slipSubmitting ? 0.5 : 1 }}
            >
              {slipSubmitting ? "กำลังบันทึก..." : queueTotal > 1 && queuePosition < queueTotal ? "ยืนยัน แล้วไปรูปถัดไป" : "ยืนยันบันทึก"}
            </button>
            <button
              onClick={skipPendingSlip}
              disabled={slipSubmitting}
              style={{ display: "block", width: "100%", textAlign: "center", marginTop: 8, fontSize: 13, color: "#3A2A1899", background: "none", border: "none" }}
            >
              {queueTotal > 1 ? "ข้ามรูปนี้ ไม่บันทึก" : "ยกเลิก"}
            </button>
          </div>
        </div>
      )}

      <div style={{ borderRadius: 16, border: "1px solid #0F6B3D26", backgroundColor: "#fff", padding: 16, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#3A2A18", margin: "0 0 12px" }}>✏️ บันทึกด้วยมือ (ไม่มีสลิป)</h3>

        <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 4 }}>วันที่</label>
        <input
          type="date"
          value={manualDate}
          onChange={(e) => setManualDate(e.target.value)}
          style={{ marginBottom: 10, display: "block", width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #E8792F26", padding: "10px 12px", fontSize: 14 }}
        />

        <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 4 }}>
          {manualSplit ? "ยอดรวมทั้งบิล (บาท)" : "จำนวนเงิน (บาท)"}
        </label>
        <input
          type="number"
          value={manualAmount}
          onChange={(e) => setManualAmount(e.target.value)}
          placeholder="เช่น 450"
          style={{ marginBottom: 10, width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #E8792F26", padding: "10px 12px", fontSize: 14 }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "10px 12px", borderRadius: 10, backgroundColor: "#E8792F14" }}>
          <span style={{ fontSize: 13, color: "#3A2A18", fontWeight: 600 }}>บิลนี้มีของปนกัน (ร้าน+ส่วนตัว)</span>
          <input type="checkbox" checked={manualSplit} onChange={(e) => setManualSplit(e.target.checked)} style={{ width: 20, height: 20 }} />
        </div>

        {manualSplit && (
          <>
            <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 4 }}>ส่วนที่เป็นของร้าน (บาท)</label>
            <input
              type="number"
              value={manualStoreAmount}
              onChange={(e) => setManualStoreAmount(e.target.value)}
              placeholder="เช่น 300"
              style={{ marginBottom: 8, width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1.5px solid #8B3A2B", padding: "10px 12px", fontSize: 14 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 10, backgroundColor: "#3A2A180D", marginBottom: 10, fontSize: 12, color: "#3A2A1899" }}>
              <span>ส่วนที่เหลือ (ไม่นับเป็นรายจ่ายร้าน)</span>
              <span>{formatRaw(Math.max(0, Number(manualAmount || 0) - Number(manualStoreAmount || 0)))} บาท</span>
            </div>
          </>
        )}

        <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 6 }}>หมวด</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setManualCategory(c)}
              style={{
                fontSize: 12, padding: "6px 12px", borderRadius: 9999, border: "none",
                backgroundColor: manualCategory === c ? "#8B3A2B" : "#3A2A180D",
                color: manualCategory === c ? "#FCEFC0" : "#3A2A18"
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 12, color: "#3A2A1880", display: "block", marginBottom: 4 }}>หมายเหตุ (ไม่บังคับ)</label>
        <input
          type="text"
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          placeholder="เช่น ซื้อจากตลาดนัด"
          style={{ marginBottom: 12, width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #E8792F26", padding: "10px 12px", fontSize: 14 }}
        />

        {manualMessage && <p style={{ fontSize: 12, color: "#D62828", marginBottom: 8 }}>{manualMessage}</p>}

        <button
          onClick={submitManual}
          disabled={manualSubmitting}
          style={{ width: "100%", borderRadius: 9999, backgroundColor: "#E8792F", padding: "12px 20px", fontSize: 14, fontWeight: 700, color: "#FCEFC0", border: "none", opacity: manualSubmitting ? 0.5 : 1 }}
        >
          {manualSubmitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>

      {message && <p style={{ fontSize: 13, color: "#D62828", marginBottom: 12 }}>{message}</p>}

      <div style={{ borderRadius: 16, border: "1px solid #0F6B3D26", backgroundColor: "#fff", padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#3A2A18", margin: "0 0 10px" }}>🧾 รายการล่าสุด</h3>

        {loading && <p style={{ fontSize: 13, color: "#3A2A1866" }}>กำลังโหลด...</p>}
        {!loading && entries && entries.length === 0 && <p style={{ fontSize: 13, color: "#3A2A1866" }}>ยังไม่มีรายการ</p>}

        {!loading && entries && entries.map((entry) => (
          <div key={entry.id} style={{ borderBottom: "1px solid #EFE9DA", padding: "10px 0" }}>
            {editingId === entry.id ? (
              <div>
                <label style={{ fontSize: 11, color: "#3A2A1880", display: "block", marginBottom: 3 }}>วันที่</label>
                <input
                  type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  style={{ marginBottom: 6, display: "block", width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #E8792F26", padding: "8px 10px", fontSize: 13 }}
                />
                <label style={{ fontSize: 11, color: "#3A2A1880", display: "block", marginBottom: 3 }}>จำนวนเงิน (บาท)</label>
                <input
                  type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                  style={{ marginBottom: 6, width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #E8792F26", padding: "8px 10px", fontSize: 13 }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c} onClick={() => setEditCategory(c)}
                      style={{
                        fontSize: 11, padding: "5px 10px", borderRadius: 9999, border: "none",
                        backgroundColor: editCategory === c ? "#8B3A2B" : "#3A2A180D",
                        color: editCategory === c ? "#FCEFC0" : "#3A2A18"
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label style={{ fontSize: 11, color: "#3A2A1880", display: "block", marginBottom: 3 }}>หมายเหตุ</label>
                <input
                  type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)}
                  style={{ marginBottom: 8, width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #E8792F26", padding: "8px 10px", fontSize: 13 }}
                />
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <button
                    onClick={saveEdit} disabled={editSubmitting}
                    style={{ flex: 1, borderRadius: 9999, backgroundColor: "#E8792F", padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#FCEFC0", border: "none", opacity: editSubmitting ? 0.5 : 1 }}
                  >
                    {editSubmitting ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                  </button>
                  <button
                    onClick={cancelEdit} disabled={editSubmitting}
                    style={{ flex: 1, borderRadius: 9999, backgroundColor: "#fff", padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#3A2A18", border: "1px solid #E8792F26" }}
                  >
                    ยกเลิก
                  </button>
                </div>
                {editPendingDelete && (
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#D62828", marginBottom: 6 }}>
                    แน่ใจนะครับ? ลบรายการนี้ทิ้งถาวร — กดอีกครั้งเพื่อยืนยัน
                  </p>
                )}
                <button
                  onClick={deleteEntry} disabled={editSubmitting}
                  style={{ width: "100%", borderRadius: 9999, backgroundColor: "#D62828", padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#fff", border: "none", opacity: editSubmitting ? 0.5 : 1 }}
                >
                  {editPendingDelete ? "กดอีกครั้งเพื่อยืนยันลบ" : "ลบรายการนี้"}
                </button>
              </div>
            ) : (
              <div onClick={() => startEdit(entry)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: "#3A2A18", margin: 0 }}>
                    {entry.category}{entry.source === "slip" ? " · 📷" : ""}
                  </p>
                  <p style={{ fontSize: 11, color: "#3A2A1873", margin: 0 }}>
                    {dayLabelTh(entry.expense_date)}{entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#8B3A2B", flexShrink: 0 }}>
                  {formatRaw(Number(entry.amount))} บาท
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

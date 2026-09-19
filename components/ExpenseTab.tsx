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

  // --- popup ยืนยันหลังอัปโหลดสลิป ---
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

  // ---- อัปโหลดรูปสลิป ----
  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
    } catch {
      setMessage("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSlipSubmitting(false);
    }
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
      <input
        type="file"
        accept="image/*"
        capture="environment"
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
        {uploading ? "กำลังอ่านสลิป..." : "📷 ถ่ายรูปสลิป / อัปโหลด"}
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
          onClick={() => !slipSubmitting && setPendingSlip(null)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(58,42,24,0.45)", display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxHeight: "85vh", overflowY: "auto", background: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#3A2A18", margin: "0 0 4px" }}>ยืนยันรายการจากสลิป</h3>
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

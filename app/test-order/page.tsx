"use client";

import { useState } from "react";

// เมนูตัวอย่างไว้สุ่มยิง Order ทดสอบ — พี่แก้ชื่อ/ราคาให้ตรงกับเมนูจริงได้เลย
const SAMPLE_MENU = [
  { name: "ข้าวผัดหมู", price: 60 },
  { name: "ผัดกะเพราไก่", price: 55 },
  { name: "ต้มยำกุ้ง", price: 120 },
  { name: "คาโบนาร่า", price: 89 },
  { name: "ชาเย็น", price: 30 },
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildRandomOrder() {
  const itemCount = 1 + Math.floor(Math.random() * 3); // สุ่ม 1-3 รายการ
  const items = Array.from({ length: itemCount }).map(() => {
    const menuItem = randomItem(SAMPLE_MENU);
    const qty = 1 + Math.floor(Math.random() * 2); // สุ่ม 1-2 ต่อรายการ
    return {
      name: menuItem.name,
      qty,
      unitPrice: menuItem.price,
      options: "",
      note: "",
    };
  });
  const total = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const isTakeaway = Math.random() > 0.5;

  return {
    orderType: isTakeaway ? "takeaway" : "table",
    tableNumber: isTakeaway ? null : String(1 + Math.floor(Math.random() * 10)),
    customerName: isTakeaway ? "ลูกค้าทดสอบ" : null,
    customerPhone: isTakeaway ? "0812345678" : null,
    items,
    total,
  };
}

export default function TestOrderPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const fireTestOrder = async () => {
    setLoading(true);
    setResult(null);
    const order = buildRandomOrder();
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `✅ สำเร็จ — Order #${data.orderId}\n` +
            order.items.map((i) => `${i.qty} x ${i.name}`).join(", ") +
            `\nรวม ${order.total} บาท`
        );
      } else {
        setResult(`❌ ล้มเหลว: ${data.error}`);
      }
    } catch (err: any) {
      setResult(`❌ เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>🧪 ยิง Order ทดสอบ</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        ใช้หน้านี้เพื่อทดสอบระบบเท่านั้น ไม่เกี่ยวกับสถานะเปิด/ปิดร้านในหน้าเมนู
      </p>
      <button
        onClick={fireTestOrder}
        disabled={loading}
        style={{
          padding: "12px 24px",
          fontSize: 16,
          borderRadius: 8,
          border: "none",
          background: loading ? "#999" : "#111",
          color: "#fff",
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "กำลังยิง..." : "ยิง Order สุ่ม 1 ออเดอร์"}
      </button>
      {result && (
        <pre
          style={{
            marginTop: 24,
            padding: 16,
            background: "#f5f5f5",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            fontSize: 14,
          }}
        >
          {result}
        </pre>
      )}
    </div>
  );
}

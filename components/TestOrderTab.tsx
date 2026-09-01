"use client";

import { useState } from "react";

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
  const itemCount = 1 + Math.floor(Math.random() * 3);
  const items = Array.from({ length: itemCount }).map(() => {
    const menuItem = randomItem(SAMPLE_MENU);
    const qty = 1 + Math.floor(Math.random() * 2);
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

export default function TestOrderTab() {
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
    <div>
      <p className="mb-4 text-sm text-ink/60">
        ใช้ปุ่มนี้ยิง Order ทดสอบเข้าระบบ ไม่เกี่ยวกับสถานะเปิด/ปิดร้านในหน้าเมนู
      </p>
      <button
        onClick={fireTestOrder}
        disabled={loading}
        className="rounded-full bg-forest px-6 py-2.5 text-sm font-medium text-sand disabled:opacity-50"
      >
        {loading ? "กำลังยิง..." : "ยิง Order สุ่ม 1 ออเดอร์"}
      </button>
      {result && (
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-forest/10 p-4 text-sm text-ink">
          {result}
        </pre>
      )}
    </div>
  );
}

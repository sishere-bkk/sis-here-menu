"use client";

import { useState } from "react";
import ReconcileTab from "./ReconcileTab";
import ExpenseTab from "./ExpenseTab";

export default function FinanceTab() {
  const [subTab, setSubTab] = useState<"delivery" | "expense">("delivery");

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-2xl bg-forest/10 p-1">
        <button
          onClick={() => setSubTab("delivery")}
          className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
            subTab === "delivery" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
          }`}
        >
          🛵 เช็กยอดเดลิเวอรี่
        </button>
        <button
          onClick={() => setSubTab("expense")}
          className={`flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold transition-colors sm:py-2.5 sm:text-sm ${
            subTab === "expense" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
          }`}
        >
          🧾 บันทึกรายจ่าย
        </button>
      </div>

      {subTab === "delivery" && <ReconcileTab />}
      {subTab === "expense" && <ExpenseTab />}
    </div>
  );
}

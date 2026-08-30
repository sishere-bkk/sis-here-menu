"use client";

import { useEffect, useState } from "react";

type StockItem = {
  id: string;
  category: string;
  name: string;
  count_method: "level" | "count";
  unit: string | null;
  min_value: number | null;
  target_value: number | null;
  level_value: string | null;
  count_value: number | null;
  status: string;
  photo_url: string | null;
};

const CATEGORY_ORDER = [
  "เนื้อสัตว์",
  "ผัก",
  "ของแห้ง",
  "แช่เย็น",
  "แช่แข็ง",
  "เครื่องปรุง",
  "แพคเกจจิ้ง",
  "ของใช้อื่นๆ"
];

const LEVELS = ["เยอะ", "ครึ่ง", "ใกล้หมด", "หมด"];

function statusStyle(status: string) {
  switch (status) {
    case "ปกติ":
      return "bg-green-50 text-green-700 border-green-200";
    case "เฝ้าดู":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "ใกล้หมด":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "หมด":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

export default function StockTab() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ทั้งหมด");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadItems() {
    try {
      const res = await fetch("/api/stock");
      const data = await res.json();
      if (res.ok && data.items) setItems(data.items as StockItem[]);
    } catch (err) {
      // ignore, will retry on next load
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function updateItem(id: string, action: string, value: any) {
    setSavingId(id);
    try {
      const res = await fetch("/api/stock/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, value })
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            if (action === "set_level") {
              return { ...it, level_value: value, status: data.status };
            }
            const newCount =
              action === "delta" ? Math.max(0, (it.count_value ?? 0) + value) : value;
            return { ...it, count_value: newCount, status: data.status };
          })
        );
      }
    } catch (err) {
      // ignore
    } finally {
      setSavingId(null);
    }
  }

  const categories = ["ทั้งหมด", ...CATEGORY_ORDER.filter((c) => items.some((it) => it.category === c))];
  const visibleItems =
    activeCategory === "ทั้งหมด" ? items : items.filter((it) => it.category === activeCategory);

  if (loading) {
    return <p className="text-ink/50">กำลังโหลดข้อมูลสต็อก...</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              activeCategory === cat
                ? "border-forest bg-forest text-sand"
                : "border-forest/20 text-forestDark"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-forest/15 bg-white p-3"
          >
            {item.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photo_url}
                alt={item.name}
                className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{item.name}</p>
              <p className="text-xs text-ink/40">{item.category}</p>
            </div>

            <span
              className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(
                item.status
              )}`}
            >
              {item.status}
            </span>

            {item.count_method === "level" ? (
              <div className="flex flex-shrink-0 gap-1">
                {LEVELS.map((lv) => (
                  <button
                    key={lv}
                    disabled={savingId === item.id}
                    onClick={() => updateItem(item.id, "set_level", lv)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      item.level_value === lv
                        ? "border-forest bg-forest text-sand"
                        : "border-forest/20 text-ink/60"
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  disabled={savingId === item.id}
                  onClick={() => updateItem(item.id, "delta", -1)}
                  className="h-8 w-8 rounded-full border border-forest/20 text-lg text-forestDark"
                >
                  −
                </button>
                <span className="w-14 text-center text-sm text-ink">
                  {item.count_value ?? 0} {item.unit}
                </span>
                <button
                  disabled={savingId === item.id}
                  onClick={() => updateItem(item.id, "delta", 1)}
                  className="h-8 w-8 rounded-full border border-forest/20 text-lg text-forestDark"
                >
                  +
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

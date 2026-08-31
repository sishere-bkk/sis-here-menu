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
  last_checked_at: string | null;
  checked_by: string | null;
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
const FILTERS = ["ทั้งหมด", "ยังไม่เช็ค", "ใกล้หมด"] as const;
type Filter = (typeof FILTERS)[number];

type StatusColors = { bg: string; border: string; text: string };

function statusColors(status: string): StatusColors {
  switch (status) {
    case "ปกติ":
      return { bg: "#dcfce7", border: "#4ade80", text: "#166534" };
    case "เฝ้าดู":
      return { bg: "#fef9c3", border: "#facc15", text: "#854d0e" };
    case "ใกล้หมด":
      return { bg: "#ffedd5", border: "#fb923c", text: "#9a3412" };
    case "หมด":
      return { bg: "#fee2e2", border: "#f87171", text: "#991b1b" };
    default:
      return { bg: "#f9fafb", border: "#e5e7eb", text: "#374151" };
  }
}

function bangkokDateStr(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(d);
}

function isCheckedToday(lastCheckedAt: string | null): boolean {
  if (!lastCheckedAt) return false;
  return bangkokDateStr(new Date(lastCheckedAt)) === bangkokDateStr(new Date());
}

function getDriveThumbnail(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w200`;
}

function StockThumb({ url, name }: { url: string | null; name: string }) {
  const [error, setError] = useState(false);
  const src = !error ? getDriveThumbnail(url) : null;

  if (!src) {
    return (
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-forest/10 text-lg">
        📦
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={48}
      height={48}
      onError={() => setError(true)}
      className="h-12 w-12 flex-shrink-0 rounded-lg bg-forest/5 object-cover"
    />
  );
}

export default function StockTab() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("ทั้งหมด");
  const [activeFilter, setActiveFilter] = useState<Filter>("ทั้งหมด");
  const [notifying, setNotifying] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  // อัปเดตหน้าจอทันที (optimistic) แล้วค่อยยิง request ไปเบื้องหลัง ไม่ต้องรอ
  function updateItem(id: string, action: string, value: any) {
    const nowIso = new Date().toISOString();
    let computedStatus = "";

    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;

        if (action === "confirm") {
          return { ...it, last_checked_at: nowIso };
        }

        if (action === "set_level") {
          const map: Record<string, string> = {
            เยอะ: "ปกติ",
            ครึ่ง: "เฝ้าดู",
            ใกล้หมด: "ใกล้หมด",
            หมด: "หมด"
          };
          computedStatus = map[value] || it.status;
          return { ...it, level_value: value, status: computedStatus, last_checked_at: nowIso };
        }

        const newCount =
          action === "delta" ? Math.max(0, (it.count_value ?? 0) + value) : Math.max(0, Number(value));
        computedStatus =
          newCount <= 0 ? "หมด" : it.min_value !== null && newCount <= it.min_value ? "ใกล้หมด" : "ปกติ";
        return { ...it, count_value: newCount, status: computedStatus, last_checked_at: nowIso };
      })
    );

    // ยิงไปเซิร์ฟเวอร์เบื้องหลัง ไม่ block หน้าจอ
    fetch("/api/stock/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, value })
    }).catch(() => {
      // ถ้าพลาดจริงๆ ค่อยโหลดข้อมูลใหม่ทับ
      loadItems();
    });
  }

  function startEdit(item: StockItem) {
    setEditingId(item.id);
    setEditValue(String(item.count_value ?? 0));
  }

  function commitEdit(id: string) {
    const num = Number(editValue);
    if (!Number.isNaN(num)) {
      updateItem(id, "set_count", num);
    }
    setEditingId(null);
  }

  async function sendNotify() {
    setNotifying(true);
    try {
      const res = await fetch("/api/stock/notify", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert(`ส่งแจ้งเตือนไป Discord แล้ว (${data.count} รายการ)`);
      } else {
        alert("ส่งไม่สำเร็จ: " + (data.error || ""));
      }
    } catch (err) {
      alert("ส่งไม่สำเร็จ");
    } finally {
      setNotifying(false);
    }
  }

  const categories = [
    "ทั้งหมด",
    ...CATEGORY_ORDER.filter((c) => items.some((it) => it.category === c))
  ];

  const lowCount = items.filter((it) => it.status === "ใกล้หมด" || it.status === "หมด").length;

  const visibleItems = items.filter((it) => {
    if (activeCategory !== "ทั้งหมด" && it.category !== activeCategory) return false;
    if (activeFilter === "ยังไม่เช็ค" && isCheckedToday(it.last_checked_at)) return false;
    if (activeFilter === "ใกล้หมด" && it.status !== "ใกล้หมด" && it.status !== "หมด") return false;
    return true;
  });

  if (loading) {
    return <p className="text-ink/50">กำลังโหลดข้อมูลสต็อก...</p>;
  }

  return (
    <div>
      {/* แถบกรอง: ยังไม่เช็ค / ใกล้หมด */}
      <div className="mb-3 flex gap-4 border-b border-forest/10">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`border-b-2 pb-2 text-sm font-medium ${
              activeFilter === f ? "border-forest text-forestDark" : "border-transparent text-ink/40"
            }`}
          >
            {f}
            {f === "ใกล้หมด" && lowCount > 0 ? ` (${lowCount})` : ""}
          </button>
        ))}
      </div>

      {activeFilter === "ใกล้หมด" && lowCount > 0 && (
        <button
          onClick={sendNotify}
          disabled={notifying}
          style={{ backgroundColor: "#8B3A2B" }}
          className="mb-4 rounded-full px-4 py-2 text-sm font-medium text-white"
        >
          {notifying ? "กำลังส่ง..." : `🔔 ส่งแจ้งเตือน ${lowCount} รายการไป Discord`}
        </button>
      )}

      {/* แถบหมวดหมู่ */}
      <div
        className="mb-4"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            className={`rounded-full border px-2 py-2.5 text-sm font-medium ${
              activeCategory === cat
                ? "border-forest bg-forest text-sand"
                : "border-forest/20 text-forestDark"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 && (
        <p className="text-ink/50">ไม่มีรายการในหมวดนี้</p>
      )}

      <div className="space-y-3">
        {visibleItems.map((item) => {
          const checked = isCheckedToday(item.last_checked_at);
          const colors = statusColors(item.status);

          return (
            <div
              key={item.id}
              className="rounded-xl border p-3 transition-colors"
              style={{
                backgroundColor: checked ? colors.bg : "#ffffff",
                borderColor: checked ? colors.border : "#e5e7eb"
              }}
            >
              <div className="flex items-center gap-3">
                <StockThumb url={item.photo_url} name={item.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{item.name}</p>
                  <p className="text-xs text-ink/40">{item.category}</p>
                </div>
                {checked ? (
                  <span
                    className="flex-shrink-0 rounded-full border-2 px-3.5 py-1.5 text-xs font-medium"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                  >
                    {item.status}
                  </span>
                ) : (
                  <span className="flex-shrink-0 rounded-full border-2 border-gray-300 bg-gray-100 px-3.5 py-1.5 text-xs font-medium text-gray-500">
                    ยังไม่เช็ค
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                {item.count_method === "level" ? (
                  <div className="flex flex-wrap gap-1">
                    {LEVELS.map((lv) => (
                      <button
                        key={lv}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateItem(item.id, "delta", -1)}
                      className="h-8 w-8 rounded-full border border-forest/20 text-lg text-forestDark"
                    >
                      −
                    </button>

                    {editingId === item.id ? (
                      <input
                        type="number"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(item.id);
                        }}
                        className="w-16 rounded-lg border border-forest/30 px-1 py-0.5 text-center text-sm"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="w-16 rounded-lg border border-transparent text-center text-sm text-ink underline decoration-dotted"
                      >
                        {item.count_value ?? 0} {item.unit}
                      </button>
                    )}

                    <button
                      onClick={() => updateItem(item.id, "delta", 1)}
                      className="h-8 w-8 rounded-full border border-forest/20 text-lg text-forestDark"
                    >
                      +
                    </button>
                  </div>
                )}

                <button
                  onClick={() => updateItem(item.id, "confirm", null)}
                  className="flex-shrink-0 rounded-full border border-forest/30 bg-forest/5 px-3 py-1.5 text-xs font-medium text-forestDark"
                >
                  ✓ ไม่เปลี่ยนแปลง
                </button>
              </div>

              {checked && item.checked_by && (
                <p
                  className="mt-1 text-right text-ink/30"
                  style={{ fontSize: "9px" }}
                >
                  เช็คโดย {item.checked_by}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

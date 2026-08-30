"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase, MenuItem, OptionGroup } from "../lib/supabaseClient";
import { getStoreStatus, StoreStatus } from "../lib/storeHours";

type CartLine = {
  key: string;
  item: MenuItem;
  qty: number;
  selections: Record<string, string[]>;
  unitPrice: number;
  note: string;
};

const CATEGORY_ORDER = [
  "อาหารเช้า",
  "สปาเก็ตตี้",
  "อาหารจานเดียว",
  "สลัด และของทานเล่น"
];

function categoryRank(category: string) {
  const normalized = category.normalize("NFC").trim();
  const index = CATEGORY_ORDER.findIndex(
    (c) => c.normalize("NFC").trim() === normalized
  );
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function MenuPageInner() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get("table");
  const typeParam = searchParams.get("type");

  const orderType: "table" | "takeaway" | "other" = tableParam
    ? "table"
    : typeParam === "takeaway"
    ? "takeaway"
    : "other";

  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null);

  useEffect(() => {
    getStoreStatus().then(setStoreStatus);
  }, []);

  const [takeawayConfirmed, setTakeawayConfirmed] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [optionItem, setOptionItem] = useState<MenuItem | null>(null);
  const [modalSelections, setModalSelections] = useState<Record<string, string[]>>({});
  const [modalNote, setModalNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadMenu() {
      const { data, error } = await supabase
        .from("menu")
        .select("*")
        .eq("available", true)
        .order("category", { ascending: true });

      if (!error && data) {
        setItems(data as MenuItem[]);
      }
      setLoading(false);
    }
    loadMenu();
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return Array.from(map.entries()).sort(
      (a, b) => categoryRank(a[0]) - categoryRank(b[0])
    );
  }, [items]);

  const visibleCategories = useMemo(() => {
    if (selectedCategory === "all") return categories;
    return categories.filter(([category]) => category === selectedCategory);
  }, [categories, selectedCategory]);

  function hasOptions(item: MenuItem) {
    return !!item.options?.groups?.length;
  }

  function openItem(item: MenuItem) {
    const initial: Record<string, string[]> = {};
    if (hasOptions(item)) {
      for (const group of item.options!.groups) {
        initial[group.name] = [];
      }
    }
    setModalSelections(initial);
    setModalNote("");
    setOptionItem(item);
  }

  function toggleChoice(group: OptionGroup, label: string) {
    setModalSelections((prev) => {
      const current = prev[group.name] ?? [];
      if (group.type === "single") {
        return { ...prev, [group.name]: [label] };
      }
      const isSelected = current.includes(label);
      const next = isSelected
        ? current.filter((l) => l !== label)
        : [...current, label];
      return { ...prev, [group.name]: next };
    });
  }

  function addLineToCart(
    item: MenuItem,
    selections: Record<string, string[]>,
    priceDiff: number,
    note: string
  ) {
    const key = `${item.id}-${JSON.stringify(selections)}-${note}`;
    setCart((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          key,
          item,
          selections,
          unitPrice: item.price + priceDiff,
          qty: (existing?.qty ?? 0) + 1,
          note
        }
      };
    });
  }

  function setNote(key: string, note: string) {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      return { ...prev, [key]: { ...existing, note } };
    });
  }

  function confirmOptions() {
    if (!optionItem) return;
    if (hasOptions(optionItem)) {
      for (const group of optionItem.options!.groups) {
        if (group.required && (modalSelections[group.name] ?? []).length === 0) {
          alert(`กรุณาเลือก "${group.name}" ก่อนครับ`);
          return;
        }
      }
    }
    let priceDiff = 0;
    if (hasOptions(optionItem)) {
      for (const group of optionItem.options!.groups) {
        const selectedLabels = modalSelections[group.name] ?? [];
        for (const choice of group.choices) {
          if (selectedLabels.includes(choice.label)) {
            priceDiff += choice.price_diff;
          }
        }
      }
    }
    addLineToCart(optionItem, modalSelections, priceDiff, modalNote);
    setOptionItem(null);
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[key];
      } else {
        next[key] = { ...existing, qty: nextQty };
      }
      return next;
    });
  }

  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cartLines.reduce(
    (sum, line) => sum + line.qty * line.unitPrice,
    0
  );

  async function submitOrder() {
    if (submitting || cartLines.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderType,
          tableNumber: tableParam ?? null,
          customerName: orderType === "takeaway" ? customerName : null,
          customerPhone: orderType === "takeaway" ? customerPhone : null,
          items: cartLines.map((line) => ({
            name: line.item.name,
            qty: line.qty,
            unitPrice: line.unitPrice,
            note: line.note,
            options: Object.values(line.selections).flat().join(", ")
          })),
          total: cartTotal
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert("ส่งออเดอร์ไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      alert(`สั่งซื้อสำเร็จ! หมายเลขออเดอร์ #${data.orderId}`);
      setCart({});
      setCartOpen(false);
    } catch (err) {
      alert("ส่งออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้งครับ");
    } finally {
      setSubmitting(false);
    }
  }

  if (storeStatus && !storeStatus.isOpen) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-v2.png"
            alt="SiS HERE"
            className="mx-auto mb-4 h-16 w-16 rounded-full object-cover"
          />
          <h1 className="mb-2 font-display text-2xl font-semibold text-forestDark">
            ขออภัย ร้านปิดอยู่ตอนนี้
          </h1>
          <p className="text-sm text-ink/60">
            {storeStatus.todayHours
              ? `วันนี้ร้านเปิดเวลา ${storeStatus.todayHours.open} - ${storeStatus.todayHours.close} น.`
              : "วันนี้ร้านหยุดครับ"}
          </p>
          <p className="mt-1 text-sm text-ink/60">
            กรุณาแวะมาใหม่ในช่วงเวลาเปิดร้านนะครับ
          </p>
        </div>
      </main>
    );
  }

  if (orderType === "takeaway" && !takeawayConfirmed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand px-6">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm">
          <h1 className="mb-1 font-display text-2xl font-semibold text-forestDark">
            SiS HERE
          </h1>
          <p className="mb-6 text-sm text-ink/60">
            สั่งกลับบ้าน — กรอกชื่อและเบอร์โทรก่อนนะครับ
          </p>
          <label className="mb-1 block text-sm text-ink/70">ชื่อ</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mb-4 w-full rounded-xl border border-forest/15 px-3 py-2"
          />
          <label className="mb-1 block text-sm text-ink/70">เบอร์โทร</label>
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="mb-6 w-full rounded-xl border border-forest/15 px-3 py-2"
          />
          <button
            disabled={!customerName || !customerPhone}
            onClick={() => setTakeawayConfirmed(true)}
            className="w-full rounded-full bg-forest py-3 font-medium text-sand disabled:opacity-40"
          >
            ดูเมนู
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <header className="flex items-center gap-3 border-b border-forest/10 bg-sand px-6 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-v2.png"
          alt="SiS HERE"
          className="h-10 w-10 flex-none rounded-full object-cover sm:h-14 sm:w-14"
        />
        <div>
          <p className="text-xs tracking-wide text-turmericDark sm:text-sm">
            {orderType === "table"
              ? `เมนูออนไลน์ · โต๊ะ ${tableParam}`
              : orderType === "takeaway"
              ? `เมนูออนไลน์ · สั่งกลับบ้าน (${customerName})`
              : "เมนูออนไลน์"}
          </p>
          <h1 className="font-display text-xl font-semibold text-forestDark sm:text-3xl">
            SiS HERE
          </h1>
        </div>
      </header>

      {loading && <p className="px-6 py-10 text-ink/60">กำลังโหลดเมนู...</p>}

      {!loading && categories.length === 0 && (
        <p className="px-6 py-10 text-ink/60">
          ยังไม่มีเมนูในระบบ ลองเพิ่มรายการในตาราง menu บน Supabase ดูนะครับ
        </p>
      )}

      {!loading && categories.length > 0 && (
        <div className="flex">
          <nav className="sticky top-0 h-[calc(100vh-1px)] w-20 flex-none overflow-y-auto border-r border-forest/10 bg-white py-4 sm:w-32">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`block w-full py-3 pl-4 pr-2 text-center text-xs sm:text-sm ${
                selectedCategory === "all"
                  ? "border-l-4 border-turmeric bg-forest/5 font-semibold text-forestDark"
                  : "text-ink/60"
              }`}
            >
              ทั้งหมด
            </button>
            {categories.map(([category]) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`block w-full px-2 py-3 text-center text-xs sm:text-sm ${
                  selectedCategory === category
                    ? "border-l-4 border-turmeric bg-forest/5 font-semibold text-forestDark"
                    : "text-ink/60"
                }`}
              >
                {category}
              </button>
            ))}
          </nav>

          <div className="flex-1 space-y-10 px-4 py-6 sm:px-6">
            {visibleCategories.map(([category, categoryItems]) => (
              <section key={category}>
                <h2 className="mb-3 text-lg font-semibold text-forestDark">
                  {category}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 rounded-2xl border border-forest/10 bg-white p-3"
                    >
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-20 w-20 flex-none rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-20 w-20 flex-none rounded-xl bg-sand" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-ink">{item.name}</p>
                        <p className="mt-1 text-sm font-semibold text-[#8B3A2B]">
                          {item.price.toFixed(0)} บาท
                        </p>
                      </div>
                      <button
                        onClick={() => openItem(item)}
                        className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-sand transition hover:bg-forestDark"
                      >
                        เพิ่ม
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-full bg-forestDark px-6 py-4 text-sand shadow-lg"
        >
          <span>{cartCount} รายการในตะกร้า</span>
          <span className="font-semibold">{cartTotal.toFixed(0)} บาท</span>
        </button>
      )}

      {optionItem && (
        <div className="fixed inset-0 z-20 flex items-end bg-ink/40">
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-forestDark">
                {optionItem.name}
              </h3>
              <button
                onClick={() => setOptionItem(null)}
                className="text-sm text-ink/50"
              >
                ปิด
              </button>
            </div>

            {hasOptions(optionItem) && (
              <div className="space-y-6">
                {optionItem.options!.groups.map((group) => (
                  <div key={group.name}>
                    <p className="mb-2 font-medium text-ink">
                      {group.name}
                      {group.required && (
                        <span className="ml-1 text-sm text-turmeric">
                          (ต้องเลือก)
                        </span>
                      )}
                    </p>
                    <div className="space-y-2">
                      {group.choices.map((choice) => {
                        const selected = (
                          modalSelections[group.name] ?? []
                        ).includes(choice.label);
                        return (
                          <button
                            key={choice.label}
                            onClick={() => toggleChoice(group, choice.label)}
                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                              selected
                                ? "border-forest bg-forest/10"
                                : "border-forest/15"
                            }`}
                          >
                            <span>{choice.label}</span>
                            <span className="text-sm text-ink/50">
                              {choice.price_diff > 0
                                ? `+${choice.price_diff}`
                                : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={hasOptions(optionItem) ? "mt-6" : ""}>
              <p className="mb-2 font-medium text-ink">หมายเหตุ (ถ้ามี)</p>
              <textarea
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                placeholder="เช่น ไม่ใส่ผัก, เผ็ดน้อย"
                rows={2}
                className="w-full rounded-xl border border-forest/15 px-3 py-2 text-sm text-ink placeholder:text-ink/30"
              />
            </div>

            <button
              onClick={confirmOptions}
              className="mt-6 w-full rounded-full bg-forest py-3 font-medium text-sand"
            >
              เพิ่มลงตะกร้า
            </button>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-10 flex items-end bg-ink/40">
          <div className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-forestDark">
                ตะกร้าของคุณ
              </h3>
              <button
                onClick={() => setCartOpen(false)}
                className="text-sm text-ink/50"
              >
                ปิด
              </button>
            </div>

            <div className="space-y-3">
              {cartLines.map((line) => {
                const optionText = Object.values(line.selections)
                  .flat()
                  .join(", ");
                return (
                  <div
                    key={line.key}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-ink">{line.item.name}</p>
                      {optionText && (
                        <p className="text-xs text-ink/40">{optionText}</p>
                      )}
                      <p className="text-sm text-ink/50">
                        {line.unitPrice.toFixed(0)} บาท
                      </p>
                      <input
                        type="text"
                        value={line.note}
                        onChange={(e) => setNote(line.key, e.target.value)}
                        placeholder="หมายเหตุ เช่น ไม่ใส่ผัก, เผ็ดน้อย"
                        className="mt-1 w-full rounded-lg border border-forest/15 px-2 py-1 text-xs text-ink placeholder:text-ink/30"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => changeQty(line.key, -1)}
                        className="h-8 w-8 rounded-full border border-forest/20 text-forestDark"
                      >
                        -
                      </button>
                      <span className="w-4 text-center">{line.qty}</span>
                      <button
                        onClick={() => changeQty(line.key, 1)}
                        className="h-8 w-8 rounded-full border border-forest/20 text-forestDark"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-forest/10 pt-4">
              <span className="font-medium text-ink">ยอดรวม</span>
              <span className="text-lg font-semibold text-forestDark">
                {cartTotal.toFixed(0)} บาท
              </span>
            </div>

            <button
              disabled={submitting}
              className="mt-4 w-full rounded-full bg-turmeric py-3 font-medium text-white transition hover:bg-turmericDark disabled:opacity-50"
              onClick={submitOrder}
            >
              {submitting ? "กำลังส่งออเดอร์..." : "สั่งซื้อ"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="p-6 text-ink/60">กำลังโหลด...</div>}>
      <MenuPageInner />
    </Suspense>
  );
}

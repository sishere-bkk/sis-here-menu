"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, MenuItem, OptionGroup } from "../lib/supabaseClient";

type QuickPreset = {
  id: string;
  category: string;
  selection_type: "single" | "multi";
  name: string;
  price: number;
  sort_order: number;
};

type OrderLine = {
  key: string;
  name: string;
  qty: number;
  unitPrice: number;
  options: string;
  note: string;
  isCustom: boolean;
  sourceItem?: MenuItem;
  selections?: Record<string, string[]>;
};

// หน้านี้ใช้คีย์ออเดอร์ Grab/LINE MAN เท่านั้น เลยต้องใช้ชื่อ/ราคา/ตัวเลือก/รูป
// เวอร์ชัน "delivery_*" แทนของเมนูออนไลน์ปกติเสมอ (ถ้าไม่ได้ตั้งไว้ ค่อย fallback ไปใช้ของเดิม)
// ยกเว้นรูป (delivery_image_url) ที่ตั้งใจ "ไม่" fallback ไปใช้รูปเมนูออนไลน์ เพราะอยากแยกกันเด็ดขาด

const EXTRAS_CATEGORY = "ของทานเล่น ราคาพิเศษ";
// หมวดที่ไม่ต้องมี popup ตัวเลือกเลย (กด + แล้วเพิ่มลงออเดอร์ทันที)
const NO_OPTIONS_CATEGORIES = ["เครื่องดื่ม", "สลัดและของทานเล่น"];

function getEffectivePrice(item: MenuItem): number {
  const deliveryPrice = (item as any).delivery_price;
  return deliveryPrice !== null && deliveryPrice !== undefined ? deliveryPrice : item.price;
}

function getEffectiveName(item: MenuItem): string {
  const deliveryName = (item as any).delivery_name;
  return deliveryName !== null && deliveryName !== undefined && deliveryName !== ""
    ? deliveryName
    : item.name;
}

function getEffectiveOptions(item: MenuItem): { groups: OptionGroup[] } | null {
  const deliveryOptions = (item as any).delivery_options;
  if (deliveryOptions && deliveryOptions.groups) return deliveryOptions;
  return item.options ?? null;
}

// รูปสำหรับหน้าคีย์ออเดอร์เท่านั้น ไม่ fallback ไปใช้รูปเมนูออนไลน์ (แยกกันเด็ดขาดตามที่ต้องการ)
function getDeliveryImage(item: MenuItem): string | null {
  const url = (item as any).delivery_image_url;
  return url ? url : null;
}

export default function ManualOrderTab({ staffName }: { staffName: string }) {
  const [channel, setChannel] = useState<"grab" | "lineman">("grab");
  const [platformOrderNo, setPlatformOrderNo] = useState("");
  const [needsUtensils, setNeedsUtensils] = useState(true);
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [presets, setPresets] = useState<QuickPreset[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"menu" | "quick">("menu");

  const [optionItem, setOptionItem] = useState<MenuItem | null>(null);
  const [modalSelections, setModalSelections] = useState<Record<string, string[]>>({});
  const [modalNote, setModalNote] = useState("");

  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      // ดึงเมนูทั้งหมดที่ available=true มาให้ครบ (รวมเมนู delivery_only ด้วย)
      // หน้าลูกค้า (app/page.tsx) ต่างหากที่กรอง delivery_only ออก ไม่ใช่หน้านี้
      const [{ data: menuData }, { data: presetData }] = await Promise.all([
        supabase.from("menu").select("*").eq("available", true),
        supabase.from("quick_add_presets").select("*").eq("active", true).order("sort_order")
      ]);
      if (menuData) setMenuItems(menuData as MenuItem[]);
      if (presetData) setPresets(presetData as QuickPreset[]);
    }
    load();
  }, []);

  // จัดกลุ่มเมนูตามหมวด (บาง category ใน DB มีช่องว่างนำหน้าติดมา เลย trim() ก่อนจัดกลุ่ม กันแตกกลุ่มโดยไม่ตั้งใจ)
  // ลำดับหมวดที่ต้องการให้เรียงตอนเลือกเมนู หมวดที่ไม่ได้ระบุไว้จะต่อท้ายตามลำดับที่เจอ
  const CATEGORY_ORDER = [
    "อร่อยซ่ากับโค้ก",
    "เซตสุดฮิต",
    "อาหารเช้า",
    "สปาเก็ตตี้",
    "ข้าวผัด",
    "ข้าว",
    "สลัดและของทานเล่น"
  ];

  const menuGroups = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const cat = (item.category || "อื่นๆ").trim();
      const list = map.get(cat) ?? [];
      list.push(item);
      map.set(cat, list);
    }
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a[0]);
      const ib = CATEGORY_ORDER.indexOf(b[0]);
      const ra = ia === -1 ? CATEGORY_ORDER.length : ia;
      const rb = ib === -1 ? CATEGORY_ORDER.length : ib;
      return ra - rb;
    });
    return entries;
  }, [menuItems]);

  // "ของทานเล่น ราคาพิเศษ" แนบเป็นกลุ่มตัวเลือกท้าย popup ของเมนูแทน เลยตัดออกจากแท็บ "รายการเพิ่มเติม"
  const presetGroups = useMemo(() => {
    const map = new Map<string, QuickPreset[]>();
    for (const p of presets) {
      if (p.category === EXTRAS_CATEGORY) continue;
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries());
  }, [presets]);

  const extrasGroup: OptionGroup | null = useMemo(() => {
    const extras = presets.filter((p) => p.category === EXTRAS_CATEGORY);
    if (extras.length === 0) return null;
    return {
      name: EXTRAS_CATEGORY,
      type: "multi",
      required: false,
      choices: extras.map((p) => ({ label: p.name, price_diff: p.price }))
    };
  }, [presets]);

  function getModalGroups(item: MenuItem): OptionGroup[] {
    const own = getEffectiveOptions(item)?.groups ?? [];
    const category = (item.category || "").trim();
    if (NO_OPTIONS_CATEGORIES.includes(category)) return own;
    // เซตสุดฮิต ใส่ "ของทานเล่น ราคาพิเศษ" ต่อรายการในเซตไว้ใน delivery_options โดยตรงแล้ว (ทำ SQL แยก)
    // เลยไม่ให้ระบบแนบกลุ่มนี้ซ้ำเข้าไปอีกชั้นสำหรับหมวดนี้
    if (category === "เซตสุดฮิต") return own;
    return extrasGroup ? [...own, extrasGroup] : own;
  }

  function hasOptions(item: MenuItem) {
    return getModalGroups(item).length > 0;
  }

  function openMenuItem(item: MenuItem) {
    if (!hasOptions(item)) {
      addOrIncrementLine({
        key: `menu-${item.id}-{}`,
        name: getEffectiveName(item),
        qty: 1,
        unitPrice: getEffectivePrice(item),
        options: "",
        note: "",
        isCustom: false,
        sourceItem: item,
        selections: {}
      });
      setPickerOpen(false);
      return;
    }
    const initial: Record<string, string[]> = {};
    for (const g of getModalGroups(item)) initial[g.name] = [];
    setModalSelections(initial);
    setModalNote("");
    setOptionItem(item);
  }

  function toggleChoice(group: OptionGroup, label: string) {
    setModalSelections((prev) => {
      const current = prev[group.name] ?? [];
      if (group.type === "single") return { ...prev, [group.name]: [label] };
      const isSelected = current.includes(label);
      return {
        ...prev,
        [group.name]: isSelected
          ? current.filter((l) => l !== label)
          : [...current, label]
      };
    });
  }

  function confirmOptions() {
    if (!optionItem) return;
    const groups = getModalGroups(optionItem);
    for (const g of groups) {
      if (g.required && (modalSelections[g.name] ?? []).length === 0) {
        alert(`กรุณาเลือก "${g.name}" ก่อนครับ`);
        return;
      }
    }
    let priceDiff = 0;
    for (const g of groups) {
      const selected = modalSelections[g.name] ?? [];
      for (const c of g.choices) if (selected.includes(c.label)) priceDiff += c.price_diff;
    }
    const optionText = Object.values(modalSelections).flat().join(", ");
    addOrIncrementLine({
      key: `menu-${optionItem.id}-${JSON.stringify(modalSelections)}-${modalNote}`,
      name: getEffectiveName(optionItem),
      qty: 1,
      unitPrice: getEffectivePrice(optionItem) + priceDiff,
      options: optionText,
      note: modalNote,
      isCustom: false,
      sourceItem: optionItem,
      selections: modalSelections
    });
    setOptionItem(null);
    setPickerOpen(false);
  }

  function addOrIncrementLine(newLine: OrderLine) {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === newLine.key);
      if (existing) {
        return prev.map((l) =>
          l.key === newLine.key ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, newLine];
    });
  }

  function addPreset(p: QuickPreset) {
    addOrIncrementLine({
      key: `preset-${p.id}`,
      name: p.name,
      qty: 1,
      unitPrice: p.price,
      options: "",
      note: "",
      isCustom: true
    });
  }

  function addCustomManual() {
    if (!customName.trim() || !customPrice) {
      alert("กรอกชื่อและราคาก่อนครับ");
      return;
    }
    addOrIncrementLine({
      key: `custom-${Date.now()}`,
      name: customName.trim(),
      qty: 1,
      unitPrice: Number(customPrice),
      options: "",
      note: "",
      isCustom: true
    });
    setCustomName("");
    setCustomPrice("");
    setPickerOpen(false);
  }

  function duplicateLine(line: OrderLine) {
    if (!line.sourceItem) {
      changeQty(line.key, 1);
      return;
    }
    setModalSelections(line.selections ?? {});
    setModalNote(line.note);
    setOptionItem(line.sourceItem);
    setPickerOpen(true);
  }

  function changeQty(key: string, delta: number) {
    setLines((prev) => {
      const next = prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0);
      return next;
    });
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const discountValue = appliedDiscount;
  const total = Math.max(0, subtotal - discountValue);

  function confirmDiscount() {
    setAppliedDiscount(Number(discountInput) || 0);
    setPickerOpen(false);
  }

  async function submitOrder() {
    if (lines.length === 0) {
      alert("ยังไม่มีรายการในออเดอร์ครับ");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/manual-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          platformOrderNo: platformOrderNo || null,
          keyedBy: staffName || null,
          needsUtensils,
          discount: discountValue,
          items: lines.map((l) => ({
            name: l.name,
            qty: l.qty,
            unitPrice: l.unitPrice,
            options: l.options,
            note: l.note,
            isCustom: l.isCustom
          })),
          total: subtotal
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert("บันทึกไม่สำเร็จ: " + (data.error ?? "ไม่ทราบสาเหตุ"));
        return;
      }
      alert(`บันทึกออเดอร์สำเร็จ #${data.orderId} — ไปพิมพ์บิลได้ที่แท็บออเดอร์`);
      setLines([]);
      setPlatformOrderNo("");
      setNeedsUtensils(true);
      setDiscountInput("");
      setAppliedDiscount(0);
    } catch {
      alert("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งครับ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-10">
      {/* ข้อ 11: สีคนละโทนของแต่ละแอป — Grab เขียวเข้ม / LINE MAN เขียวสว่าง */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setChannel("grab")}
          className="flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors border"
          style={
            channel === "grab"
              ? { backgroundColor: "#0F6B3D", color: "#ffffff", borderColor: "#0F6B3D" }
              : { backgroundColor: "#ffffff", color: "#3A2A1899", borderColor: "#E8792F26" }
          }
        >
          Grab
        </button>
        <button
          onClick={() => setChannel("lineman")}
          className="flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors border"
          style={
            channel === "lineman"
              ? { backgroundColor: "#16A34A", color: "#ffffff", borderColor: "#16A34A" }
              : { backgroundColor: "#ffffff", color: "#3A2A1899", borderColor: "#E8792F26" }
          }
        >
          LINE MAN
        </button>
      </div>

      <input
        type="text"
        value={platformOrderNo}
        onChange={(e) => setPlatformOrderNo(e.target.value)}
        placeholder="เลขออเดอร์แพลตฟอร์ม (ไม่บังคับ) เช่น GR-48213"
        className="mb-4 w-full rounded-xl border border-forest/15 px-3 py-2 text-sm"
      />

      <p className="mb-2 text-sm font-semibold text-ink">รายการ ({lines.length})</p>
      {lines.length === 0 && (
        <p className="mb-3 text-sm text-ink/40">ยังไม่มีรายการ กด "เพิ่มรายการจากเมนู" ด้านล่าง</p>
      )}
      <div className="mb-3 space-y-2">
        {lines.map((line) => (
          <div key={line.key} className="rounded-xl bg-white border border-forest/10 p-3">
            <div className="flex justify-between">
              <p className="text-sm text-ink">{line.name}</p>
              <p className="text-sm font-semibold text-[#8B3A2B]">
                {(line.unitPrice * line.qty).toFixed(0)} บาท
              </p>
            </div>
            {line.options && <p className="text-xs text-ink/50 mt-0.5">{line.options}</p>}
            {line.note && <p className="text-xs text-ink/50">+ {line.note}</p>}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => changeQty(line.key, -1)} className="h-7 w-7 rounded-full border border-forest/20 text-forestDark text-sm">−</button>
                <span className="w-4 text-center text-sm">{line.qty}</span>
                <button onClick={() => changeQty(line.key, 1)} className="h-7 w-7 rounded-full border border-forest/20 text-forestDark text-sm">+</button>
              </div>
              <div className="flex gap-3 text-xs">
                <button onClick={() => duplicateLine(line)} className="text-forestDark">คัดลอกรายการนี้</button>
                <button onClick={() => removeLine(line.key)} className="text-red-700">ลบ</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ข้อ 2/3: ปุ่มเพิ่มรายการจากเมนู อยู่ติดใต้รายการก่อน แล้วค่อยเป็นช้อนส้อม */}
      <button
        onClick={() => { setPickerMode("menu"); setPickerOpen(true); }}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-forest py-5 text-lg font-bold text-sand shadow-md active:scale-[0.99] transition-transform"
      >
        <span className="text-xl leading-none">＋</span> เพิ่มรายการจากเมนู
      </button>

      <p className="mb-2 text-sm font-semibold text-ink">ช้อนส้อม</p>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setNeedsUtensils(true)}
          className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors border"
          style={
            needsUtensils
              ? { backgroundColor: "#0D9488", color: "#ffffff", borderColor: "#0D9488" }
              : { backgroundColor: "#ffffff", color: "#3A2A1899", borderColor: "#E8792F26" }
          }
        >
          รับช้อนส้อม
        </button>
        <button
          onClick={() => setNeedsUtensils(false)}
          className="flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors border"
          style={
            !needsUtensils
              ? { backgroundColor: "#D62828", color: "#ffffff", borderColor: "#D62828" }
              : { backgroundColor: "#ffffff", color: "#3A2A1899", borderColor: "#E8792F26" }
          }
        >
          ไม่รับช้อนส้อม
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-forest/10 pt-3 mb-1">
        <span className="text-sm text-ink/60">ยอดรวมรายการ</span>
        <span className="text-base text-ink">{subtotal.toFixed(0)} บาท</span>
      </div>
      {discountValue > 0 && (
        <div className="flex items-center justify-between pb-1">
          <span className="text-sm text-red-600">ส่วนลด</span>
          <span className="text-base text-red-600">−{discountValue.toFixed(0)} บาท</span>
        </div>
      )}
      <div className="flex items-center justify-between pb-3 mb-4">
        <span className="text-sm text-ink/60">รวมทั้งหมด</span>
        <span className="text-xl font-semibold text-forestDark">{total.toFixed(0)} บาท</span>
      </div>

      <button
        disabled={submitting}
        onClick={submitOrder}
        className="w-full rounded-full bg-forest py-3 font-medium text-sand disabled:opacity-50"
      >
        {submitting ? "กำลังบันทึก..." : "บันทึกออเดอร์"}
      </button>

      {pickerOpen && !optionItem && (
        <div className="fixed inset-0 z-20 flex items-end bg-ink/40">
          <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white">
            <div className="flex items-center justify-between p-6 pb-4">
              <h3 className="text-lg font-semibold text-forestDark">เพิ่มรายการ</h3>
              <button onClick={() => setPickerOpen(false)} className="text-sm text-ink/50">ปิด</button>
            </div>

            <div className="px-6">
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => setPickerMode("menu")}
                  className={`flex-1 rounded-full py-2 text-sm font-medium ${pickerMode === "menu" ? "bg-forest text-sand" : "bg-forest/5 text-ink/60"}`}
                >
                  เลือกจากเมนู
                </button>
                <button
                  onClick={() => setPickerMode("quick")}
                  className={`flex-1 rounded-full py-2 text-sm font-medium ${pickerMode === "quick" ? "bg-forest text-sand" : "bg-forest/5 text-ink/60"}`}
                >
                  รายการเพิ่มเติม
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 pb-6">
              {pickerMode === "menu" && (
                <div>
                  {menuGroups.map(([category, items]) => (
                    <div key={category} className="mb-5">
                      {/* ข้อ 6: หัวข้อหมวดหมู่ ให้โดดเด่นขึ้น เป็นแถบสีคั่นชัดเจน + sticky ตอนเลื่อน */}
                      <p
                        className="sticky top-0 z-10 mb-2 -mx-6 px-6 py-2 text-sm font-bold uppercase tracking-wide"
                        style={{ backgroundColor: "#3A2A18", color: "#FCEFC0" }}
                      >
                        {category}
                      </p>
                      <div className="space-y-2">
                        {items.map((item) => {
                          const img = getDeliveryImage(item);
                          return (
                            <div key={item.id} className="flex items-center justify-between rounded-xl border border-forest/10 p-3">
                              <div className="flex items-center gap-3">
                                {img && (
                                  // ข้อ 7: รูปเฉพาะหน้าคีย์ออเดอร์ แยกจากรูปเมนูออนไลน์
                                  <img src={img} alt={getEffectiveName(item)} className="h-12 w-12 flex-none rounded-lg object-cover" />
                                )}
                                <div>
                                  <p className="text-sm text-ink">{getEffectiveName(item)}</p>
                                  <p className="text-xs text-[#8B3A2B]">{getEffectivePrice(item).toFixed(0)} บาท</p>
                                </div>
                              </div>
                              <button
                                onClick={() => openMenuItem(item)}
                                className="rounded-full bg-forest px-4 py-1.5 text-sm text-sand"
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {pickerMode === "quick" && (
                <div>
                  {/* ข้อ 9: ส่วนลด อยู่ในแท็บ "รายการเพิ่มเติม" */}
                  <div className="mb-4 rounded-xl border border-dashed border-forest/30 p-3">
                    <p className="mb-2 text-xs font-medium text-ink">ส่วนลด (บาท)</p>
                    <input
                      type="number"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="เช่น 20"
                      className="mb-2 w-full rounded-lg border border-forest/15 px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={confirmDiscount}
                      className="w-full rounded-full bg-forest py-2 text-sm text-sand"
                    >
                      ยืนยันส่วนลด
                    </button>
                    {appliedDiscount > 0 && (
                      <p className="mt-2 text-xs text-red-600">ใช้ส่วนลดอยู่ {appliedDiscount.toFixed(0)} บาท</p>
                    )}
                  </div>

                  {presetGroups.map(([category, items]) => (
                    <div key={category} className="mb-4">
                      <p className="mb-2 text-sm font-medium text-ink">{category}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addPreset(p)}
                            className="rounded-xl bg-forest/5 px-3 py-2 text-xs text-ink"
                          >
                            {p.name} {p.price > 0 ? `+${p.price}` : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {presetGroups.length === 0 && (
                    <p className="mb-3 text-xs text-ink/40">
                      ยังไม่มีรายการด่วนตั้งไว้ — พิมพ์เองด้านล่างไปก่อนได้ครับ
                    </p>
                  )}
                  <div className="rounded-xl border border-dashed border-forest/30 p-3">
                    <p className="mb-2 text-xs font-medium text-ink">พิมพ์เอง</p>
                    <input
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="ชื่อรายการ"
                      className="mb-2 w-full rounded-lg border border-forest/15 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="number"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="ราคา (บาท)"
                      className="mb-2 w-full rounded-lg border border-forest/15 px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={addCustomManual}
                      className="w-full rounded-full bg-forest py-2 text-sm text-sand"
                    >
                      เพิ่มลงออเดอร์
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {optionItem && (
        <div className="fixed inset-0 z-30 flex items-end bg-ink/40">
          {/* ข้อ 4: สไลด์ขวาเพื่อปิด (ไม่บันทึก) / ข้อ 8: ปุ่มยืนยันลอยอยู่ล่างเสมอ ไม่จมไปกับเนื้อหา */}
          <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white">
            <div className="flex items-center justify-between p-6 pb-4">
              <h3 className="text-lg font-semibold text-forestDark">{getEffectiveName(optionItem)}</h3>
              <button onClick={() => setOptionItem(null)} className="text-sm text-ink/50">ปิด</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-6">
                {getModalGroups(optionItem).map((group) => (
                  <div key={group.name}>
                    <p className="mb-2 font-medium text-ink">
                      {group.name}
                      {group.required && <span className="ml-1 text-sm text-turmeric">(ต้องเลือก)</span>}
                    </p>
                    <div className="space-y-2">
                      {group.choices.map((choice) => {
                        const selected = (modalSelections[group.name] ?? []).includes(choice.label);
                        return (
                          <button
                            key={choice.label}
                            onClick={() => toggleChoice(group, choice.label)}
                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                              selected ? "border-forest bg-forest/10" : "border-forest/15"
                            }`}
                          >
                            <span>{choice.label}</span>
                            <span className="text-sm text-ink/50">
                              {choice.price_diff > 0 ? `+${choice.price_diff}` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 mb-4">
                <p className="mb-2 text-sm font-medium text-ink">โน้ตเพิ่มเติม (ไม่บังคับ)</p>
                <input
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="เช่น ไม่เผ็ด, แยกน้ำจิ้ม"
                  className="w-full rounded-lg border border-forest/15 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-forest/10 p-4">
              <button
                onClick={confirmOptions}
                className="w-full rounded-full bg-forest py-3 font-medium text-sand shadow-md"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

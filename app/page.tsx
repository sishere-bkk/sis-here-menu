"use client";

import { useEffect, useMemo, useState } from "react";
   import { supabase, MenuItem } from "../lib/supabaseClient";

type CartLine = {
  item: MenuItem;
  qty: number;
};

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<number, CartLine>>({});
  const [cartOpen, setCartOpen] = useState(false);

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
    return Array.from(map.entries());
  }, [items]);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: { item, qty: (existing?.qty ?? 0) + 1 }
      };
    });
  }

  function changeQty(itemId: number, delta: number) {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = { ...existing, qty: nextQty };
      }
      return next;
    });
  }

  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cartLines.reduce(
    (sum, line) => sum + line.qty * line.item.price,
    0
  );

  return (
    <main className="min-h-screen pb-28">
      <header className="border-b border-forest/10 bg-sand px-6 py-8">
        <p className="text-sm tracking-wide text-turmericDark">เมนูออนไลน์</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-forestDark">
          SiS HERE
        </h1>
      </header>

      {loading && (
        <p className="px-6 py-10 text-ink/60">กำลังโหลดเมนู...</p>
      )}

      {!loading && categories.length === 0 && (
        <p className="px-6 py-10 text-ink/60">
          ยังไม่มีเมนูในระบบ ลองเพิ่มรายการในตาราง menu บน Supabase ดูนะครับ
        </p>
      )}

      <div className="space-y-10 px-6 py-6">
        {categories.map(([category, categoryItems]) => (
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
                    <p className="mt-1 text-sm text-turmericDark">
                      {item.price.toFixed(0)} บาท
                    </p>
                  </div>
                  <button
                    onClick={() => addToCart(item)}
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

      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-full bg-forestDark px-6 py-4 text-sand shadow-lg"
        >
          <span>{cartCount} รายการในตะกร้า</span>
          <span className="font-semibold">{cartTotal.toFixed(0)} บาท</span>
        </button>
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
              {cartLines.map(({ item, qty }) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ink">{item.name}</p>
                    <p className="text-sm text-ink/50">
                      {item.price.toFixed(0)} บาท
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => changeQty(item.id, -1)}
                      className="h-8 w-8 rounded-full border border-forest/20 text-forestDark"
                    >
                      -
                    </button>
                    <span className="w-4 text-center">{qty}</span>
                    <button
                      onClick={() => changeQty(item.id, 1)}
                      className="h-8 w-8 rounded-full border border-forest/20 text-forestDark"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-forest/10 pt-4">
              <span className="font-medium text-ink">ยอดรวม</span>
              <span className="text-lg font-semibold text-forestDark">
                {cartTotal.toFixed(0)} บาท
              </span>
            </div>

            <button
              className="mt-4 w-full rounded-full bg-turmeric py-3 font-medium text-white transition hover:bg-turmericDark"
              onClick={() => alert("ขั้นตอนถัดไป: เชื่อมกับหน้ายืนยันออเดอร์")}
            >
              สั่งซื้อ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

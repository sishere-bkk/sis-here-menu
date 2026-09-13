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

// รหัสลับสำหรับดูเมนูตอนร้านปิด (ใส่ ?preview=รหัสนี้ ต่อท้ายลิงก์) — ใช้ทดสอบเองเท่านั้น
const PREVIEW_KEY = "sishere2026";

// รูปไอคอนของแต่ละหมวดหมู่ใน sidebar — ถ้าหมวดไหนไม่มีรูปใน list นี้ จะไม่โชว์รูป (ไม่พัง)
const CATEGORY_IMAGES: Record<string, string> = {
  "อาหารเช้า": "/categories/breakfast.jpg",
  "สปาเก็ตตี้": "/categories/spaghetti.jpg",
  "อาหารจานเดียว": "/categories/rice.jpg",
  "ข้าว": "/categories/rice.jpg",
  "ข้าวผัด": "/categories/fried-rice.jpg",
  "สลัด และของทานเล่น": "/categories/salad.jpg",
  "สลัดและของทานเล่น": "/categories/salad.jpg"
};

function categoryRank(category: string) {
  const normalized = category.normalize("NFC").trim();
  const index = CATEGORY_ORDER.findIndex(
    (c) => c.normalize("NFC").trim() === normalized
  );
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function categoryImage(category: string) {
  const normalized = category.normalize("NFC").trim();
  return

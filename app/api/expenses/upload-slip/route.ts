import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// หมวดที่ร้านใช้ ต้องตรงกับที่ใช้ในหน้า ExpenseTab.tsx เป๊ะๆ
const CATEGORIES = ["วัตถุดิบ", "ค่าแรง", "ค่าแก๊ส", "ค่าบรรจุภัณฑ์", "ค่าซ่อมอุปกรณ์", "ค่าเดินทาง", "ส่วนตัว", "อื่นๆ"];

// ถ้าอยากเปลี่ยนโมเดลอ่านสลิป ให้ตั้งค่า SLIP_MODEL ใน Vercel (ไม่ตั้งก็ใช้ Haiku เหมือนเดิม)
const MODEL = process.env.SLIP_MODEL || "claude-haiku-4-5-20251001";

// ---------- ช่วยเรื่องวันที่ (เวลาไทยเสมอ) ----------
function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

function ymdToUtc(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// a - b เป็นจำนวนวัน
function diffDays(a: string, b: string): number {
  return Math.round((ymdToUtc(a) - ymdToUtc(b)) / 86400000);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// เดือนไทย (ตัดจุด/ช่องว่างออกก่อนเทียบ) + เดือนอังกฤษ
const MONTHS: Record<string, number> = {
  "มค": 1, "มกราคม": 1, "jan": 1, "january": 1,
  "กพ": 2, "กุมภาพันธ์": 2, "feb": 2, "february": 2,
  "มีค": 3, "มีนาคม": 3, "mar": 3, "march": 3,
  "เมย": 4, "เมษายน": 4, "apr": 4, "april": 4,
  "พค": 5, "พฤษภาคม": 5, "may": 5,
  "มิย": 6, "มิถุนายน": 6, "jun": 6, "june": 6,
  "กค": 7, "กรกฎาคม": 7, "jul": 7, "july": 7,
  "สค": 8, "สิงหาคม": 8, "aug": 8, "august": 8,
  "กย": 9, "กันยายน": 9, "sep": 9, "sept": 9, "september": 9,
  "ตค": 10, "ตุลาคม": 10, "oct": 10, "october": 10,
  "พย": 11, "พฤศจิกายน": 11, "nov": 11, "november": 11,
  "ธค": 12, "ธันวาคม": 12, "dec": 12, "december": 12,
};

function parseMonth(text: unknown): number | null {
  if (typeof text === "number" && text >= 1 && text <= 12) return text;
  if (typeof text !== "string") return null;
  const key = text.toLowerCase().replace(/[\s.]/g, "");
  if (MONTHS[key]) return MONTHS[key];
  const n = Number(key);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return null;
}

// ปีบนสลิปอาจเป็น พ.ศ. 4 หลัก (2569), พ.ศ. 2 หลัก (69), หรือ ค.ศ. (2026 / 26)
function parseYear(text: unknown, currentYear: number): number | null {
  const n = Number(String(text ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 2400) return n - 543;
  if (n >= 1900) return n;
  if (n < 100) {
    const ce = 2000 + n;
    const be = 1957 + n;
    return Math.abs(ce - currentYear) <= Math.abs(be - currentYear) ? ce : be;
  }
  return null;
}

// หาวันที่ล่าสุด (ไม่เกินวันนี้) ที่ตรงกับ "เลขวัน" ที่อ่านได้ ใช้เมื่อเดือน/ปีที่อ่านได้ดูผิดปกติ
function recoverFromDay(day: number, today: string): string | null {
  let [y, m] = today.split("-").map(Number);
  for (let i = 0; i < 14; i++) {
    if (isRealDate(y, m, day)) {
      const cand = `${y}-${pad(m)}-${pad(day)}`;
      if (cand <= today) return cand;
    }
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return null;
}

// สลิปส่วนใหญ่เป็นของไม่กี่วันที่ผ่านมา ถ้าวันที่ที่อ่านได้เก่ากว่านี้ถือว่าน่าสงสัย
const TRUST_WITHIN_DAYS = 14;

function resolveDate(
  parsed: { day?: unknown; monthText?: unknown; yearText?: unknown },
  today: string
): { date: string; warning: string | null } {
  const currentYear = Number(today.slice(0, 4));
  const day = Number(parsed.day);
  const dayOk = Number.isInteger(day) && day >= 1 && day <= 31;
  const month = parseMonth(parsed.monthText);
  const year = parseYear(parsed.yearText, currentYear);

  let direct: string | null = null;
  if (dayOk && month && year && isRealDate(year, month, day)) {
    direct = `${year}-${pad(month)}-${pad(day)}`;
  }

  // อ่านครบ + ไม่ใช่อนาคต + ไม่เก่าเกินไป → เชื่อตามที่อ่านได้
  if (direct && direct <= today && diffDays(today, direct) <= TRUST_WITHIN_DAYS) {
    return { date: direct, warning: null };
  }

  // ผิดปกติ (อนาคต / เก่าผิดสังเกต / อ่านไม่ครบ) → ใช้เลขวันที่อ่านได้ แล้วเดาเป็นเดือนล่าสุดที่เป็นไปได้
  if (dayOk) {
    const recovered = recoverFromDay(day, today);
    if (recovered) {
      if (direct && direct === recovered) return { date: direct, warning: null };
      const readAs = direct ? `อ่านได้ ${direct}` : "อ่านเดือน/ปีไม่ชัด";
      return {
        date: recovered,
        warning: `${readAs} ดูไม่น่าใช่ ระบบเดาเป็น ${recovered} (เลขวันที่ ${day}) — ถ้าไม่ตรงกับสลิปให้แก้วันที่ด้านล่าง`,
      };
    }
  }

  return { date: today, warning: "อ่านวันที่จากสลิปไม่ได้ ใส่เป็นวันนี้ไว้ให้ — ตรวจวันที่ก่อนกดบันทึกนะครับ" };
}

// ---------- ทำความสะอาดหมายเหตุ ----------
// ข้อความปุ่ม/เมนูของแอปธนาคาร ที่ไม่ใช่หมายเหตุของเรา
const UI_LABELS =
  /สแ+ก?น|ตรวจสอบ|สลิป|ช่วยจำ|ชวยจำ|บันทึก|สำนักช|สำนักต[รว]|สำนวน|แชร์|เสร็จสมบูรณ์|ค่าธรรมเนียม|รหัสอ้างอิง|เลขที่รายการ|รหัสอ้างอิง/;

function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let note = raw.replace(/\s+/g, " ").trim();
  if (!note) return null;

  // "สวนตัว" "สำนักตัว" "ส่วนตัว" ฯลฯ ที่อ่านเพี้ยน → ส่วนตัว
  if (/^ส\S{0,6}ตัว$/.test(note)) return "ส่วนตัว";

  // ข้อความของแอป ไม่ใช่หมายเหตุ
  if (UI_LABELS.test(note)) return null;

  // แก้คำที่อ่านเพี้ยนบ่อยๆ
  note = note
    .replace(/ว[ัิ]?ต[ถฤ][ุู]?ด[ิี][บป]/g, "วัตถุดิบ")
    .replace(/ค่า?ด[ิี]นทาง/g, "ค่าเดินทาง")
    .replace(/แก[็๊]?ส/g, "แก๊ส")
    .replace(/หม[ุู]ท?ง?คัตส[ิึ]/g, "หมูทงคัตสึ");

  return note || null;
}

// เดาหมวดจากหมายเหตุ เมื่อ AI ไม่ได้ตอบหมวดมา (ถ้าเดาไม่ได้ ปล่อยว่าง ให้คนเลือกเอง)
function guessCategory(note: string | null): string | null {
  if (!note) return null;
  if (/ส่วนตัว/.test(note)) return "ส่วนตัว";
  if (/ผัก|หมู|ไก่|ไข่|เนื้อ|ปลา|กุ้ง|ของสด|วัตถุดิบ/.test(note)) return "วัตถุดิบ";
  if (/เงินเดือน|ค่าแรง|พนักงาน/.test(note)) return "ค่าแรง";
  if (/แก๊ส/.test(note)) return "ค่าแก๊ส";
  if (/กล่อง|ถุง|บรรจุ|แก้ว/.test(note)) return "ค่าบรรจุภัณฑ์";
  if (/ซ่อม|ผ่อน|อุปกรณ์/.test(note)) return "ค่าซ่อมอุปกรณ์";
  if (/น้ำมัน|เดินทาง|ค่ารถ|ทางด่วน/.test(note)) return "ค่าเดินทาง";
  return null;
}

type AiResult = {
  amount?: number | string | null;
  day?: number | string | null;
  monthText?: string | null;
  yearText?: string | number | null;
  note?: string | null;
  suggestedCategory?: string | null;
};

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "ไม่มีรูปส่งมา" }, { status: 400 });
    }

    // 1) เก็บรูปไว้เป็นหลักฐานใน Supabase Storage
    const fileName = `slip-${Date.now()}.jpg`;
    const buffer = Buffer.from(imageBase64, "base64");
    const { error: uploadError } = await supabase.storage
      .from("expense-slips")
      .upload(fileName, buffer, { contentType: mimeType || "image/jpeg" });

    if (uploadError) {
      return NextResponse.json({ error: "อัปโหลดรูปไม่สำเร็จ: " + uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("expense-slips").getPublicUrl(fileName);
    const slipImageUrl = publicUrlData.publicUrl;

    // 2) ให้ Claude อ่านสลิป
    const today = todayBangkok();
    const prompt = `นี่คือรูปสลิปโอนเงินจากแอปธนาคารไทย (วันนี้คือ ${today}) ช่วยอ่านทั้งรูป รวมตัวหนังสือเล็กๆ ด้านล่างด้วย แล้วตอบเป็น JSON อย่างเดียว ห้ามมีข้อความอื่น รูปแบบนี้:
{
  "amount": ตัวเลขยอดเงินที่โอน (number),
  "day": เลขวันที่ของวันที่โอน (number 1-31) อ่านจากวันที่/เวลาที่ทำรายการบนสลิป,
  "monthText": "ชื่อเดือนตามที่พิมพ์อยู่บนสลิปเป๊ะๆ เช่น ต.ค. หรือ ตุลาคม ห้ามแปลงเป็นเลข ถ้าอ่านไม่ได้ให้เป็น null",
  "yearText": "ปีตามที่พิมพ์อยู่บนสลิปเป๊ะๆ เช่น 69 หรือ 2569 ห้ามแปลงปี ถ้าอ่านไม่ได้ให้เป็น null",
  "note": "ข้อความที่คนโอนพิมพ์เองในช่องบันทึกช่วยจำ/หมายเหตุ (มักอยู่ล่างๆ ของสลิป) ถ้าไม่มีให้เป็น null",
  "suggestedCategory": "เลือก 1 หมวดจากลิสต์นี้: ${CATEGORIES.join(", ")} — ตีความจากหมายเหตุแบบยืดหยุ่น เช่น 'ซื้อผัก' 'ของสด' → วัตถุดิบ, 'ส่วนตัว' → ส่วนตัว, 'น้ำมัน' → ค่าเดินทาง ถ้าไม่มีหมายเหตุหรือเดาไม่ได้จริงๆ ให้เป็น null (ห้ามเดามั่ว)"
}
กติกาสำคัญ:
- "note" ต้องเป็นสิ่งที่คนพิมพ์เองเท่านั้น ห้ามเอาข้อความของแอป เช่น "สแกนตรวจสอบสลิป", "บันทึกช่วยจำ", "แชร์", "บันทึกภาพ", "ค่าธรรมเนียม", "รหัสอ้างอิง" มาใส่
- ถ้าหมายเหตุพิมพ์ผิดหรืออ่านยาก ให้แก้เป็นคำที่ถูกต้อง เช่น สวนตัว → ส่วนตัว, วตถุดิบ → วัตถุดิบ, แกส → แก๊ส, ค่าดินทาง → ค่าเดินทาง
- ชื่อบุคคลหรือร้านที่รับโอนไม่ใช่หมายเหตุ ห้ามเอามาใส่ใน note`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) {
      const reason = aiData?.error?.message ?? "AI ไม่ตอบกลับ";
      return NextResponse.json({ error: "AI อ่านสลิปไม่สำเร็จ: " + reason }, { status: 502 });
    }

    const rawText: string = aiData?.content?.[0]?.text ?? "{}";
    let parsed: AiResult = {};
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }

    const { date, warning } = resolveDate(parsed, today);
    const note = cleanNote(parsed.note);

    // หมวด: ถ้าหมายเหตุคือ "ส่วนตัว" ให้เป็นส่วนตัวเสมอ ไม่งั้นใช้ที่ AI เดา ถ้าไม่ได้ลองเดาจากคำในหมายเหตุ ถ้ายังไม่ได้ปล่อยว่าง
    let category: string | null = null;
    if (note === "ส่วนตัว") {
      category = "ส่วนตัว";
    } else if (CATEGORIES.includes(parsed.suggestedCategory ?? "")) {
      category = parsed.suggestedCategory as string;
    } else {
      category = guessCategory(note);
    }

    const amountNum = Number(parsed.amount);

    return NextResponse.json({
      amount: Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null,
      date,
      dateWarning: warning,
      note,
      suggestedCategory: category,
      slipImageUrl,
    });
  } catch {
    return NextResponse.json({ error: "อ่านสลิปไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

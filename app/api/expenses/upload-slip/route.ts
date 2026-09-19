import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ห้าม Next.js แคชผลลัพธ์ของ route นี้ไว้ ต้องประมวลผลใหม่ทุกครั้งที่เรียก
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// หมวดที่ร้านใช้ ต้องตรงกับที่ใช้ในหน้า ExpenseTab.tsx
const CATEGORIES = ["วัตถุดิบ", "ค่าแรง", "ค่าแก๊ส", "ค่าบรรจุภัณฑ์", "ค่าซ่อมอุปกรณ์", "ค่าเดินทาง", "ส่วนตัว", "อื่นๆ"];

function todayBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "ไม่มีรูปส่งมา" }, { status: 400 });
    }

    // 1) อัปโหลดรูปขึ้น Supabase Storage เก็บไว้เป็นหลักฐาน
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

    // 2) ส่งรูปให้ Claude อ่าน ดึงยอดเงิน + วันที่ + หมายเหตุที่พิมพ์ตอนโอน + เดาหมวดจากหมายเหตุแบบยืดหยุ่น
    const prompt = `นี่คือรูปสลิปโอนเงินจากแอปธนาคารไทย ช่วยอ่านแล้วตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นเลย รูปแบบนี้:
{
  "amount": ตัวเลขยอดเงินที่โอน (number),
  "date": "วันที่บนสลิป แปลงเป็นรูปแบบ YYYY-MM-DD (ปี ค.ศ.) ถ้าสลิปเป็นปี พ.ศ. ให้ลบ 543 ก่อนแปลง ถ้าอ่านวันที่ไม่ได้เลยให้เป็น null",
  "note": "ข้อความในช่องหมายเหตุ/บันทึกช่วยจำ ถ้ามี ถ้าไม่มีให้เป็น null",
  "suggestedCategory": "เลือก 1 หมวดจากลิสต์นี้ที่ใกล้เคียงกับหมายเหตุที่สุด: ${CATEGORIES.join(", ")} — ไม่ต้องให้หมายเหตุตรงกับชื่อหมวดเป๊ะๆ ให้ตีความแบบยืดหยุ่น เช่น 'ซื้อผัก', 'ตลาดนัด', 'ของสด' ให้เดาเป็นวัตถุดิบ, 'เติมแก๊สหุงต้ม' ให้เดาเป็นค่าแก๊ส, 'ถุง กล่องข้าว' ให้เดาเป็นค่าบรรจุภัณฑ์ เป็นต้น ถ้าหมายเหตุไม่มีเลยหรือไม่มีทางเดาได้เลยจริงๆ ให้เป็น null"
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
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
    const rawText = aiData?.content?.[0]?.text ?? "{}";
    let parsed: { amount?: number; date?: string | null; note?: string | null; suggestedCategory?: string | null } = {};
    try {
      // เผื่อ AI ตอบมาพร้อม ```json ครอบ ตัดออกก่อน parse
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }

    // เช็ครูปแบบวันที่คร่าวๆ (YYYY-MM-DD) ถ้า AI ตอบมาแปลกๆ ให้ fallback เป็นวันนี้แทน ไม่ให้พังทั้งฟอร์ม
    const dateIsValid = typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date);

    return NextResponse.json({
      amount: parsed.amount ?? null,
      date: dateIsValid ? parsed.date : todayBangkok(),
      note: parsed.note ?? null,
      suggestedCategory: CATEGORIES.includes(parsed.suggestedCategory ?? "") ? parsed.suggestedCategory : null,
      slipImageUrl,
    });
  } catch (err) {
    return NextResponse.json({ error: "อ่านสลิปไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

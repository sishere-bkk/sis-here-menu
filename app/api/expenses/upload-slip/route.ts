import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// หมวดที่ร้านใช้ ต้องตรงกับที่ใช้ในหน้า ExpenseTab.tsx
const CATEGORIES = ["วัตถุดิบ", "ค่าแรง", "ค่าแก๊ส", "ค่าบรรจุภัณฑ์", "ค่าซ่อมอุปกรณ์", "ค่าเดินทาง", "ส่วนตัว", "อื่นๆ"];

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

    // 2) ส่งรูปให้ Claude อ่าน ดึงยอดเงิน + หมายเหตุที่พิมพ์ตอนโอน + เดาหมวดจากหมายเหตุ
    const prompt = `นี่คือรูปสลิปโอนเงินจากแอปธนาคารไทย ช่วยอ่านแล้วตอบกลับเป็น JSON เท่านั้น ห้ามมีข้อความอื่นเลย รูปแบบนี้:
{"amount": ตัวเลขยอดเงินที่โอน (number), "note": "ข้อความในช่องหมายเหตุ/บันทึกช่วยจำ ถ้ามี ถ้าไม่มีให้เป็น null", "suggestedCategory": "เลือก 1 หมวดจากลิสต์นี้ที่ใกล้เคียงกับหมายเหตุที่สุด: ${CATEGORIES.join(", ")} ถ้าเดาไม่ได้ให้เป็น null"}`;

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
    let parsed: { amount?: number; note?: string | null; suggestedCategory?: string | null } = {};
    try {
      // เผื่อ AI ตอบมาพร้อม ```json ครอบ ตัดออกก่อน parse
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {};
    }

    return NextResponse.json({
      amount: parsed.amount ?? null,
      note: parsed.note ?? null,
      suggestedCategory: CATEGORIES.includes(parsed.suggestedCategory ?? "") ? parsed.suggestedCategory : null,
      slipImageUrl,
    });
  } catch (err) {
    return NextResponse.json({ error: "อ่านสลิปไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ใช้ service role key เพราะต้องเขียนไฟล์เข้า storage และแก้ตาราง menu
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const menuId = formData.get("menuId") as string;

    if (!file || !menuId) {
      return NextResponse.json({ error: "missing file or menuId" }, { status: 400 });
    }

    const fileName = `${menuId}-${Date.now()}.jpg`;
    const arrayBuffer = await file.arrayBuffer();

    // อัปโหลดไฟล์เข้า bucket menu-images
    const { error: uploadError } = await supabaseAdmin.storage
      .from("menu-images")
      .upload(fileName, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // ดึงลิงก์สาธารณะของรูปที่เพิ่งอัปโหลด
    const { data: urlData } = supabaseAdmin.storage
      .from("menu-images")
      .getPublicUrl(fileName);

    // อัปเดตลิงก์รูปในตาราง menu
    const { error: updateError } = await supabaseAdmin
      .from("menu")
      .update({ image_url: urlData.publicUrl })
      .eq("id", menuId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err) {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

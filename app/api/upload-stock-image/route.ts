import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const stockId = formData.get("stockId") as string;

    if (!file || !stockId) {
      return NextResponse.json({ error: "missing file or stockId" }, { status: 400 });
    }

    const fileName = `${stockId}-${Date.now()}.jpg`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from("stock-images")
      .upload(fileName, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("stock-images")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabaseAdmin
      .from("stock_items")
      .update({ photo_url: urlData.publicUrl })
      .eq("id", stockId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err) {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

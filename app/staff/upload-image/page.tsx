"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type MenuItem = {
  id: string;
  name: string;
  image_url: string | null;
};

export default function UploadImagePage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  // โหลดรายการเมนูทั้งหมดมาให้เลือก
  useEffect(() => {
    supabase
      .from("menu")
      .select("id,name,image_url")
      .order("name")
      .then(({ data }) => {
        if (data) setItems(data as MenuItem[]);
      });
  }, []);

  // ย่อขนาดรูปในเครื่องก่อนส่งขึ้นเซิร์ฟเวอร์ ให้ไฟล์เล็กลงและโหลดเว็บเร็วขึ้น
  function resizeImage(file: File, maxWidth = 900): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("resize failed"))),
            "image/jpeg",
            0.8
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) {
      setMessage("กรุณาเลือกเมนูก่อนเลือกรูป");
      return;
    }

    setStatus("uploading");
    setMessage("");

    try {
      const resizedBlob = await resizeImage(file);
      setPreview(URL.createObjectURL(resizedBlob));

      const formData = new FormData();
      formData.append("file", resizedBlob, `${selectedId}.jpg`);
      formData.append("menuId", selectedId);

      const res = await fetch("/api/upload-menu-image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("upload failed");

      setStatus("done");
      setMessage("อัปโหลดรูปสำเร็จแล้ว");
    } catch (err) {
      setStatus("error");
      setMessage("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>อัปโหลดรูปเมนู</h1>

      <label style={{ display: "block", marginBottom: 8 }}>เลือกเมนู</label>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 16 }}
      >
        <option value="">-- เลือกเมนู --</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} {item.image_url ? "(มีรูปแล้ว)" : "(ยังไม่มีรูป)"}
          </option>
        ))}
      </select>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={!selectedId || status === "uploading"}
        style={{ marginBottom: 16 }}
      />

      {preview && (
        <img
          src={preview}
          alt="preview"
          style={{ width: "100%", borderRadius: 8, marginBottom: 16 }}
        />
      )}

      {status === "uploading" && <p>กำลังอัปโหลด...</p>}
      {message && <p>{message}</p>}
    </div>
  );
}

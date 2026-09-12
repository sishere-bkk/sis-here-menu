"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  label: string;
  hasPhoto: boolean;
};

type MenuImageField = "image_url" | "delivery_image_url";

export default function UploadImageTab() {
  const [target, setTarget] = useState<"menu" | "stock">("menu");
  // เฉพาะตอน target === "menu": เลือกว่าจะอัปโหลดรูปให้เมนูออนไลน์ หรือรูปสำหรับหน้าคีย์ออเดอร์ Grab/LINE MAN (แยกกันคนละรูป)
  const [menuImageField, setMenuImageField] = useState<MenuImageField>("image_url");
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSelectedId("");
    setPreview(null);
    setMessage("");

    if (target === "menu") {
      const hasPhotoColumn = menuImageField; // "image_url" | "delivery_image_url"
      supabase
        .from("menu")
        .select(`id,name,delivery_name,${hasPhotoColumn}`)
        .order("name")
        .then(({ data }) => {
          if (data) {
            setItems(
              data.map((d: any) => ({
                id: d.id,
                // ถ้ากำลังอัปรูปฝั่ง Grab/LINE MAN ใช้ชื่อ delivery_name แสดงถ้ามี จะได้แยกแยะง่ายขึ้น
                label:
                  menuImageField === "delivery_image_url"
                    ? d.delivery_name || d.name
                    : d.name,
                hasPhoto: !!d[hasPhotoColumn]
              }))
            );
          }
        });
    } else {
      fetch("/api/upload-stock-image")
        .then((res) => res.json())
        .then((json) => {
          if (json.items) {
            setItems(
              json.items.map((d: any) => ({
                id: d.id,
                label: `[${d.category}] ${d.name}`,
                hasPhoto: !!d.photo_url,
              }))
            );
          }
        });
    }
  }, [target, menuImageField]);

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
      setMessage("กรุณาเลือกรายการก่อนเลือกรูป");
      return;
    }

    setStatus("uploading");
    setMessage("");

    try {
      const resizedBlob = await resizeImage(file);
      setPreview(URL.createObjectURL(resizedBlob));

      const formData = new FormData();
      formData.append("file", resizedBlob, `${selectedId}.jpg`);

      const endpoint = target === "menu" ? "/api/upload-menu-image" : "/api/upload-stock-image";
      formData.append(target === "menu" ? "menuId" : "stockId", selectedId);
      // บอก API ว่าจะอัปเดตคอลัมน์ไหน (เฉพาะกรณีเมนู) — ไม่ส่ง = ใช้ image_url ปกติ (เมนูออนไลน์)
      if (target === "menu") {
        formData.append("imageField", menuImageField);
      }

      const res = await fetch(endpoint, { method: "POST", body: formData });
      if (!res.ok) throw new Error("upload failed");

      setStatus("done");
      setMessage("อัปโหลดรูปสำเร็จแล้ว");
      setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, hasPhoto: true } : it)));
    } catch (err) {
      setStatus("error");
      setMessage("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  async function handleDelete() {
    if (!selectedId) return;
    const params = new URLSearchParams({ id: selectedId });
    if (target === "menu") params.set("imageField", menuImageField);
    const endpoint =
      target === "menu"
        ? `/api/upload-menu-image?${params.toString()}`
        : `/api/upload-stock-image?${params.toString()}`;

    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) {
      setMessage("ลบรูปแล้ว");
      setPreview(null);
      setItems((prev) => prev.map((it) => (it.id === selectedId ? { ...it, hasPhoto: false } : it)));
    } else {
      setMessage("ลบไม่สำเร็จ");
    }
  }

  const selectedItem = items.find((i) => i.id === selectedId);

  return (
    <div className="max-w-md">
      <div style={{ display: "flex", width: "100%", gap: 8, borderRadius: 20, backgroundColor: "#E8792F1A", padding: 4, marginBottom: 16 }}>
        <button
          onClick={() => setTarget("menu")}
          style={{
            flex: 1, borderRadius: 14, padding: "18px 20px", fontSize: 17, fontWeight: 800, border: "none",
            backgroundColor: target === "menu" ? "#E8792F" : "transparent",
            color: target === "menu" ? "#FCEFC0" : "#B85A1F99"
          }}
        >
          เมนู
        </button>
        <button
          onClick={() => setTarget("stock")}
          style={{
            flex: 1, borderRadius: 14, padding: "18px 20px", fontSize: 17, fontWeight: 800, border: "none",
            backgroundColor: target === "stock" ? "#E8792F" : "transparent",
            color: target === "stock" ? "#FCEFC0" : "#B85A1F99"
          }}
        >
          สต๊อก
        </button>
      </div>

      {target === "menu" && (
        <div className="mb-4">
          <label className="mb-2 block text-sm text-ink/60">อัปโหลดรูปให้</label>
          <div className="inline-flex rounded-2xl bg-forest/10 p-1">
            <button
              onClick={() => setMenuImageField("image_url")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                menuImageField === "image_url" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
              }`}
            >
              เมนูออนไลน์
            </button>
            <button
              onClick={() => setMenuImageField("delivery_image_url")}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                menuImageField === "delivery_image_url" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
              }`}
            >
              Grab / LINE MAN
            </button>
          </div>
          <p className="mt-1 text-xs text-ink/40">
            รูป 2 ฝั่งนี้แยกกันคนละไฟล์ ไม่ใช้ร่วมกัน
          </p>
        </div>
      )}

      <label className="mb-2 block text-sm text-ink/60">เลือกรายการ</label>
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="mb-4 w-full rounded-xl border border-forest/15 p-2.5"
      >
        <option value="">-- เลือกรายการ --</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} {item.hasPhoto ? "(มีรูปแล้ว)" : "(ยังไม่มีรูป)"}
          </option>
        ))}
      </select>

      {/* เอา capture="environment" ออก เพื่อให้ iPhone ขึ้นเมนูให้เลือกได้ ไม่บังคับเข้ากล้อง */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={!selectedId || status === "uploading"}
        className="mb-3 block"
      />

      {selectedItem?.hasPhoto && (
        <button
          onClick={handleDelete}
          style={{
            display: "inline-block",
            marginBottom: 16,
            padding: "8px 16px",
            background: "#c0392b",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ลบรูปนี้
        </button>
      )}

      {preview && <img src={preview} alt="preview" className="mb-4 w-full rounded-xl" />}

      {status === "uploading" && <p className="text-ink/60">กำลังอัปโหลด...</p>}
      {message && <p className="text-ink/60">{message}</p>}
    </div>
  );
}

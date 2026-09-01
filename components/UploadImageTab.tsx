"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  label: string;
  hasPhoto: boolean;
};

export default function UploadImageTab() {
  const [target, setTarget] = useState<"menu" | "stock">("menu");
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
      supabase
        .from("menu")
        .select("id,name,image_url")
        .order("name")
        .then(({ data }) => {
          if (data) {
            setItems(data.map((d) => ({ id: d.id, label: d.name, hasPhoto: !!d.image_url })));
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
  }, [target]);

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
    const endpoint =
      target === "menu"
        ? `/api/upload-menu-image?id=${selectedId}`
        : `/api/upload-stock-image?id=${selectedId}`;

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
      <div className="mb-4 inline-flex rounded-2xl bg-forest/10 p-1">
        <button
          onClick={() => setTarget("menu")}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors ${
            target === "menu" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
          }`}
        >
          เมนู
        </button>
        <button
          onClick={() => setTarget("stock")}
          className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors ${
            target === "stock" ? "bg-forest text-sand shadow-sm" : "text-forestDark/60"
          }`}
        >
          สต๊อก
        </button>
      </div>

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

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        disabled={!selectedId || status === "uploading"}
        className="mb-3 block"
      />

      {selectedItem?.hasPhoto && (
        <button
          onClick={handleDelete}
          className="mb-4 rounded-xl bg-red-600 px-4 py-2 text-sm text-white"
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

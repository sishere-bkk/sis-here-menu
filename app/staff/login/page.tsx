"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!pin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PIN ไม่ถูกต้อง");
        return;
      }
      router.push("/staff");
      router.refresh();
    } catch (err) {
      setError("เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้งครับ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-6">
      <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-sm">
        <h1 className="mb-1 font-display text-xl font-semibold text-forestDark">
          SiS HERE
        </h1>
        <p className="mb-6 text-sm text-ink/60">ใส่ PIN พนักงานเพื่อเข้าใช้งาน</p>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="PIN"
          className="mb-3 w-full rounded-xl border border-forest/15 px-3 py-3 text-center text-lg tracking-widest"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          disabled={loading || !pin}
          onClick={handleLogin}
          className="w-full rounded-full bg-forest py-3 font-medium text-sand disabled:opacity-40"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </div>
    </main>
  );
}

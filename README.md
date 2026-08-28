# SiS HERE — เว็บเมนูออนไลน์ (เวอร์ชันเริ่มต้น)

โปรเจกต์นี้คือหน้าดูเมนู + ตะกร้าสินค้า เชื่อมกับตาราง `menu` ใน Supabase
ยังไม่มี QR โต๊ะ/กลับบ้าน, แจ้งเตือน LINE/Discord, หรือพิมพ์บิล — จะเพิ่มทีหลังทีละสเต็ป

## สิ่งที่ต้องมีก่อน

- บัญชี GitHub, Vercel, Supabase (สมัครแล้ว)
- ตาราง `menu` ใน Supabase ที่มีคอลัมน์: name, price, category, image_url, available

## ขั้นตอนอัปโหลดขึ้น GitHub (ไม่ต้องใช้ git บนเครื่อง)

1. เข้า github.com → กด **New repository** → ตั้งชื่อ เช่น `sis-here-menu` → กด Create repository
2. ในหน้า repo ที่เพิ่งสร้าง กด **uploading an existing file**
3. **ลากทั้งโฟลเดอร์นี้** (ทุกไฟล์ที่แตกไฟล์ zip ออกมา) วางลงในหน้าเว็บ
4. เลื่อนลงมากด **Commit changes**

## ขั้นตอนเชื่อม Vercel

1. เข้า vercel.com → กด **Add New Project**
2. เลือก repo `sis-here-menu` ที่เพิ่งอัปโหลด
3. ก่อนกด Deploy ให้เปิด **Environment Variables** แล้วใส่ 2 ค่า (หาได้จาก Supabase → Project Settings → API):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. กด **Deploy** รอสักครู่ จะได้ลิงก์เว็บ เช่น `sis-here-menu.vercel.app`

## ทดสอบก่อน deploy จริง (ถ้าอยากลองบนเครื่องตัวเอง)

ต้องติดตั้ง Node.js ก่อน แล้วรันในโฟลเดอร์นี้:

```
npm install
cp .env.local.example .env.local   # แล้วแก้ค่าในไฟล์ .env.local ให้เป็นของจริง
npm run dev
```

เปิด http://localhost:3000

## ขั้นตอนถัดไป (ยังไม่ได้ทำในเวอร์ชันนี้)

- แยกหน้าเว็บตาม QR โต๊ะ / QR กลับบ้าน (`?table=5`, `?type=takeaway`)
- หน้ากรอกชื่อ+เบอร์สำหรับลูกค้ากลับบ้าน
- บันทึกออเดอร์ลงตาราง `orders`
- ยิงแจ้งเตือนเข้า Discord Webhook และ LINE Messaging API
- หน้าพนักงานสำหรับพิมพ์บิลลงเครื่องพิมพ์ thermal


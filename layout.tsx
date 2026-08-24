import "./globals.css";

export const metadata = {
  title: "SiS HERE | เมนูออนไลน์",
  description: "สั่งอาหารออนไลน์จาก SiS HERE"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

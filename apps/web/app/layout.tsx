import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "President Sim — เกมนั่งเก้าอี้ผู้นำ",
  description: "เกมการศึกษา: นำประเทศหนึ่งวาระ 16 ไตรมาส ตัดสินใจจากหลักฐาน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

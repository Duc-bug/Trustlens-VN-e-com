import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrustLens VN | Soi review ảo & phát hiện seeding trên sàn TMĐT",
  description:
    "Hệ thống phân tích độ tin cậy sản phẩm, phát hiện bình luận seeding, buff đơn theo khung giờ và spam cày xu trên Shopee.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className="min-h-screen bg-bgpage font-sans text-gray-900">
        {children}
      </body>
    </html>
  );
}

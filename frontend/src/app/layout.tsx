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
  title: "TrustLens VN | Kiểm tra đánh giá sản phẩm TMĐT",
  description:
    "Hệ thống tổng hợp và phân tích chất lượng đánh giá sản phẩm trên sàn thương mại điện tử.",
};

const EXTENSION_ERROR_GUARD = `
(function () {
  if (typeof window === "undefined") return;
  function isExtensionError(msg, stack, filename) {
    var s = String(msg || "") + " " + String(stack || "") + " " + String(filename || "");
    return (
      s.indexOf("chrome-extension://") !== -1 ||
      s.indexOf("moz-extension://") !== -1 ||
      s.indexOf("M_ID") !== -1 ||
      s.indexOf("eppiocemhmnlbhjplcgkofciiegomcon") !== -1
    );
  }
  window.addEventListener(
    "error",
    function (event) {
      var err = event && event.error;
      if (
        isExtensionError(
          event && event.message,
          err && err.stack,
          event && event.filename
        )
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
      }
    },
    true
  );
  window.addEventListener(
    "unhandledrejection",
    function (event) {
      var reason = event && event.reason;
      if (
        isExtensionError(
          reason && reason.message,
          reason && reason.stack,
          ""
        )
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return false;
      }
    },
    true
  );
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={beVietnamPro.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: EXTENSION_ERROR_GUARD }}
        />
      </head>
      <body
        className="min-h-screen bg-bgpage font-sans text-gray-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

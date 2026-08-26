import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { AudienceProvider } from "@/providers/audience-provider";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "JoyMaaS 文档",
  description: "JoyMaaS 模型即服务平台官方文档",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="font-sans min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AudienceProvider>
            <Navbar />
            {children}
          </AudienceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

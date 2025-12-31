import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/components/theme-provider";
import { PWAProvider } from "@/components/pwa";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "InfoLokerJombang - Info Loker Jombang #1",
  description:
    "Platform info lowongan kerja terlengkap di Jombang. Cari kerja? Kami bantu!",
  keywords: ["loker", "jombang", "lowongan kerja", "info loker jombang"],
  openGraph: {
    title: "InfoLokerJombang",
    description: "Info Loker Jombang #1 - Cari kerja? Kami bantu!",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ILJ Hub",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PWAProvider>
            {children}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                },
                success: {
                  iconTheme: {
                    primary: "var(--success)",
                    secondary: "white",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "var(--error)",
                    secondary: "white",
                  },
                },
              }}
            />
          </PWAProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

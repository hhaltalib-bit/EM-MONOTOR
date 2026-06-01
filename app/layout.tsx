import type { Metadata } from "next";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import "./globals.css";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";

export const metadata: Metadata = {
  title: "EM MONITOR",
  description: "Enterprise Database Monitoring System",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

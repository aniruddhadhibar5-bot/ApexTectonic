import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyperion Core | Review Console",
  description: "Bilingual, review-only seismic telemetry visualization scaffold.",
  manifest: "/manifest.webmanifest",
  applicationName: "Hyperion Core",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Hyperion Core",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#07111b",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}

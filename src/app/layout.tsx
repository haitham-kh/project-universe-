import type { Metadata, Viewport } from "next";
// import { Inter } from "next/font/google";
// import "./globals.css";

// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-inter",
//   display: "swap",
// });
import "./globals.css";

export const metadata: Metadata = {
  title: "PROJECT UNIVERSE — A Cinematic 3D Experience",
  description: "A cinematic 3D space exploration experience built with Next.js and React Three Fiber. Features continuous procedural travel from Earth to the outer planets with high-fidelity lighting and atmospheric effects.",
  openGraph: {
    title: "PROJECT UNIVERSE — A Cinematic 3D Experience",
    description: "Explore the cosmos — a cinematic, real-time 3D space experience built with Next.js, React Three Fiber, and WebGL.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PROJECT UNIVERSE — A Cinematic 3D Experience",
    description: "Explore the cosmos — a cinematic, real-time 3D space experience.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a12",
};

import { BandwidthMonitor } from "@/components/BandwidthMonitor";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <BandwidthMonitor />
        {children}
      </body>
    </html>
  );
}

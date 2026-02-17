import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
  themeColor: "#0a0a12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}

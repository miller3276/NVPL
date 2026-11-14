
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nvpl.vercel.app"),

  title: "NVPL | National Virtual Pro League",
  description:
    "Compete. Connect. Dominate. The National Virtual Pro League — home of competitive Pro Clubs leagues, rankings and tournaments.",

  openGraph: {
    title: "NVPL | National Virtual Pro League",
    description: "Compete. Connect. Dominate.",
    siteName: "NVPL",
    url: "https://nvpl.vercel.app",
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        alt: "NVPL - National Virtual Pro League",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "NVPL | National Virtual Pro League",
    description: "Compete. Connect. Dominate.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

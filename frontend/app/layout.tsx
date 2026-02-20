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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://predictpy.com"

export const metadata: Metadata = {
  title: "PredictPy — ML Feature Selection",
  description: "Upload a dataset and predict the best features using intelligent ML analysis. Built for data scientists and ML engineers.",
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "PredictPy — ML Feature Selection",
    description: "Upload any CSV or Excel dataset. Get instant feature rankings, scatter plots, and train ML models in seconds.",
    url: SITE_URL,
    siteName: "PredictPy",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PredictPy — ML Feature Selection",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PredictPy — ML Feature Selection",
    description: "Upload any CSV or Excel dataset. Get instant feature rankings, scatter plots, and train ML models in seconds.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-zinc-100 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar"; // Import the Navbar component

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Application Tracker", // Updated title
  description: "Track and manage job applications scraped from LinkedIn.", // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-gray-50 antialiased`}
      >
        <Navbar /> {/* Fixed at top */}
        <main className="container mx-auto flex-grow p-4">
          {children}
        </main>
        {/* Footer fixed at bottom */}
        <footer className="flex-shrink-0 bg-gray-200 p-4 text-center text-sm text-gray-600">
          {" "}
          © {new Date().getFullYear()} Job App Tracker
        </footer>
      </body>
    </html>
  );
}

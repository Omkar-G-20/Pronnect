import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "@/components/ui/Toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pronnect — Find Your Team, Build Together",
  description:
    "Pronnect is the platform where makers, developers, and creators discover each other and team up on projects. Find collaborators, manage tasks, chat, and ship together.",
  keywords: ["collaboration", "projects", "teams", "github", "developers", "hackathon"],
  openGraph: {
    title: "Pronnect — Find Your Team, Build Together",
    description: "Discover collaborators and build your next big project together.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-50 antialiased`}>
        <SessionProvider session={session}>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}

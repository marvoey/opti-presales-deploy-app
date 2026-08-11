import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { NavLink } from "@/components/NavLink";
import { navLinks } from "@/lib/navConfig";
import "./globals.css";

// VC Nudge (Optimizely's display face) is licensed; Space Grotesk is the
// closest freely available geometric grotesque for headings and UI chrome.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Die Grotesk B (the brand body face) → Inter as the standard grotesque substitute.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Opti Deploy",
  description: "Deploy Optimizely CMS demo sites to Vercel",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-blue-50">
        <header className="bg-blue-900 shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3">
            <a href="/" className="flex items-center gap-2 text-sm font-semibold text-white hover:text-blue-300 shrink-0">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-blue-300">
                <rect width="20" height="20" rx="4" fill="currentColor" />
                <path d="M5 10h10M10 5v10" stroke="#0d3a29" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Opti Deploy
            </a>
            <nav className="flex items-center gap-4">
              {navLinks.map(({ href, label }) => (
                <NavLink key={href} href={href}>{label}</NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

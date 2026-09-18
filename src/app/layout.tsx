import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cyber Range",
  description: "Executable investigation environments for cybersecurity training.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

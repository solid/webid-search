import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebID Search",
  description: "Search for WebIDs by name or content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

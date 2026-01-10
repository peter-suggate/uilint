"use client";

import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Preserve this comment too. */}
        {children}
      </body>
    </html>
  );
}

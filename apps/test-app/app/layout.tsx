import type { Metadata } from "next";
import { UILint, UILintProvider } from "uilint-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "UILint Test App",
  description: "Test application for UILint component",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <html lang="en">
      <body>
        {/* Source Visualization Overlay - new feature */}
        <UILintProvider enabled={isDev} defaultMode="off">
          {/* Original Consistency Analysis Overlay */}
          <UILint enabled={isDev} position="top-right" autoScan={false}>
            {children}
          </UILint>
        </UILintProvider>
      </body>
    </html>
  );
}

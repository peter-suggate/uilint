import type { Metadata } from "next";
import { UILintProvider } from "uilint-react";
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
  return (
    <html lang="en">
      <body>
        <UILintProvider enabled={process.env.NODE_ENV !== "production"}>
          {children}
        </UILintProvider>
      </body>
    </html>
  );
}

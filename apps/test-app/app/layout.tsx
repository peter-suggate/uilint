import type { Metadata } from "next";
import { UILintProvider } from "uilint-react";
import { Navigation } from "./components/Navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "UILint Test App - Todo Manager",
  description:
    "Test application for UILint component with deliberate inconsistencies",
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
          <Navigation />
          {children}
        </UILintProvider>
      </body>
    </html>
  );
}

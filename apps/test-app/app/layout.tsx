import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navigation } from "./components/Navigation";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "UILint Test App - Todo Manager",
  description:
    "Test application for UILint component with deliberate inconsistencies",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}

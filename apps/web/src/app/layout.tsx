import type { ReactNode } from "react";
import "../styles/globals.css";

export const metadata = {
  title: "OmniStock",
  description: "OmniStock tenant admin console.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

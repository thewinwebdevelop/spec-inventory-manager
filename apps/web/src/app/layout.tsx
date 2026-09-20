import type { ReactNode } from "react";
import "../styles/globals.css";
import { AppProviders } from "../components/providers/AppProviders";

export const metadata = {
  title: "OmniStock",
  description: "OmniStock tenant admin console.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

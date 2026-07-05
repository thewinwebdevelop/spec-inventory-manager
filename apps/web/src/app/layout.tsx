import type { ReactNode } from "react";

export const metadata = {
  title: "OmniStock",
  description: "OmniStock tenant admin console — placeholder shell (T-000-09).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

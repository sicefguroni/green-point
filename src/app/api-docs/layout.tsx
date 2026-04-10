import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "API documentation | GreenPoint",
  description: "OpenAPI (Swagger) reference for GreenPoint HTTP APIs",
  robots: { index: false, follow: false },
};

export default function ApiDocsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

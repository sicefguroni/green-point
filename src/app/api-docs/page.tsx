"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-neutral-600">
      Loading API docs…
    </div>
  ),
});

export default function ApiDocsPage() {
  return (
    <div className="api-docs-root min-h-screen bg-white">
      <SwaggerUI
        url="/api/openapi"
        docExpansion="list"
        defaultModelsExpandDepth={1}
        persistAuthorization
      />
    </div>
  );
}

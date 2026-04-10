import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/openapi/openapi-document";

/**
 * Machine-readable OpenAPI document for Swagger UI (`/api-docs`) and external clients.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const doc = {
    ...openApiDocument,
    servers: [{ url: origin, description: "This deployment" }],
  };
  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}

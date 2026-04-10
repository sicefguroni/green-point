import { NextResponse } from "next/server";

export function buildSMaxAgeCacheControl(sMaxAge: number): string {
  const swr = Math.min(sMaxAge * 2, 86_400);
  return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
}

export function jsonWithSMaxAge<T>(
  body: T,
  sMaxAge: number,
  extraHeaders?: Record<string, string>,
): NextResponse<T> {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": buildSMaxAgeCacheControl(sMaxAge),
      ...extraHeaders,
    },
  });
}

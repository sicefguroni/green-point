import { NextResponse } from "next/server";

export function jsonWithSMaxAge<T>(body: T, sMaxAge: number): NextResponse<T> {
  const swr = Math.min(sMaxAge * 2, 86_400);
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    },
  });
}

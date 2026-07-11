import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const username = process.env.SITE_USERNAME || "naruhodo";
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const decoded = atob(authHeader.slice(6));
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    if (user === username && pass === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("認証が必要です。", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Naruhodo!"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg).*)"],
};

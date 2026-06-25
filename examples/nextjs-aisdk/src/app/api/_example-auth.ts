import { NextResponse } from "next/server";

const EXAMPLE_TOKEN_HEADER = "x-tcc-example-token";

export function authorizeExampleRequest(request: Request): NextResponse | null {
  if (process.env.TCC_ALLOW_UNAUTHENTICATED_EXAMPLE_APIS === "1") {
    return null;
  }

  const expectedToken = process.env.TCC_EXAMPLE_API_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      {
        error:
          "Example API routes are disabled. Set TCC_EXAMPLE_API_TOKEN or TCC_ALLOW_UNAUTHENTICATED_EXAMPLE_APIS=1 for local-only demos.",
      },
      { status: 403 }
    );
  }

  if (request.headers.get(EXAMPLE_TOKEN_HEADER) !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

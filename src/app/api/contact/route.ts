import { handlePrivateContact } from "@/lib/private-contact";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handlePrivateContact(request);
}

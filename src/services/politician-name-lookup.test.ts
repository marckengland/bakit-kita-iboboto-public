import { expect, it, vi } from "vitest";
import { listPoliticians } from "./politician.service";
import { prisma } from "@/lib/prisma";

it("combines name matching with office and location constraints", async () => {
  vi.mocked(prisma.politician.findMany).mockResolvedValue([]);
  const result = await listPoliticians({
    name: " Synthetic ",
    position: "Mayor",
    city: "Fixture City",
  });
  expect(result.items).toEqual([]);
  expect(prisma.politician.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        AND: [
          {
            OR: [
              { fullName: { contains: "Synthetic", mode: "insensitive" } },
              { legalName: { contains: "Synthetic", mode: "insensitive" } },
              { nickname: { contains: "Synthetic", mode: "insensitive" } },
              { firstName: { contains: "Synthetic", mode: "insensitive" } },
              { lastName: { contains: "Synthetic", mode: "insensitive" } },
            ],
          },
          {
            Position: {
              some: {
                isCurrent: true,
                jurisdiction: { contains: "Fixture City", mode: "insensitive" },
              },
            },
          },
          {
            Position: {
              some: { isCurrent: true, title: { equals: "Mayor", mode: "insensitive" } },
            },
          },
        ],
      },
    })
  );
});

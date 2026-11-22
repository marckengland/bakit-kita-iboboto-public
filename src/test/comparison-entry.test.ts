import { isValidElement, type ReactNode } from "react";
import { expect, it } from "vitest";
import ComparePage from "../app/compare/page";
import { ComparisonTool } from "../app/compare/components/ComparisonTool";

function selectedIds(node: ReactNode): string[] | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = selectedIds(child);
      if (found) {
        return found;
      }
    }
  }
  if (isValidElement<{ children?: ReactNode; initialSelectedIds?: string[] }>(node)) {
    if (node.type === ComparisonTool) {
      return node.props.initialSelectedIds;
    }
    return selectedIds(node.props.children);
  }
  return undefined;
}

it("opens the profiles supplied by the comparison URL", async () => {
  const page = await ComparePage({
    searchParams: Promise.resolve({ ids: "synthetic-a, synthetic-b,,synthetic-a" }),
  });
  expect(selectedIds(page)).toEqual(["synthetic-a", "synthetic-b"]);
});

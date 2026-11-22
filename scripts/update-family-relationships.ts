export {};

// Retained command interface; the private research inputs are excluded from this copy.
async function main(): Promise<never> {
  throw new Error(
    "Research review and approval are required. This command has no bundled data or database writer in the source-only copy."
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Research command unavailable");
  process.exitCode = 1;
});

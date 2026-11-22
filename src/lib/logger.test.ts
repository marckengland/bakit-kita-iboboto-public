import { Console } from "node:console";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

function captureLogs() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const stream = (chunks: string[]) =>
    new Writable({
      write(chunk, _encoding, done) {
        chunks.push(String(chunk));
        done();
      },
    });

  return {
    logger: createLogger(
      new Console({ stdout: stream(stdout), stderr: stream(stderr), colorMode: false })
    ),
    stdout,
    stderr,
  };
}

describe("logger", () => {
  it("keeps informational messages, format arguments, and object details on stdout", () => {
    const { logger, stdout, stderr } = captureLogs();

    logger.info("Imported %d records", 12, { congress: 20 });

    expect(stdout.join("")).toBe("[INFO] Imported 12 records { congress: 20 }\n");
    expect(stderr).toEqual([]);
  });

  it("keeps warning messages and details on stderr without promoting them to errors", () => {
    const { logger, stdout, stderr } = captureLogs();

    logger.warn("Retrying %s", "senate", { attempt: 2 });

    expect(stderr.join("")).toBe("[WARN] Retrying senate { attempt: 2 }\n");
    expect(stdout).toEqual([]);
  });

  it("preserves error messages and stack traces on stderr", () => {
    const { logger, stdout, stderr } = captureLogs();

    logger.error("Import failed", new Error("Source unavailable"));

    const text = stderr.join("");
    expect(text).toContain("[ERROR] Import failed Error: Source unavailable");
    expect(text).toContain("    at ");
    expect(stdout).toEqual([]);
  });

  it("keeps every informational event and its argument order", () => {
    const { logger, stdout } = captureLogs();

    logger.info("Scrape started");
    logger.info("Scrape completed:", 12, "added", 3, "updated");

    expect(stdout).toEqual([
      "[INFO] Scrape started\n",
      "[INFO] Scrape completed: 12 added 3 updated\n",
    ]);
  });
});

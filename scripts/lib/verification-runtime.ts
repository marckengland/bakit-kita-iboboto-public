import type { ChildProcess } from "node:child_process";
import { devNull } from "node:os";

/** Caller dotenv settings must never replace the disposable database target. */
export function verificationEnv(
  databaseUrl: string,
  source: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...source,
    DATABASE_URL: databaseUrl,
    DOTENV_CONFIG_PATH: devNull,
    DOTENV_CONFIG_OVERRIDE: "false",
  };
  for (const key of [
    "DOTENV_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_AI_API_KEY",
    "ANTHROPIC_API_KEY",
    "DEEPSEEK_API_KEY",
    "OPENROUTER_API_KEY",
    "RESEND_API_KEY",
    "PRIVATE_CONTACT_TO",
    "PRIVATE_CONTACT_FROM",
  ]) {
    delete env[key];
  }
  return env;
}

export async function stopOwnedProcess(child?: ChildProcess): Promise<void> {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

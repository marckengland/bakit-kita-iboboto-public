/**
 * Temporary admin tools are available only with an explicit local opt-in.
 * Header roles are development stubs, so production must stay disabled until
 * server-verified administrator authentication is implemented.
 */
export function isLocalAdminEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ADMIN_ENABLED === "true";
}

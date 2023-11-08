import { Env } from "deno-slack-sdk/types.ts";

export function determineIsDebugMode(env: Env): boolean {
  const isDebugMode: boolean = env.DEBUG_MODE !== undefined && (
    env.DEBUG_MODE === "1" ||
    env.DEBUG_MODE === "T" ||
    env.DEBUG_MODE === "TRUE" ||
    env.DEBUG_MODE === "True" ||
    env.DEBUG_MODE === "true"
  );
  return isDebugMode;
}

export function determineLogLevel(env: Env): "DEBUG" | "INFO" {
  const logLevel = determineIsDebugMode(env) ? "DEBUG" : "INFO";
  return logLevel;
}

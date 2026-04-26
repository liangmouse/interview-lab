#!/usr/bin/env node

import { spawn } from "node:child_process";
import dotenv from "dotenv";

const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = [];
let shuttingDown = false;
let exitCode = 0;
const realtimeOnly = process.argv.includes("--realtime-only");

dotenv.config({ path: ".env.local" });
dotenv.config();

function spawnService(name, args) {
  const child = spawn(pnpmBin, args, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${name}:`, error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const resolvedCode = typeof code === "number" ? code : 1;
    const reason = signal ? `signal ${signal}` : `code ${resolvedCode}`;
    if (name === "web" || (realtimeOnly && name === "gateway")) {
      console.error(
        `[dev] ${name} exited with ${reason}, stopping all services`,
      );
      shutdown(resolvedCode);
      return;
    }
    console.error(`[dev] ${name} exited with ${reason}, web keeps running`);
  });

  children.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }
    process.exit(exitCode);
  }, 3000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnService("web", ["run", "dev:web"]);

const requiredGatewayEnv = [
  "VOLC_REALTIME_BROWSER_API_KEY",
  "VOLCENGINE_STT_APP_ID",
  "VOLCENGINE_STT_ACCESS_TOKEN",
];
const missingGatewayEnv = requiredGatewayEnv.filter((key) => !process.env[key]);

if (missingGatewayEnv.length === 0) {
  spawnService("gateway", ["run", "dev:gateway"]);
} else {
  console.warn(
    `[dev] Skip gateway startup because missing env: ${missingGatewayEnv.join(", ")}`,
  );
  console.warn(
    "[dev] End-to-end voice mode will be unavailable in this session",
  );
}

if (realtimeOnly) {
  console.warn("[dev] Realtime-only mode: skip scheduler");
} else {
  spawnService("scheduler", ["run", "dev:scheduler"]);
}

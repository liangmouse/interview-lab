#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import dotenv from "dotenv";

const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const children = [];
let shuttingDown = false;
let exitCode = 0;
let cleanupDone = false;

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
    if (name === "web") {
      console.error(`[dev] ${name} exited with ${reason}, stopping all services`);
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

  if (!cleanupDone) {
    cleanupDone = true;
    const cleanupResult = spawnSync(pnpmBin, ["run", "agent:kill"], {
      stdio: "inherit",
      env: process.env,
    });
    if (cleanupResult.error) {
      console.error("[dev] Failed to run agent cleanup:", cleanupResult.error);
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

const requiredAgentEnv = ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL"];
const missingAgentEnv = requiredAgentEnv.filter((key) => !process.env[key]);

if (missingAgentEnv.length === 0) {
  spawnService("agent", ["run", "agent:dev"]);
} else {
  console.warn(
    `[dev] Skip agent startup because missing env: ${missingAgentEnv.join(", ")}`,
  );
  console.warn("[dev] Interview realtime mode will be unavailable in this session");
}

import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    alias: {
      "@": path.resolve(__dirname, "./apps/web/src"),
      "@interviewclaw/data-access": path.resolve(
        __dirname,
        "./packages/data-access/src/index.ts",
      ),
      "@interviewclaw/domain": path.resolve(
        __dirname,
        "./packages/domain/src/index.ts",
      ),
      "@interviewclaw/channel-sdk": path.resolve(
        __dirname,
        "./packages/channel-sdk/src/index.ts",
      ),
      "@interviewclaw/agent-core": path.resolve(
        __dirname,
        "./packages/agent-core/src/index.ts",
      ),
      "@interviewclaw/workflows": path.resolve(
        __dirname,
        "./packages/workflows/src/index.ts",
      ),
    },
  },
});

import { createWebSearchTool } from "./websearch";

type ToolEventPayload = Record<string, unknown>;

type SharedToolsContext = {
  onToolEvent?: (payload: ToolEventPayload) => void;
};

export function createSharedTools(context: SharedToolsContext = {}) {
  return {
    web_search: createWebSearchTool(context),
  };
}

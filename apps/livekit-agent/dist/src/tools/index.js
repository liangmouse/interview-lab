import { createWebSearchTool } from "./websearch";
export function createSharedTools(context = {}) {
    return {
        web_search: createWebSearchTool(context),
    };
}

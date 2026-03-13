import type { ProviderRegistry } from "./providers/types";

export type ResolvedModelRoute = {
  providerId: string;
  model: string;
  provider: NonNullable<ReturnType<ProviderRegistry["get"]>>;
};

export async function resolveModelRoute(
  modelSpecifier: string,
  registry: ProviderRegistry,
): Promise<ResolvedModelRoute> {
  const [providerId, ...modelParts] = modelSpecifier.split("/");
  const model = modelParts.join("/");

  if (!providerId || !model) {
    throw new Error(`Invalid model specifier: ${modelSpecifier}`);
  }

  const provider = registry.get(providerId);
  if (!provider) {
    throw new Error(`Provider \`${providerId}\` is not configured`);
  }

  return {
    providerId,
    model,
    provider,
  };
}

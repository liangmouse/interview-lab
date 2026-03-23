type NodeInstrumentationModule = typeof import("./instrumentation-node");

function loadNodeInstrumentation() {
  // Keep Node-only telemetry out of the Edge instrumentation bundle.
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier);",
  ) as (specifier: string) => Promise<NodeInstrumentationModule>;

  return dynamicImport("./instrumentation-node");
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { registerNodeInstrumentation } = await loadNodeInstrumentation();
  await registerNodeInstrumentation();
}

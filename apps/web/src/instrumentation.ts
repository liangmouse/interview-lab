export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    const { registerNodeInstrumentation } = await import(
      "./instrumentation-node"
    );
    await registerNodeInstrumentation();
  } catch (error) {
    console.error(
      "[instrumentation] failed to initialize node telemetry",
      error,
    );
  }
}

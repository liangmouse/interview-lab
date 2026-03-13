import {
  createAuthProfileStore,
  createOpenAICodexAuthProvider,
} from "@interviewclaw/ai-runtime";

type RunCliCommandDeps = {
  agentModuleUrl: string;
  runWorkerMode: (
    agentModuleUrl: string,
    opts?: { numIdleProcesses?: number },
  ) => void;
  authLogin?: (input: { remote: boolean }) => Promise<void>;
};

export async function runCliCommand(
  args: string[],
  deps: RunCliCommandDeps,
): Promise<boolean> {
  if (args[0] !== "auth") {
    return false;
  }

  if (args[1] !== "login" || args[2] !== "openai-codex") {
    throw new Error("Unsupported auth command");
  }

  const remote = args.includes("--remote");
  const authLogin = deps.authLogin ?? defaultAuthLogin;
  await authLogin({ remote });
  return true;
}

async function defaultAuthLogin(input: { remote: boolean }) {
  const profileStore = createAuthProfileStore();
  const provider = createOpenAICodexAuthProvider({
    env: process.env,
    profileStore,
  });
  const result = await provider.startLogin({ remote: input.remote });
  console.log(`Saved OpenAI Codex profile: ${result.profileId}`);
}

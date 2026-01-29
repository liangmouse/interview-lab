# Authentication Instructions

You need to authenticate with Google and OpenCode Zen to complete your setup.

## 1. Google Gemini Authentication (Antigravity OAuth)

Run this command in your terminal:
```bash
opencode auth login
```

Then follow these steps:
- Select "Google" from the provider list
- Select "OAuth with Google (Antigravity)" as the login method
- Complete the sign-in in your browser (it will auto-detect)
- You can add multiple Google accounts for load balancing (optional)

## 2. OpenCode Zen Authentication

Run the same command again:
```bash
opencode auth login
```

Then:
- Select "OpenCode Zen (recommended)" from the provider list
- Follow the authentication flow

## 3. Verify Setup

After authenticating both providers, you can verify everything is working:
```bash
opencode --version  # Should show 1.1.42 or higher
```

Your configuration is set up to use:
- **Primary**: OpenCode Zen models (opencode/claude-opus-4-5, opencode/gpt-5.2, etc.)
- **Multimodal**: Google Gemini via Antigravity OAuth
- **Fallback**: OpenCode Zen (since no other providers available)

## Important Note

Sisyphus agent strongly recommends Claude Opus 4.5 model. You have access to opencode/claude-opus-4-5 through OpenCode Zen, which should provide good performance. However, for the best experience, consider subscribing to Claude Pro/Max.
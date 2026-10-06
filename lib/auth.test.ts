import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("auth security configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("identifies github auth when GITHUB_ID and GITHUB_SECRET are provided", async () => {
    process.env.GITHUB_ID = "test-id";
    process.env.GITHUB_SECRET = "test-secret";
    delete process.env.AUTH_PASSWORD;

    const { getAuthMode, isGithubAuthConfigured, isPasswordAuthConfigured } = await import("./auth");
    expect(isGithubAuthConfigured()).toBe(true);
    expect(isPasswordAuthConfigured()).toBe(false);
    const mode = getAuthMode();
    expect(mode.githubEnabled).toBe(true);
    expect(mode.passwordRequired).toBe(false);
    expect(mode.canLogin).toBe(true);
  });

  it("requires password when AUTH_PASSWORD is set and github is not configured", async () => {
    delete process.env.GITHUB_ID;
    delete process.env.GITHUB_SECRET;
    process.env.AUTH_PASSWORD = "my-secret-password";

    const { getAuthMode, isGithubAuthConfigured, isPasswordAuthConfigured } = await import("./auth");
    expect(isGithubAuthConfigured()).toBe(false);
    expect(isPasswordAuthConfigured()).toBe(true);
    const mode = getAuthMode();
    expect(mode.githubEnabled).toBe(false);
    expect(mode.passwordRequired).toBe(true);
    expect(mode.canLogin).toBe(true);
  });

  it("blocks insecure login in production when neither github nor AUTH_PASSWORD is set", async () => {
    delete process.env.GITHUB_ID;
    delete process.env.GITHUB_SECRET;
    delete process.env.AUTH_PASSWORD;
    delete process.env.ALLOW_INSECURE_DEV_LOGIN;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const { getAuthMode, isDevAuthAllowed } = await import("./auth");
    expect(isDevAuthAllowed()).toBe(false);
    const mode = getAuthMode();
    expect(mode.githubEnabled).toBe(false);
    expect(mode.passwordRequired).toBe(false);
    expect(mode.canLogin).toBe(false);
  });

  it("allows dev login in development environment", async () => {
    delete process.env.GITHUB_ID;
    delete process.env.GITHUB_SECRET;
    delete process.env.AUTH_PASSWORD;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";

    const { getAuthMode, isDevAuthAllowed } = await import("./auth");
    expect(isDevAuthAllowed()).toBe(true);
    const mode = getAuthMode();
    expect(mode.githubEnabled).toBe(false);
    expect(mode.passwordRequired).toBe(false);
    expect(mode.canLogin).toBe(true);
  });
});

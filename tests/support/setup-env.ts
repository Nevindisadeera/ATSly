// Test environment defaults. Real secrets are never used in tests.
process.env.AUTH_SECRET ??= "test-secret-for-signing-cookies-0123456789";
process.env.GUEST_RETENTION_DAYS ??= "7";

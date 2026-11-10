process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET ??= 'test-secret-test-secret-test-secret-test-1234';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.UPLOAD_DIR ??= './.test-uploads';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL (a migrated + seeded TEST database, connecting as the non-superuser app_runtime role) before running tests. See README.');

// Runs before any module is imported: gives config.ts a valid, isolated test environment
// (dotenv never overrides variables that are already set).
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test?schema=public';
process.env['JWT_SECRET'] = 'test-secret-test-secret-test-secret-1234';
process.env['CORS_ORIGIN'] = 'http://localhost:5173';
process.env['LOG_LEVEL'] = 'error';

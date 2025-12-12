import { beforeAll, afterAll, afterEach } from 'vitest';
import { config } from 'dotenv';

// Load environment variables for tests
config();

beforeAll(async () => {
  // Global setup before all tests
  console.log('Test suite starting...');
});

afterAll(async () => {
  // Global teardown after all tests
  console.log('Test suite complete.');
});

afterEach(async () => {
  // Cleanup after each test
  // Example: Clear database test data, reset mocks
});

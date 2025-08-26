import 'jest';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'eu-north-1';
  
  // Mock environment variables for Lambda functions
  process.env.PLAYER_BASES_TABLE = 'GameBaseService-test-PlayerBases';
  process.env.BASE_TEMPLATES_TABLE = 'GameBaseService-test-BaseTemplates';
  process.env.SPAWN_LOCATIONS_TABLE = 'GameBaseService-test-SpawnLocations';
  process.env.BASE_UPGRADES_TABLE = 'GameBaseService-test-BaseUpgrades';
});

// Global test teardown
afterAll(() => {
  // Clean up any global resources
});

// Mock AWS SDK globally for unit tests
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

// Mock shared utilities for consistent testing
jest.mock('@loupeen/shared-js-utils', () => ({
  StructuredLogger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  GameEngineError: class MockGameEngineError extends Error {
    constructor(message: string, public code: string, public details?: any) {
      super(message);
      this.name = 'GameEngineError';
    }
  },
  withErrorHandling: jest.fn((handler) => handler),
  validateRequest: jest.fn(),
  publishCustomMetric: jest.fn()
}));

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass
    };
  },
  
  toBeValidCoordinates(received: any) {
    const pass = received && 
      typeof received.x === 'number' && 
      typeof received.y === 'number' &&
      Number.isInteger(received.x) &&
      Number.isInteger(received.y);
    
    return {
      message: () => `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to be valid coordinates`,
      pass
    };
  }
});

// Declare custom matchers for TypeScript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidCoordinates(): R;
    }
  }
}
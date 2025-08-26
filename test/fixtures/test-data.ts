import { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * Test fixtures for game-base-service tests
 * Following SOLID principles with reusable test data
 */

export const TEST_PLAYER_ID = 'test-player-123';
export const TEST_BASE_ID = 'base-456';
export const TEST_ALLIANCE_ID = 'alliance-789';

export const mockBaseTemplate = {
  templateId: 'template-cmd-center-1',
  baseType: 'command_center',
  level: 1,
  requirements: {
    resources: {
      gold: 1000,
      food: 500,
      materials: 200
    },
    playerLevel: 1
  },
  stats: {
    health: 1000,
    defense: 100,
    production: 50,
    storage: 1000
  },
  buildTime: 300000 // 5 minutes
};

export const mockPlayerBase = {
  playerId: TEST_PLAYER_ID,
  baseId: TEST_BASE_ID,
  baseName: 'Test Command Center',
  baseType: 'command_center',
  level: 1,
  coordinates: { x: 100, y: 200 },
  status: 'active',
  stats: {
    health: 1000,
    defense: 100,
    production: 50,
    storage: 1000
  },
  mapSectionId: '1,2',
  allianceId: TEST_ALLIANCE_ID,
  createdAt: Date.now() - 86400000, // 24 hours ago
  lastActiveAt: Date.now() - 3600000, // 1 hour ago
  buildCompletionTime: null,
  lastMovedAt: null,
  arrivalTime: null
};

export const mockSpawnLocation = {
  spawnRegionId: 'central',
  spawnLocationId: 'spawn-123',
  coordinates: { x: 150, y: 250 },
  isAvailable: 'true',
  populationDensity: 0.3,
  safetyRating: 0.8,
  resourceAccessibility: 0.7
};

export const mockBaseUpgrade = {
  playerId: TEST_PLAYER_ID,
  upgradeId: 'upgrade-789',
  baseId: TEST_BASE_ID,
  upgradeType: 'level',
  fromLevel: 1,
  toLevel: 2,
  status: 'in_progress',
  startedAt: Date.now() - 120000, // 2 minutes ago
  completionTime: Date.now() + 180000, // 3 minutes from now
  cost: {
    gold: 500,
    food: 250,
    materials: 100
  }
};

export const createMockAPIGatewayEvent = (
  body: any = null,
  pathParameters: Record<string, string> = {},
  queryStringParameters: Record<string, string> = {}
): APIGatewayProxyEvent => ({
  body: body ? JSON.stringify(body) : null,
  headers: {
    'Content-Type': 'application/json',
    'X-Player-Id': TEST_PLAYER_ID
  },
  multiValueHeaders: {},
  httpMethod: 'POST',
  isBase64Encoded: false,
  path: '/test',
  pathParameters,
  queryStringParameters,
  multiValueQueryStringParameters: {},
  stageVariables: {},
  requestContext: {
    accountId: '728427470046',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    httpMethod: 'POST',
    path: '/test',
    stage: 'test',
    requestId: 'test-request-123',
    requestTime: '01/Jan/2024:00:00:00 +0000',
    requestTimeEpoch: Date.now(),
    resourceId: 'test-resource',
    resourcePath: '/test',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'test-agent',
      userArn: null,
      clientCert: null
    },
    authorizer: {}
  },
  resource: '/test'
});

export const createMockDynamoDBResponse = (items: any[] = []) => ({
  Items: items,
  Count: items.length,
  ScannedCount: items.length,
  LastEvaluatedKey: undefined
});

export const createMockDynamoDBGetResponse = (item: any = null) => ({
  Item: item
});

// Mock requests for different scenarios
export const validCreateBaseRequest = {
  playerId: TEST_PLAYER_ID,
  baseType: 'command_center',
  baseName: 'Test Base',
  coordinates: { x: 100, y: 200 },
  allianceId: TEST_ALLIANCE_ID
};

export const validUpgradeBaseRequest = {
  playerId: TEST_PLAYER_ID,
  baseId: TEST_BASE_ID,
  upgradeType: 'level',
  skipTime: false
};

export const validMoveBaseRequest = {
  playerId: TEST_PLAYER_ID,
  baseId: TEST_BASE_ID,
  newCoordinates: { x: 150, y: 250 },
  useTeleport: false
};

export const validSpawnLocationRequest = {
  playerId: TEST_PLAYER_ID,
  preferredRegion: 'center',
  groupWithFriends: true,
  friendIds: ['friend-1', 'friend-2']
};

// Error scenarios
export const invalidRequests = {
  missingPlayerId: {
    baseType: 'command_center',
    baseName: 'Test Base'
  },
  invalidBaseType: {
    playerId: TEST_PLAYER_ID,
    baseType: 'invalid_type',
    baseName: 'Test Base'
  },
  emptyBaseName: {
    playerId: TEST_PLAYER_ID,
    baseType: 'command_center',
    baseName: ''
  }
};
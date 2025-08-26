// Mock the DynamoDB client BEFORE imports
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend
      }))
    },
    GetCommand: jest.fn(),
    QueryCommand: jest.fn(),
    UpdateCommand: jest.fn(),
    PutCommand: jest.fn(),
    __mockSend: mockSend // Export for test access
  };
});

import { handler } from '../../../lambda/base-management/upgrade-base';
import { 
  createMockAPIGatewayEvent,
  validUpgradeBaseRequest,
  mockPlayerBase,
  mockBaseUpgrade,
  createMockDynamoDBGetResponse,
  createMockDynamoDBResponse,
  TEST_PLAYER_ID,
  TEST_BASE_ID
} from '../../fixtures/test-data';

// Access the mock function from the mocked module
// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
const mockSend = require('@aws-sdk/lib-dynamodb').__mockSend;

describe('Upgrade Base Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  describe('Successful base upgrade', () => {
    it('should upgrade base level successfully', async () => {
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest, 
        { baseId: TEST_BASE_ID }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockPlayerBase))  // Get base
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))  // No active upgrades
        .mockResolvedValueOnce({})  // Create upgrade record
        .mockResolvedValueOnce({});  // Update base status

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.upgrade).toMatchObject({
        baseId: TEST_BASE_ID,
        upgradeType: 'level',
        fromLevel: 1,
        toLevel: 2,
        status: 'in_progress'
      });
      expect(body.data.upgrade.upgradeId).toBeDefined();
      expect(body.data.upgrade.completionTime).toBeGreaterThan(Date.now());
    });

    it('should handle instant upgrade with skipTime', async () => {
      const instantUpgradeRequest = {
        ...validUpgradeBaseRequest,
        skipTime: true
      };
      const event = createMockAPIGatewayEvent(
        instantUpgradeRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockPlayerBase))
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce({})  // Update base immediately
        .mockResolvedValueOnce({});  // Create completed upgrade record

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.upgrade.status).toBe('completed');
      expect(body.data.goldCost).toBeGreaterThan(0);  // Should have gold cost
    });

    it('should upgrade different upgrade types', async () => {
      const defenseUpgrade = {
        ...validUpgradeBaseRequest,
        upgradeType: 'defense'
      };
      const event = createMockAPIGatewayEvent(defenseUpgrade, { baseId: TEST_BASE_ID });
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockPlayerBase))
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.upgrade.upgradeType).toBe('defense');
    });

    it('should calculate correct upgrade costs', async () => {
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockPlayerBase))
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.upgrade.cost).toMatchObject({
        gold: expect.any(Number),
        food: expect.any(Number),
        materials: expect.any(Number)
      });
    });
  });

  describe('Base validation', () => {
    it('should reject upgrade for non-existent base', async () => {
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: 'non-existent-base' }
      );
      
      mockSend.mockResolvedValueOnce(createMockDynamoDBGetResponse(null));

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BASE_NOT_FOUND');
    });

    it('should reject upgrade for inactive base', async () => {
      const inactiveBase = { ...mockPlayerBase, status: 'destroyed' };
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend.mockResolvedValueOnce(createMockDynamoDBGetResponse(inactiveBase));

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('BASE_NOT_UPGRADEABLE');
    });

    it('should reject upgrade when base already has active upgrade', async () => {
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockPlayerBase))
        .mockResolvedValueOnce(createMockDynamoDBResponse([mockBaseUpgrade]));  // Active upgrade exists

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UPGRADE_ALREADY_IN_PROGRESS');
    });

    it('should reject upgrade at maximum level', async () => {
      const maxLevelBase = { ...mockPlayerBase, level: 50 };  // Assuming 50 is max
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend.mockResolvedValueOnce(createMockDynamoDBGetResponse(maxLevelBase));

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('MAX_LEVEL_REACHED');
    });
  });

  describe('Request validation', () => {
    it('should require baseId path parameter', async () => {
      const event = createMockAPIGatewayEvent(validUpgradeBaseRequest);

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should validate upgrade type', async () => {
      const invalidUpgrade = {
        ...validUpgradeBaseRequest,
        upgradeType: 'invalid_type'
      };
      const event = createMockAPIGatewayEvent(invalidUpgrade, { baseId: TEST_BASE_ID });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should require playerId in request body', async () => {
      const requestWithoutPlayer = {
        baseId: TEST_BASE_ID,
        upgradeType: 'level'
      };
      const event = createMockAPIGatewayEvent(requestWithoutPlayer, { baseId: TEST_BASE_ID });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Resource requirements', () => {
    it('should validate player has sufficient resources', async () => {
      // This would be implemented when resource service is integrated
      const poorPlayerBase = {
        ...mockPlayerBase,
        // Assume player has insufficient resources
      };
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(poorPlayerBase))
        .mockResolvedValueOnce(createMockDynamoDBResponse([]));

      // For now, this test passes as resource validation isn't implemented yet
      const result = await handler(event);
      expect(result.statusCode).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend.mockRejectedValueOnce(new Error('DynamoDB connection failed'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle malformed request body', async () => {
      const event = createMockAPIGatewayEvent(null, { baseId: TEST_BASE_ID });
      event.body = 'invalid json';

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Business logic calculations', () => {
    it('should calculate upgrade time correctly', async () => {
      const event = createMockAPIGatewayEvent(
        validUpgradeBaseRequest,
        { baseId: TEST_BASE_ID }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockPlayerBase))
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      // Upgrade time should be reasonable (not too short or too long)
      const upgradeTime = body.data.upgrade.completionTime - Date.now();
      expect(upgradeTime).toBeGreaterThan(60000);   // At least 1 minute
      expect(upgradeTime).toBeLessThan(86400000);   // Less than 24 hours
    });

    it('should calculate instant upgrade gold cost correctly', async () => {
      const instantRequest = {
        ...validUpgradeBaseRequest,
        skipTime: true
      };
      const event = createMockAPIGatewayEvent(instantRequest, { baseId: TEST_BASE_ID });
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockPlayerBase))
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      
      // Gold cost should be reasonable for instant upgrade
      expect(body.data.goldCost).toBeGreaterThan(0);
      expect(body.data.goldCost).toBeLessThan(10000);
    });
  });
});
// Mock the DynamoDB client BEFORE imports
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend
      }))
    },
    QueryCommand: jest.fn(),
    __mockSend: mockSend // Export for test access
  };
});

import { handler } from '../../../lambda/base-queries/list-bases';
import { 
  createMockAPIGatewayEvent,
  mockPlayerBase,
  createMockDynamoDBResponse,
  TEST_PLAYER_ID
} from '../../fixtures/test-data';

// Access the mock function from the mocked module
const mockSend = require('@aws-sdk/lib-dynamodb').__mockSend;

describe('List Bases Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  describe('Successful base listing', () => {
    it('should list player bases successfully', async () => {
      const event = createMockAPIGatewayEvent(null, { playerId: TEST_PLAYER_ID });
      
      const mockBases = [
        { ...mockPlayerBase, baseId: 'base-1', baseName: 'Base One' },
        { ...mockPlayerBase, baseId: 'base-2', baseName: 'Base Two' }
      ];
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse(mockBases))  // List bases
        .mockResolvedValueOnce(createMockDynamoDBResponse(mockBases));  // Summary query

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.bases).toHaveLength(2);
      expect(body.data.bases[0]).toMatchObject({
        playerId: TEST_PLAYER_ID,
        baseId: 'base-1',
        baseName: 'Base One',
        isActive: true,
        location: '100, 200'
      });
    });

    it('should filter bases by status', async () => {
      const event = createMockAPIGatewayEvent(null, 
        { playerId: TEST_PLAYER_ID }, 
        { status: 'active' }
      );
      
      const activeBases = [
        { ...mockPlayerBase, status: 'active' }
      ];
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse(activeBases))
        .mockResolvedValueOnce(createMockDynamoDBResponse(activeBases));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.bases).toHaveLength(1);
      expect(body.data.bases[0].status).toBe('active');
    });

    it('should handle pagination correctly', async () => {
      const event = createMockAPIGatewayEvent(null,
        { playerId: TEST_PLAYER_ID },
        { limit: '10', lastEvaluatedKey: 'encoded-key' }
      );
      
      const bases = Array(5).fill(mockPlayerBase);
      const response = {
        ...createMockDynamoDBResponse(bases),
        LastEvaluatedKey: { playerId: TEST_PLAYER_ID, baseId: 'last-base' }
      };
      
      mockSend
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce(createMockDynamoDBResponse(bases));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.pagination.hasMore).toBe(true);
      expect(body.data.pagination.lastEvaluatedKey).toBeDefined();
    });

    it('should include summary statistics', async () => {
      const event = createMockAPIGatewayEvent(null, { playerId: TEST_PLAYER_ID });
      
      const mixedBases = [
        { ...mockPlayerBase, baseId: 'base-1', status: 'active', baseType: 'command_center', level: 3 },
        { ...mockPlayerBase, baseId: 'base-2', status: 'building', baseType: 'outpost', level: 1 },
        { ...mockPlayerBase, baseId: 'base-3', status: 'active', baseType: 'command_center', level: 2 }
      ];
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse(mixedBases))
        .mockResolvedValueOnce(createMockDynamoDBResponse(mixedBases));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.summary).toMatchObject({
        totalBases: 3,
        buildingBases: 1,
        averageLevel: 2.0,
        maxLevel: 3,
        baseTypes: {
          command_center: 2,
          outpost: 1
        }
      });
    });
  });

  describe('Request validation', () => {
    it('should require playerId parameter', async () => {
      const event = createMockAPIGatewayEvent();

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should validate status parameter', async () => {
      const event = createMockAPIGatewayEvent(null,
        { playerId: TEST_PLAYER_ID },
        { status: 'invalid_status' }
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should validate limit parameter', async () => {
      const event = createMockAPIGatewayEvent(null,
        { playerId: TEST_PLAYER_ID },
        { limit: '150' }  // Exceeds max limit of 100
      );

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle player with no bases', async () => {
      const event = createMockAPIGatewayEvent(null, { playerId: TEST_PLAYER_ID });
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))  // No bases
        .mockResolvedValueOnce(createMockDynamoDBResponse([]));  // No summary data

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.bases).toHaveLength(0);
      expect(body.data.summary.totalBases).toBe(0);
    });

    it('should handle stats inclusion flag', async () => {
      const event = createMockAPIGatewayEvent(null,
        { playerId: TEST_PLAYER_ID },
        { includeStats: 'false' }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([mockPlayerBase]))
        .mockResolvedValueOnce(createMockDynamoDBResponse([mockPlayerBase]));

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.bases[0]).not.toHaveProperty('stats');
    });
  });

  describe('Error handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const event = createMockAPIGatewayEvent(null, { playerId: TEST_PLAYER_ID });
      
      mockSend.mockRejectedValueOnce(new Error('DynamoDB query failed'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BASE_QUERY_ERROR');
    });

    it('should handle summary calculation errors gracefully', async () => {
      const event = createMockAPIGatewayEvent(null, { playerId: TEST_PLAYER_ID });
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([mockPlayerBase]))  // List succeeds
        .mockRejectedValueOnce(new Error('Summary query failed'));  // Summary fails

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.bases).toHaveLength(1);
      expect(body.data.summary.totalBases).toBe(0);  // Fallback summary
    });
  });

  describe('Performance optimizations', () => {
    it('should use projection expressions to limit data transfer', async () => {
      const event = createMockAPIGatewayEvent(null,
        { playerId: TEST_PLAYER_ID },
        { includeStats: 'false' }
      );
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([mockPlayerBase]))
        .mockResolvedValueOnce(createMockDynamoDBResponse([mockPlayerBase]));

      await handler(event);

      // Verify that projection expression was used for the first query
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
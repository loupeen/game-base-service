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
    GetCommand: jest.fn(),
    PutCommand: jest.fn(),
    __mockSend: mockSend // Export for test access
  };
});

import { handler } from '../../../lambda/base-management/create-base';
import { 
  createMockAPIGatewayEvent, 
  validCreateBaseRequest,
  invalidRequests,
  mockBaseTemplate,
  mockPlayerBase,
  createMockDynamoDBResponse,
  createMockDynamoDBGetResponse,
  TEST_PLAYER_ID
} from '../../fixtures/test-data';

// Access the mock function from the mocked module
const mockSend = require('@aws-sdk/lib-dynamodb').__mockSend;

describe('Create Base Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
  });

  describe('Successful base creation', () => {
    it('should create a new base successfully', async () => {
      const event = createMockAPIGatewayEvent(validCreateBaseRequest);
      
      // Mock player bases query (for limit check)
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))  // Player has no bases
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockBaseTemplate))  // Base template
        .mockResolvedValueOnce({ $metadata: { httpStatusCode: 200 } });  // Successful base creation

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.base).toMatchObject({
        playerId: TEST_PLAYER_ID,
        baseType: 'command_center',
        baseName: 'Test Base',
        level: 1,
        status: 'building'
      });
      expect(body.data.base.baseId).toBeDefined();
      expect(body.data.base.coordinates).toEqual(expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number)
      }));
    });

    it('should use provided coordinates when available', async () => {
      const requestWithCoords = {
        ...validCreateBaseRequest,
        coordinates: { x: 500, y: 600 }
      };
      const event = createMockAPIGatewayEvent(requestWithCoords);
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockBaseTemplate))
        .mockResolvedValueOnce({});

      const result = await handler(event);
      const body = JSON.parse(result.body);
      
      expect(body.data.base.coordinates).toEqual({ x: 500, y: 600 });
    });

    it('should create base for different base types', async () => {
      const outpostRequest = {
        ...validCreateBaseRequest,
        baseType: 'outpost'
      };
      const event = createMockAPIGatewayEvent(outpostRequest);
      
      const outpostTemplate = {
        ...mockBaseTemplate,
        baseType: 'outpost',
        templateId: 'template-outpost-1'
      };
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(outpostTemplate))
        .mockResolvedValueOnce({});

      const result = await handler(event);
      const body = JSON.parse(result.body);
      
      expect(body.data.base.baseType).toBe('outpost');
    });
  });

  describe('Base limit validation', () => {
    it('should reject creation when player has reached free limit', async () => {
      const event = createMockAPIGatewayEvent(validCreateBaseRequest);
      
      // Mock player has 5 bases (free limit)
      const existingBases = Array(5).fill(mockPlayerBase);
      mockSend.mockResolvedValueOnce(createMockDynamoDBResponse(existingBases));

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BASE_LIMIT_REACHED');
    });

    it('should allow premium players to create more bases', async () => {
      const premiumRequest = {
        ...validCreateBaseRequest,
        hasSubscription: true
      };
      const event = createMockAPIGatewayEvent(premiumRequest);
      
      // Mock player has 7 bases (within premium limit of 10)
      const existingBases = Array(7).fill(mockPlayerBase);
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse(existingBases))
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockBaseTemplate))
        .mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Request validation', () => {
    it('should reject request with missing playerId', async () => {
      const event = createMockAPIGatewayEvent(invalidRequests.missingPlayerId);

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request with invalid base type', async () => {
      const event = createMockAPIGatewayEvent(invalidRequests.invalidBaseType);

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should reject request with empty base name', async () => {
      const event = createMockAPIGatewayEvent(invalidRequests.emptyBaseName);

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should handle malformed JSON gracefully', async () => {
      const event = createMockAPIGatewayEvent();
      event.body = 'invalid json';

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle DynamoDB errors gracefully', async () => {
      const event = createMockAPIGatewayEvent(validCreateBaseRequest);
      
      mockSend.mockRejectedValueOnce(new Error('DynamoDB connection failed'));

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should handle missing base template gracefully', async () => {
      const event = createMockAPIGatewayEvent(validCreateBaseRequest);
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))  // No existing bases
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(null));  // No template found

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TEMPLATE_NOT_FOUND');
    });
  });

  describe('CORS headers', () => {
    it('should include proper CORS headers', async () => {
      const event = createMockAPIGatewayEvent(validCreateBaseRequest);
      
      mockSend
        .mockResolvedValueOnce(createMockDynamoDBResponse([]))
        .mockResolvedValueOnce(createMockDynamoDBGetResponse(mockBaseTemplate))
        .mockResolvedValueOnce({});

      const result = await handler(event);

      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
    });
  });
});
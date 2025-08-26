import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { 
  StructuredLogger, 
  GameEngineError,
  withErrorHandling,
  validateRequest
} from '../../lib/shared-mocks';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS clients following shared patterns
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const logger = new StructuredLogger('CreateBaseHandler');

// Environment variables
const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE ?? '';
const BASE_TEMPLATES_TABLE = process.env.BASE_TEMPLATES_TABLE ?? '';
const SPAWN_LOCATIONS_TABLE = process.env.SPAWN_LOCATIONS_TABLE ?? '';
const ENVIRONMENT = process.env.ENVIRONMENT ?? 'test';

// Request validation schema following shared-js-utils patterns
const CreateBaseRequestSchema = z.object({
  playerId: z.string().min(1).max(50),
  baseType: z.enum(['command_center', 'outpost', 'fortress', 'mining_station', 'research_lab']),
  baseName: z.string().min(1).max(100),
  coordinates: z.object({
    x: z.number().min(-1000000).max(1000000),
    y: z.number().min(-1000000).max(1000000)
  }).optional(),
  spawnLocationId: z.string().optional(),
  allianceId: z.string().optional()
});

type CreateBaseRequest = z.infer<typeof CreateBaseRequestSchema>;

interface BaseTemplate {
  templateId: string;
  baseType: string;
  level: number;
  requirements: {
    resources: Record<string, number>;
    playerLevel: number;
  };
  stats: {
    defense: number;
    storage: number;
    production: number;
  };
  buildTime: number;
}

interface PlayerBase {
  playerId: string;
  baseId: string;
  baseType: string;
  baseName: string;
  level: number;
  coordinates: {
    x: number;
    y: number;
  };
  mapSectionId: string;
  coordinateHash: string;
  allianceId?: string;
  status: 'active' | 'building' | 'moving' | 'destroyed';
  stats: {
    defense: number;
    storage: number;
    production: number;
  };
  createdAt: number;
  lastActiveAt: number;
  buildCompletionTime?: number;
  ttl?: number;
}

/**
 * Create Base Handler
 * 
 * Implements base creation following SOLID principles:
 * - Single Responsibility: Only handles base creation logic
 * - Open/Closed: Extensible for new base types via templates
 * - Liskov Substitution: All base types follow same creation pattern
 * - Interface Segregation: Clear separation of creation concerns
 * - Dependency Inversion: Depends on shared utilities and abstractions
 * 
 * Game Logic:
 * - Validates player can create new base (subscription limits)
 * - Finds optimal spawn location if not provided
 * - Creates base from template with proper stats
 * - Handles coordinate validation and map sectioning
 * - Implements building time mechanics
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return withErrorHandling(async () => {
    logger.info('Processing create base request', { 
      requestId: event.requestContext?.requestId,
      environment: ENVIRONMENT 
    });

    // Validate request using shared validation patterns
    const request = await validateRequest<CreateBaseRequest>(CreateBaseRequestSchema, event.body);
    
    // Check if player can create more bases (subscription limits)
    await validatePlayerBaseLimit(request.playerId);
    
    // Get base template for stats and requirements
    const template = await getBaseTemplate(request.baseType);
    
    // Determine coordinates (use provided or calculate spawn location)
    const coordinates = request.coordinates ?? await calculateSpawnCoordinates(request.spawnLocationId);
    
    // Create the new base
    const newBase = await createPlayerBase(request, template, coordinates);
    
    logger.info('Base created successfully', {
      playerId: request.playerId,
      baseId: newBase.baseId,
      baseType: request.baseType,
      coordinates
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          base: newBase,
          buildTime: template.buildTime,
          message: 'Base creation initiated successfully'
        }
      })
    };
  }, logger);
};

/**
 * Validate player base creation limits based on subscription status
 */
async function validatePlayerBaseLimit(playerId: string): Promise<void> {
  try {
    // Query existing bases for player
    const command = new QueryCommand({
      TableName: PLAYER_BASES_TABLE,
      KeyConditionExpression: 'playerId = :playerId',
      FilterExpression: '#status <> :destroyed',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':playerId': playerId,
        ':destroyed': 'destroyed'
      },
      Select: 'COUNT'
    });

    const response = await docClient.send(command);
    const currentBaseCount = response.Count ?? 0;

    // TODO: Get player subscription status from player service
    const maxBases = 5; // Default for free players, 10 for subscribers
    
    if (currentBaseCount >= maxBases) {
      throw new GameEngineError(
        `Player has reached maximum base limit (${maxBases})`,
        'BASE_LIMIT_EXCEEDED',
        { playerId, currentCount: currentBaseCount, maxBases }
      );
    }
  } catch (error) {
    if (error instanceof GameEngineError) {
      throw error;
    }
    throw new GameEngineError(
      'Failed to validate player base limit',
      'VALIDATION_ERROR',
      { playerId, error: (error as Error).message }
    );
  }
}

/**
 * Get base template with stats and requirements
 */
async function getBaseTemplate(baseType: string): Promise<BaseTemplate> {
  try {
    const command = new GetCommand({
      TableName: BASE_TEMPLATES_TABLE,
      Key: {
        templateId: `${baseType}-level-1` // Start with level 1 template
      }
    });

    const response = await docClient.send(command);
    
    if (!response.Item) {
      throw new GameEngineError(
        `Base template not found for type: ${baseType}`,
        'TEMPLATE_NOT_FOUND',
        { baseType }
      );
    }

    return response.Item as BaseTemplate;
  } catch (error) {
    if (error instanceof GameEngineError) {
      throw error;
    }
    throw new GameEngineError(
      'Failed to retrieve base template',
      'TEMPLATE_RETRIEVAL_ERROR',
      { baseType, error: (error as Error).message }
    );
  }
}

/**
 * Calculate spawn coordinates for new base
 */
async function calculateSpawnCoordinates(spawnLocationId?: string): Promise<{ x: number; y: number }> {
  try {
    if (spawnLocationId) {
      // Use specific spawn location
      const command = new GetCommand({
        TableName: SPAWN_LOCATIONS_TABLE,
        Key: {
          spawnRegionId: 'default',
          spawnLocationId: spawnLocationId
        }
      });

      const response = await docClient.send(command);
      
      if (!response.Item?.isAvailable) {
        throw new GameEngineError(
          'Spawn location not available',
          'SPAWN_LOCATION_UNAVAILABLE',
          { spawnLocationId }
        );
      }

      return {
        x: response.Item.coordinates.x,
        y: response.Item.coordinates.y
      };
    }

    // Generate random coordinates in starter region
    // TODO: Implement proper spawn location algorithm based on population density
    const spawnRadius = 1000; // 1000 unit radius for new players
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * spawnRadius;
    
    return {
      x: Math.floor(Math.cos(angle) * distance),
      y: Math.floor(Math.sin(angle) * distance)
    };
  } catch (error) {
    if (error instanceof GameEngineError) {
      throw error;
    }
    throw new GameEngineError(
      'Failed to calculate spawn coordinates',
      'SPAWN_CALCULATION_ERROR',
      { spawnLocationId, error: (error as Error).message }
    );
  }
}

/**
 * Create the player base record
 */
async function createPlayerBase(
  request: CreateBaseRequest, 
  template: BaseTemplate, 
  coordinates: { x: number; y: number }
): Promise<PlayerBase> {
  try {
    const now = Date.now();
    const baseId = uuidv4();
    
    // Calculate map section for indexing (divide coordinates into 100x100 sections)
    const mapSectionId = `${Math.floor(coordinates.x / 100)},${Math.floor(coordinates.y / 100)}`;
    const coordinateHash = `${coordinates.x},${coordinates.y}`;

    const newBase: PlayerBase = {
      playerId: request.playerId,
      baseId: baseId,
      baseType: request.baseType,
      baseName: request.baseName,
      level: 1,
      coordinates: coordinates,
      mapSectionId: mapSectionId,
      coordinateHash: coordinateHash,
      allianceId: request.allianceId,
      status: template.buildTime > 0 ? 'building' : 'active',
      stats: {
        defense: template.stats.defense,
        storage: template.stats.storage,
        production: template.stats.production
      },
      createdAt: now,
      lastActiveAt: now,
      buildCompletionTime: template.buildTime > 0 ? now + (template.buildTime * 1000) : undefined
    };

    // Store base in DynamoDB
    const command = new PutCommand({
      TableName: PLAYER_BASES_TABLE,
      Item: newBase,
      ConditionExpression: 'attribute_not_exists(playerId) AND attribute_not_exists(baseId)'
    });

    await docClient.send(command);

    return newBase;
  } catch (error) {
    throw new GameEngineError(
      'Failed to create player base',
      'BASE_CREATION_ERROR',
      { 
        playerId: request.playerId, 
        baseType: request.baseType,
        error: (error as Error).message 
      }
    );
  }
}
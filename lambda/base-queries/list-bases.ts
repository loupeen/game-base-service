import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { 
  StructuredLogger, 
  GameEngineError,
  withErrorHandling
} from '../../lib/shared-mocks';
import { z } from 'zod';
import { 
  BaseSummary, 
  EnrichedPlayerBase
} from '../types/game-base-types';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const logger = new StructuredLogger('ListBasesHandler');

const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE ?? '';

const ListBasesRequestSchema = z.object({
  playerId: z.string().min(1).max(50),
  status: z.enum(['active', 'building', 'moving', 'destroyed', 'all']).optional().default('all'),
  limit: z.number().min(1).max(100).optional().default(20),
  lastEvaluatedKey: z.string().optional(),
  includeStats: z.boolean().optional().default(true)
});

type ListBasesRequestInput = z.infer<typeof ListBasesRequestSchema>;

/**
 * List Bases Handler
 * 
 * Implements base listing with efficient pagination following SOLID principles:
 * - Single Responsibility: Only handles base listing operations
 * - Open/Closed: Extensible for additional filtering options
 * - Liskov Substitution: Consistent query interface across all filters
 * - Interface Segregation: Clear separation of query concerns
 * - Dependency Inversion: Depends on shared query abstractions
 * 
 * Features:
 * - Paginated results for performance
 * - Status-based filtering (active, building, moving, etc.)
 * - Optional detailed stats inclusion
 * - Efficient DynamoDB querying with proper indexing
 * - Summary statistics (total bases, by status)
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return withErrorHandling(async () => {
    logger.info('Processing list bases request', { 
      requestId: event.requestContext?.requestId 
    });

    // Extract request from query parameters for GET request
    const request = extractListBasesRequest(event);
    
    // Validate the extracted request
    const validatedRequest = ListBasesRequestSchema.parse(request);
    
    // Get player bases with pagination
    const result = await getPlayerBases(validatedRequest);
    
    // Calculate summary statistics
    const summary = await calculateBaseSummary(validatedRequest.playerId);

    logger.info('Bases listed successfully', {
      playerId: validatedRequest.playerId,
      baseCount: result.bases.length,
      hasMore: !!result.lastEvaluatedKey
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          bases: result.bases,
          summary: summary,
          pagination: {
            limit: validatedRequest.limit,
            lastEvaluatedKey: result.lastEvaluatedKey,
            hasMore: !!result.lastEvaluatedKey
          }
        }
      })
    };
  }, logger);
};

function extractListBasesRequest(event: APIGatewayProxyEvent): ListBasesRequestInput {
  const queryParams = event.queryStringParameters ?? {};
  const pathParams = event.pathParameters ?? {};
  
  return {
    playerId: (pathParams.playerId ?? queryParams.playerId) ?? '',
    status: (queryParams.status as 'active' | 'building' | 'moving' | 'destroyed' | 'all') ?? 'all',
    limit: queryParams.limit ? parseInt(queryParams.limit) : 20,
    lastEvaluatedKey: queryParams.lastEvaluatedKey,
    includeStats: queryParams.includeStats !== 'false'
  };
}

async function getPlayerBases(request: ListBasesRequestInput): Promise<{
  bases: EnrichedPlayerBase[];
  lastEvaluatedKey?: string;
}> {
  try {
    const keyConditionExpression = 'playerId = :playerId';
    let filterExpression: string | undefined;
    
    const expressionAttributeValues: Record<string, unknown> = {
      ':playerId': request.playerId
    };

    const expressionAttributeNames: Record<string, string> = {};

    // Add status filtering if not 'all'
    if (request.status !== 'all') {
      filterExpression = '#status = :status';
      expressionAttributeValues[':status'] = request.status;
      expressionAttributeNames['#status'] = 'status';
    }

    // Prepare projection expression based on includeStats
    let projectionExpression: string | undefined;
    if (!request.includeStats) {
      projectionExpression = 'playerId, baseId, baseName, baseType, #level, coordinates, #status, createdAt, lastActiveAt';
      expressionAttributeNames['#level'] = 'level';
      expressionAttributeNames['#status'] = 'status'; // Needed for projection
    }

    const command = new QueryCommand({
      TableName: PLAYER_BASES_TABLE,
      KeyConditionExpression: keyConditionExpression,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ProjectionExpression: projectionExpression,
      Limit: request.limit,
      ExclusiveStartKey: request.lastEvaluatedKey ? JSON.parse(
        Buffer.from(request.lastEvaluatedKey, 'base64').toString()
      ) as Record<string, unknown> : undefined,
      ScanIndexForward: false // Most recent bases first
    });

    const response = await docClient.send(command);
    
    // Process and enrich the base data
    const bases = (response.Items ?? []).map(item => {
      // Type assertion to ensure we have the expected structure
      const base = item as Record<string, unknown> & {
        coordinates: { x: number; y: number };
        status: string;
        buildCompletionTime?: number;
        arrivalTime?: number;
        lastMovedAt?: number;
        createdAt: number;
      };
      
      return {
        ...base,
        // Add computed fields
        isActive: base.status === 'active',
        isUpgrading: Boolean(base.buildCompletionTime && base.buildCompletionTime > Date.now()),
        canMove: base.status === 'active' && (!base.lastMovedAt || 
          (Date.now() - base.lastMovedAt) >= (60 * 60 * 1000)), // 60 minute cooldown
        
        // Format coordinates for display
        location: `${base.coordinates.x}, ${base.coordinates.y}`,
        
        // Calculate age
        ageInDays: Math.floor((Date.now() - base.createdAt) / (24 * 60 * 60 * 1000)),
        
        // Status-specific information
        ...(base.status === 'building' && base.buildCompletionTime && {
          completionIn: Math.max(0, base.buildCompletionTime - Date.now())
        }),
        ...(base.status === 'moving' && base.arrivalTime && {
          arrivalIn: Math.max(0, base.arrivalTime - Date.now())
        })
      } as EnrichedPlayerBase;
    });

    // Encode pagination key
    const lastEvaluatedKey = response.LastEvaluatedKey ? 
      Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') : 
      undefined;

    return {
      bases: bases,
      lastEvaluatedKey: lastEvaluatedKey
    };

  } catch (error) {
    throw new GameEngineError(
      'Failed to retrieve player bases',
      'BASE_QUERY_ERROR',
      { playerId: request.playerId, error: (error as Error).message }
    );
  }
}

async function calculateBaseSummary(playerId: string): Promise<BaseSummary> {
  try {
    // Get all bases for summary statistics
    const command = new QueryCommand({
      TableName: PLAYER_BASES_TABLE,
      KeyConditionExpression: 'playerId = :playerId',
      ExpressionAttributeValues: {
        ':playerId': playerId
      },
      ProjectionExpression: '#status, baseType, #level, createdAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#level': 'level'
      }
    });

    const response = await docClient.send(command);
    const bases = (response.Items ?? []).map(item => item as Record<string, unknown> & {
      status: string;
      baseType: string;
      level?: number;
      createdAt: number;
    });

    // Calculate statistics
    const summary: BaseSummary = {
      totalBases: bases.length,
      activeBases: bases.filter(b => b.status === 'active').length,
      buildingBases: bases.filter(b => b.status === 'building').length,
      movingBases: bases.filter(b => b.status === 'moving').length,
      destroyedBases: bases.filter(b => b.status === 'destroyed').length,
      
      // Base type distribution
      baseTypes: bases.reduce((acc, base) => {
        acc[base.baseType] = (acc[base.baseType] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      
      // Level distribution
      averageLevel: bases.length > 0 ? 
        Math.round(bases.reduce((sum, base) => sum + (base.level ?? 1), 0) / bases.length * 10) / 10 : 0,
      maxLevel: bases.length > 0 ? Math.max(...bases.map(base => base.level ?? 1)) : 0,
      
      // TODO: Add subscription info (max bases allowed)
      maxBasesAllowed: 5, // Default for free players
      canCreateMore: bases.filter(b => b.status !== 'destroyed').length < 5,
      
      // Oldest and newest base
      oldestBase: bases.length > 0 ? Math.min(...bases.map(base => base.createdAt)) : null,
      newestBase: bases.length > 0 ? Math.max(...bases.map(base => base.createdAt)) : null
    };

    return summary;

  } catch (error) {
    // Return basic summary if detailed calculation fails
    logger.warn('Failed to calculate detailed base summary', { 
      playerId, 
      error: (error as Error).message 
    });
    
    return {
      totalBases: 0,
      activeBases: 0,
      buildingBases: 0,
      movingBases: 0,
      destroyedBases: 0,
      baseTypes: {},
      averageLevel: 0,
      maxLevel: 0,
      maxBasesAllowed: 5,
      canCreateMore: true,
      oldestBase: null,
      newestBase: null
    };
  }
}
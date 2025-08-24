import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { 
  StructuredLogger, 
  GameEngineError,
  withErrorHandling,
  validateRequest 
} from '../../lib/shared-mocks';
import { z } from 'zod';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const logger = new StructuredLogger('MoveBaseHandler');

const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

const MoveBaseRequestSchema = z.object({
  playerId: z.string().min(1).max(50),
  baseId: z.string().min(1).max(50),
  newCoordinates: z.object({
    x: z.number().min(-1000000).max(1000000),
    y: z.number().min(-1000000).max(1000000)
  }),
  useTeleport: z.boolean().optional().default(false) // Instant movement for gold
});

type MoveBaseRequest = z.infer<typeof MoveBaseRequestSchema>;

/**
 * Move Base Handler
 * 
 * Implements base movement system following SOLID principles:
 * - Single Responsibility: Only handles base relocation
 * - Open/Closed: Extensible for different movement types
 * - Liskov Substitution: All movement types follow same pattern
 * - Interface Segregation: Clear movement operation interface
 * - Dependency Inversion: Depends on shared game utilities
 * 
 * Game Mechanics:
 * - Validates movement cooldown (60 minutes default)
 * - Supports instant teleportation for gold cost
 * - Prevents movement to occupied coordinates
 * - Calculates travel time based on distance
 * - Updates map sectioning for efficient queries
 * - Implements movement restrictions near enemy bases
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return withErrorHandling(async () => {
    logger.info('Processing base movement request', { 
      requestId: event.requestContext?.requestId 
    });

    const request = await validateRequest<MoveBaseRequest>(MoveBaseRequestSchema, event.body);
    
    // Get current base state
    const currentBase = await getPlayerBase(request.playerId, request.baseId);
    
    // Validate movement is allowed
    await validateMovement(currentBase, request.newCoordinates, request.useTeleport);
    
    // Check destination is available
    await validateDestination(request.newCoordinates, request.baseId);
    
    // Calculate movement cost and time
    const movementDetails = calculateMovementDetails(currentBase, request.newCoordinates, request.useTeleport);
    
    // Execute the movement
    const result = await executeBaseMovement(request, currentBase, movementDetails);

    logger.info('Base movement processed', {
      playerId: request.playerId,
      baseId: request.baseId,
      fromCoordinates: currentBase.coordinates,
      toCoordinates: request.newCoordinates,
      teleport: request.useTeleport,
      travelTime: movementDetails.travelTime
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
          movement: result,
          message: request.useTeleport 
            ? 'Base teleported instantly' 
            : `Base movement initiated, arrival in ${Math.ceil(movementDetails.travelTime / 60)} minutes`
        }
      })
    };
  }, logger);
};

async function getPlayerBase(playerId: string, baseId: string): Promise<any> {
  try {
    const command = new GetCommand({
      TableName: PLAYER_BASES_TABLE,
      Key: { playerId, baseId }
    });

    const response = await docClient.send(command);
    
    if (!response.Item) {
      throw new GameEngineError(
        'Base not found',
        'BASE_NOT_FOUND',
        { playerId, baseId }
      );
    }

    const base = response.Item;
    
    if (base.status !== 'active') {
      throw new GameEngineError(
        `Cannot move base with status: ${base.status}`,
        'INVALID_BASE_STATUS',
        { playerId, baseId, status: base.status }
      );
    }

    return base;
  } catch (error) {
    if (error instanceof GameEngineError) throw error;
    throw new GameEngineError(
      'Failed to retrieve base',
      'BASE_RETRIEVAL_ERROR',
      { playerId, baseId, error: (error as Error).message }
    );
  }
}

async function validateMovement(
  base: any, 
  newCoordinates: { x: number; y: number }, 
  useTeleport: boolean
): Promise<void> {
  try {
    const now = Date.now();
    const cooldownPeriod = 60 * 60 * 1000; // 60 minutes in milliseconds
    
    // Check movement cooldown (unless using teleport)
    if (!useTeleport && base.lastMovedAt && (now - base.lastMovedAt) < cooldownPeriod) {
      const remainingCooldown = cooldownPeriod - (now - base.lastMovedAt);
      throw new GameEngineError(
        'Base movement on cooldown',
        'MOVEMENT_COOLDOWN',
        { 
          baseId: base.baseId, 
          remainingMinutes: Math.ceil(remainingCooldown / (60 * 1000))
        }
      );
    }

    // Validate coordinates are different
    if (base.coordinates.x === newCoordinates.x && base.coordinates.y === newCoordinates.y) {
      throw new GameEngineError(
        'New coordinates must be different from current location',
        'SAME_COORDINATES',
        { currentCoordinates: base.coordinates, newCoordinates }
      );
    }

    // Validate movement distance (max 1000 units for normal movement)
    if (!useTeleport) {
      const distance = calculateDistance(base.coordinates, newCoordinates);
      const maxDistance = 1000;
      
      if (distance > maxDistance) {
        throw new GameEngineError(
          `Movement distance exceeds maximum (${maxDistance} units)`,
          'DISTANCE_TOO_FAR',
          { distance, maxDistance, coordinates: { from: base.coordinates, to: newCoordinates } }
        );
      }
    }

  } catch (error) {
    if (error instanceof GameEngineError) throw error;
    throw new GameEngineError(
      'Movement validation failed',
      'MOVEMENT_VALIDATION_ERROR',
      { baseId: base.baseId, error: (error as Error).message }
    );
  }
}

async function validateDestination(
  coordinates: { x: number; y: number }, 
  excludeBaseId: string
): Promise<void> {
  try {
    const coordinateHash = `${coordinates.x},${coordinates.y}`;
    
    // Check if coordinates are occupied by another base
    const command = new QueryCommand({
      TableName: PLAYER_BASES_TABLE,
      IndexName: 'LocationIndex',
      KeyConditionExpression: 'mapSectionId = :sectionId AND coordinateHash = :coordHash',
      ExpressionAttributeValues: {
        ':sectionId': `${Math.floor(coordinates.x / 100)},${Math.floor(coordinates.y / 100)}`,
        ':coordHash': coordinateHash,
        ':excludeBaseId': excludeBaseId,
        ':destroyed': 'destroyed'
      },
      FilterExpression: 'baseId <> :excludeBaseId AND #status <> :destroyed',
      ExpressionAttributeNames: {
        '#status': 'status'
      }
    });

    const response = await docClient.send(command);
    
    if (response.Items && response.Items.length > 0) {
      throw new GameEngineError(
        'Destination coordinates are occupied',
        'COORDINATES_OCCUPIED',
        { coordinates, occupiedBy: response.Items[0].baseId }
      );
    }

    // TODO: Add validation for restricted zones, enemy alliance territories, etc.
    
  } catch (error) {
    if (error instanceof GameEngineError) throw error;
    throw new GameEngineError(
      'Destination validation failed',
      'DESTINATION_VALIDATION_ERROR',
      { coordinates, error: (error as Error).message }
    );
  }
}

function calculateMovementDetails(
  base: any, 
  newCoordinates: { x: number; y: number }, 
  useTeleport: boolean
): { travelTime: number; goldCost?: number; distance: number } {
  const distance = calculateDistance(base.coordinates, newCoordinates);
  
  if (useTeleport) {
    // Instant teleportation with gold cost
    const goldCost = Math.max(50, Math.ceil(distance / 10)); // 1 gold per 10 units, minimum 50
    return {
      travelTime: 0,
      goldCost: goldCost,
      distance: distance
    };
  } else {
    // Calculate travel time: 1 minute per unit distance (minimum 5 minutes)
    const travelTime = Math.max(300, distance * 60); // seconds
    return {
      travelTime: travelTime,
      distance: distance
    };
  }
}

function calculateDistance(
  from: { x: number; y: number }, 
  to: { x: number; y: number }
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

async function executeBaseMovement(
  request: MoveBaseRequest,
  base: any,
  movementDetails: { travelTime: number; goldCost?: number; distance: number }
): Promise<any> {
  try {
    const now = Date.now();
    const arrivalTime = now + (movementDetails.travelTime * 1000);
    
    // Calculate new map section
    const newMapSectionId = `${Math.floor(request.newCoordinates.x / 100)},${Math.floor(request.newCoordinates.y / 100)}`;
    const newCoordinateHash = `${request.newCoordinates.x},${request.newCoordinates.y}`;
    
    const updateExpression = request.useTeleport
      ? 'SET coordinates = :newCoords, mapSectionId = :newSection, coordinateHash = :newHash, lastMovedAt = :now, lastActiveAt = :now'
      : 'SET coordinates = :newCoords, mapSectionId = :newSection, coordinateHash = :newHash, #status = :moving, lastMovedAt = :now, lastActiveAt = :now, arrivalTime = :arrivalTime';
    
    const expressionAttributeNames: Record<string, string> = request.useTeleport ? {} : { '#status': 'status' };
    const expressionAttributeValues: Record<string, any> = {
      ':newCoords': request.newCoordinates,
      ':newSection': newMapSectionId,
      ':newHash': newCoordinateHash,
      ':now': now
    };

    if (!request.useTeleport) {
      expressionAttributeValues[':moving'] = 'moving';
      expressionAttributeValues[':arrivalTime'] = arrivalTime;
    }

    const command = new UpdateCommand({
      TableName: PLAYER_BASES_TABLE,
      Key: {
        playerId: request.playerId,
        baseId: request.baseId
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });

    const response = await docClient.send(command);

    // TODO: If teleport, deduct gold cost from player resources (integrate with resource service)

    return {
      baseId: request.baseId,
      newCoordinates: request.newCoordinates,
      status: request.useTeleport ? 'active' : 'moving',
      arrivalTime: request.useTeleport ? now : arrivalTime,
      goldCost: movementDetails.goldCost,
      distance: movementDetails.distance
    };

  } catch (error) {
    throw new GameEngineError(
      'Failed to execute base movement',
      'MOVEMENT_EXECUTION_ERROR',
      { 
        playerId: request.playerId, 
        baseId: request.baseId,
        error: (error as Error).message 
      }
    );
  }
}
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { 
  StructuredLogger, 
  GameEngineError,
  withErrorHandling 
} from '../../lib/shared-mocks';
import { 
  PlayerBase, 
  EnrichedPlayerBase
} from '../types/game-base-types';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const logger = new StructuredLogger('GetBaseDetailsHandler');

const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE ?? '';
const BASE_UPGRADES_TABLE = process.env.BASE_UPGRADES_TABLE ?? '';

/**
 * Get Base Details Handler
 * 
 * Provides comprehensive base information following SOLID principles:
 * - Single Responsibility: Only handles detailed base information retrieval
 * - Open/Closed: Extensible for additional detail types
 * - Liskov Substitution: Consistent detail interface for all base types
 * - Interface Segregation: Focused on specific base detail needs
 * - Dependency Inversion: Depends on shared data access patterns
 * 
 * Features:
 * - Complete base information with all stats
 * - Active upgrade information
 * - Movement status and timing
 * - Historical upgrade information
 * - Territory and alliance context
 * - Resource production calculations
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return withErrorHandling(async () => {
    logger.info('Processing get base details request', { 
      requestId: event.requestContext?.requestId 
    });

    // Extract parameters from path
    const playerId = event.pathParameters?.playerId;
    const baseId = event.pathParameters?.baseId;

    if (!playerId || !baseId) {
      throw new GameEngineError(
        'Missing required parameters: playerId and baseId',
        'INVALID_PARAMETERS',
        { playerId, baseId }
      );
    }

    // Get base details
    const baseDetails = await getBaseDetails(playerId, baseId);
    
    // Get active upgrades
    const activeUpgrades = await getActiveUpgrades(playerId, baseId);
    
    // Calculate additional metrics
    const metrics = calculateBaseMetrics(baseDetails, activeUpgrades);

    logger.info('Base details retrieved successfully', {
      playerId,
      baseId,
      baseType: baseDetails.baseType,
      status: baseDetails.status
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
          base: baseDetails,
          activeUpgrades: activeUpgrades,
          metrics: metrics
        }
      })
    };
  }, logger);
};

async function getBaseDetails(playerId: string, baseId: string): Promise<EnrichedPlayerBase> {
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

    const base = response.Item as PlayerBase;
    
    // Enrich base data with computed fields
    const enrichedBase = {
      ...base,
      
      // Status information
      isActive: base.status === 'active',
      isBuilding: base.status === 'building',
      isMoving: base.status === 'moving',
      isDestroyed: base.status === 'destroyed',
      
      // Timing information
      ageInDays: Math.floor((Date.now() - base.createdAt) / (24 * 60 * 60 * 1000)),
      lastActiveHours: Math.floor((Date.now() - base.lastActiveAt) / (60 * 60 * 1000)),
      
      // Coordinate information
      location: `${base.coordinates.x}, ${base.coordinates.y}`,
      mapSection: base.mapSectionId,
      
      // Movement information
      canMove: base.status === 'active' && (!base.lastMovedAt || 
        (Date.now() - base.lastMovedAt) >= (60 * 60 * 1000)),
      movementCooldownRemaining: base.lastMovedAt ? 
        Math.max(0, (60 * 60 * 1000) - (Date.now() - base.lastMovedAt)) : 0,
      
      // Building/Movement completion times
      ...(base.status === 'building' && base.buildCompletionTime && {
        buildingCompletesIn: Math.max(0, base.buildCompletionTime - Date.now()),
        buildingCompletesAt: new Date(base.buildCompletionTime).toISOString()
      }),
      
      ...(base.status === 'moving' && base.arrivalTime && {
        arrivalIn: Math.max(0, base.arrivalTime - Date.now()),
        arrivalAt: new Date(base.arrivalTime).toISOString()
      }),
      
      // Resource production (calculated based on base stats)
      resourceProduction: {
        gold: calculateGoldProduction(base),
        food: calculateFoodProduction(base),
        materials: calculateMaterialsProduction(base),
        energy: calculateEnergyProduction(base)
      },
      
      // Defense calculations
      defenseRating: calculateDefenseRating(base),
      
      // Storage information
      storageCapacity: base.stats?.storage ?? 0,
      
      // Alliance context
      ...(base.allianceId && {
        allianceId: base.allianceId,
        // TODO: Get alliance name and other details from alliance service
      })
    };

    return enrichedBase as unknown as EnrichedPlayerBase;

  } catch (error) {
    if (error instanceof GameEngineError) throw error;
    throw new GameEngineError(
      'Failed to retrieve base details',
      'BASE_RETRIEVAL_ERROR',
      { playerId, baseId, error: (error as Error).message }
    );
  }
}

async function getActiveUpgrades(playerId: string, baseId: string): Promise<unknown[]> {
  try {
    const command = new QueryCommand({
      TableName: BASE_UPGRADES_TABLE,
      KeyConditionExpression: 'playerId = :playerId',
      FilterExpression: 'baseId = :baseId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':playerId': playerId,
        ':baseId': baseId,
        ':status': 'in_progress'
      },
      ScanIndexForward: false // Most recent first
    });

    const response = await docClient.send(command);
    
    return (response.Items ?? []).map(upgrade => ({
      ...upgrade,
      
      // Timing information
      completesIn: Math.max(0, (upgrade as Record<string, unknown>).completionTime as number - Date.now()),
      completesAt: new Date((upgrade as Record<string, unknown>).completionTime as number).toISOString(),
      progress: Math.min(1, (Date.now() - ((upgrade as Record<string, unknown>).startedAt as number)) / (((upgrade as Record<string, unknown>).completionTime as number) - ((upgrade as Record<string, unknown>).startedAt as number))),
      
      // Upgrade details
      levelChange: `${String((upgrade as Record<string, unknown>).fromLevel)} → ${String((upgrade as Record<string, unknown>).toLevel)}`,
      timeRemaining: Math.max(0, (upgrade as Record<string, unknown>).completionTime as number - Date.now())
    }));

  } catch (error) {
    logger.warn('Failed to retrieve active upgrades', { 
      playerId, 
      baseId, 
      error: (error as Error).message 
    });
    return [];
  }
}

function calculateBaseMetrics(base: PlayerBase, activeUpgrades: unknown[]): Record<string, unknown> {
  const now = Date.now();
  
  return {
    // Overall base score (composite metric)
    baseScore: calculateBaseScore(base),
    
    // Efficiency metrics
    efficiency: {
      productionEfficiency: calculateProductionEfficiency(base),
      defenseEfficiency: calculateDefenseEfficiency(base),
      storageEfficiency: calculateStorageEfficiency(base)
    },
    
    // Activity metrics
    activity: {
      lastActiveHours: Math.floor((now - base.lastActiveAt) / (60 * 60 * 1000)),
      totalUpgrades: activeUpgrades.length,
      isActivelyDeveloping: activeUpgrades.length > 0 || 
        (base.lastActiveAt && (now - base.lastActiveAt) < (24 * 60 * 60 * 1000))
    },
    
    // Strategic metrics
    strategic: {
      territoryValue: calculateTerritoryValue(base),
      defensivePosition: calculateDefensivePosition(base),
      resourceAccessibility: calculateResourceAccessibility(base)
    },
    
    // Recommendations
    recommendations: generateRecommendations(base, activeUpgrades)
  };
}

// Calculation helper functions
function calculateGoldProduction(base: PlayerBase): number {
  const baseProduction = base.stats?.production ?? 0;
  const levelMultiplier = 1 + (base.level * 0.1);
  return Math.floor(baseProduction * levelMultiplier * 0.4); // 40% of production goes to gold
}

function calculateFoodProduction(base: PlayerBase): number {
  const baseProduction = base.stats?.production ?? 0;
  const levelMultiplier = 1 + (base.level * 0.1);
  return Math.floor(baseProduction * levelMultiplier * 0.3); // 30% to food
}

function calculateMaterialsProduction(base: PlayerBase): number {
  const baseProduction = base.stats?.production ?? 0;
  const levelMultiplier = 1 + (base.level * 0.1);
  return Math.floor(baseProduction * levelMultiplier * 0.2); // 20% to materials
}

function calculateEnergyProduction(base: PlayerBase): number {
  const baseProduction = base.stats?.production ?? 0;
  const levelMultiplier = 1 + (base.level * 0.1);
  return Math.floor(baseProduction * levelMultiplier * 0.1); // 10% to energy
}

function calculateDefenseRating(base: PlayerBase): string {
  const defense = base.stats?.defense ?? 0;
  if (defense < 50) return 'Weak';
  if (defense < 150) return 'Moderate';
  if (defense < 300) return 'Strong';
  if (defense < 500) return 'Fortified';
  return 'Impenetrable';
}

function calculateBaseScore(base: PlayerBase): number {
  const level = base.level || 1;
  const stats = base.stats || {};
  const defense = stats.defense ?? 0;
  const production = stats.production ?? 0;
  const storage = stats.storage ?? 0;
  
  return Math.floor((level * 100) + (defense * 0.5) + (production * 2) + (storage * 0.1));
}

function calculateProductionEfficiency(base: PlayerBase): number {
  const expectedProduction = base.level * 50; // Expected production per level
  const actualProduction = base.stats?.production ?? 0;
  return Math.min(1, actualProduction / expectedProduction);
}

function calculateDefenseEfficiency(base: PlayerBase): number {
  const expectedDefense = base.level * 30; // Expected defense per level
  const actualDefense = base.stats?.defense ?? 0;
  return Math.min(1, actualDefense / expectedDefense);
}

function calculateStorageEfficiency(base: PlayerBase): number {
  const expectedStorage = base.level * 200; // Expected storage per level
  const actualStorage = base.stats?.storage ?? 0;
  return Math.min(1, actualStorage / expectedStorage);
}

function calculateTerritoryValue(base: PlayerBase): number {
  // Simple territory value based on coordinates (closer to center = higher value)
  const distanceFromCenter = Math.sqrt(base.coordinates.x ** 2 + base.coordinates.y ** 2);
  return Math.max(0.1, 1 - (distanceFromCenter / 10000));
}

function calculateDefensivePosition(base: PlayerBase): string {
  const x = Math.abs(base.coordinates.x);
  const y = Math.abs(base.coordinates.y);
  
  if (x < 100 && y < 100) return 'Central Hub';
  if (x > 1000 || y > 1000) return 'Remote Outpost';
  return 'Standard Position';
}

function calculateResourceAccessibility(_base: PlayerBase): number {
  // Simplified calculation based on map position
  // TODO: Integrate with actual resource node locations
  return Math.random() * 0.4 + 0.6; // Random between 0.6-1.0 for now
}

function generateRecommendations(base: PlayerBase, activeUpgrades: unknown[]): string[] {
  const recommendations: string[] = [];
  
  if (base.level < 5) {
    recommendations.push('Consider upgrading base level for improved stats');
  }
  
  if (base.stats?.defense < base.level * 20) {
    recommendations.push('Defense is below recommended level - consider defensive upgrades');
  }
  
  if (base.stats?.production < base.level * 40) {
    recommendations.push('Production could be improved with resource upgrades');
  }
  
  if (activeUpgrades.length === 0 && base.status === 'active') {
    recommendations.push('Base is idle - consider starting an upgrade');
  }
  
  if (!base.allianceId) {
    recommendations.push('Joining an alliance provides strategic advantages');
  }
  
  const timeSinceMove = base.lastMovedAt ? Date.now() - base.lastMovedAt : Infinity;
  if (timeSinceMove > (30 * 24 * 60 * 60 * 1000)) { // 30 days
    recommendations.push('Consider relocating for better strategic positioning');
  }
  
  return recommendations;
}
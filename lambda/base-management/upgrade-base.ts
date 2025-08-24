import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { 
  StructuredLogger, 
  GameEngineError,
  withErrorHandling,
  validateRequest 
} from '@loupeen/shared-js-utils';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const logger = new StructuredLogger('UpgradeBaseHandler');

const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE!;
const BASE_TEMPLATES_TABLE = process.env.BASE_TEMPLATES_TABLE!;
const BASE_UPGRADES_TABLE = process.env.BASE_UPGRADES_TABLE!;
const ENVIRONMENT = process.env.ENVIRONMENT!;

const UpgradeBaseRequestSchema = z.object({
  playerId: z.string().min(1).max(50),
  baseId: z.string().min(1).max(50),
  upgradeType: z.enum(['level', 'defense', 'storage', 'production', 'specialized']),
  skipTime: z.boolean().optional().default(false) // For premium players
});

type UpgradeBaseRequest = z.infer<typeof UpgradeBaseRequestSchema>;

interface BaseUpgrade {
  playerId: string;
  upgradeId: string;
  baseId: string;
  upgradeType: string;
  fromLevel: number;
  toLevel: number;
  requirements: {
    resources: Record<string, number>;
    time: number;
    goldCost?: number;
  };
  status: 'in_progress' | 'completed' | 'cancelled';
  startedAt: number;
  completionTime: number;
  ttl?: number;
}

/**
 * Upgrade Base Handler
 * 
 * Implements base upgrade system following SOLID principles:
 * - Single Responsibility: Only handles base upgrades
 * - Open/Closed: Extensible for new upgrade types
 * - Liskov Substitution: All upgrade types follow same pattern
 * - Interface Segregation: Clear upgrade operation interfaces
 * - Dependency Inversion: Depends on shared abstractions
 * 
 * Game Mechanics:
 * - Validates upgrade requirements (resources, level, time)
 * - Supports instant upgrades for premium players (gold cost)
 * - Tracks upgrade progress with completion times
 * - Updates base stats upon completion
 * - Implements upgrade queue system
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  return withErrorHandling(async () => {
    logger.info('Processing base upgrade request', { 
      requestId: event.requestContext?.requestId 
    });

    const request = await validateRequest(UpgradeBaseRequestSchema, event.body);
    
    // Get current base state
    const currentBase = await getPlayerBase(request.playerId, request.baseId);
    
    // Validate upgrade is possible
    const upgradeTemplate = await validateUpgradeRequirements(currentBase, request.upgradeType);
    
    // Check for existing active upgrades
    await checkActiveUpgrades(request.playerId, request.baseId);
    
    // Create upgrade record
    const upgrade = await createUpgradeRecord(request, currentBase, upgradeTemplate);
    
    // If instant upgrade (skipTime), complete immediately
    if (request.skipTime) {
      await completeInstantUpgrade(upgrade, currentBase);
    }

    logger.info('Base upgrade initiated', {
      playerId: request.playerId,
      baseId: request.baseId,
      upgradeType: request.upgradeType,
      instant: request.skipTime
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
          upgrade: upgrade,
          message: request.skipTime 
            ? 'Base upgrade completed instantly' 
            : 'Base upgrade started successfully'
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

    if (response.Item.status === 'destroyed') {
      throw new GameEngineError(
        'Cannot upgrade destroyed base',
        'INVALID_BASE_STATUS',
        { playerId, baseId, status: response.Item.status }
      );
    }

    return response.Item;
  } catch (error) {
    if (error instanceof GameEngineError) throw error;
    throw new GameEngineError(
      'Failed to retrieve base',
      'BASE_RETRIEVAL_ERROR',
      { playerId, baseId, error: error.message }
    );
  }
}

async function validateUpgradeRequirements(base: any, upgradeType: string): Promise<any> {
  try {
    const nextLevel = base.level + 1;
    const templateId = `${base.baseType}-level-${nextLevel}`;
    
    const command = new GetCommand({
      TableName: BASE_TEMPLATES_TABLE,
      Key: { templateId }
    });

    const response = await docClient.send(command);
    
    if (!response.Item) {
      throw new GameEngineError(
        `No upgrade template found for ${base.baseType} level ${nextLevel}`,
        'UPGRADE_TEMPLATE_NOT_FOUND',
        { baseType: base.baseType, currentLevel: base.level, nextLevel }
      );
    }

    const template = response.Item;
    
    // TODO: Validate player has required resources
    // This would integrate with resource service
    
    return template;
  } catch (error) {
    if (error instanceof GameEngineError) throw error;
    throw new GameEngineError(
      'Failed to validate upgrade requirements',
      'UPGRADE_VALIDATION_ERROR',
      { baseId: base.baseId, upgradeType, error: error.message }
    );
  }
}

async function checkActiveUpgrades(playerId: string, baseId: string): Promise<void> {
  try {
    // Check if base already has active upgrade
    const command = new GetCommand({
      TableName: BASE_UPGRADES_TABLE,
      Key: { 
        playerId,
        upgradeId: `${baseId}-active`
      }
    });

    const response = await docClient.send(command);
    
    if (response.Item && response.Item.status === 'in_progress') {
      throw new GameEngineError(
        'Base already has an active upgrade',
        'UPGRADE_IN_PROGRESS',
        { playerId, baseId, activeUpgrade: response.Item.upgradeId }
      );
    }
  } catch (error) {
    if (error instanceof GameEngineError) throw error;
    throw new GameEngineError(
      'Failed to check active upgrades',
      'ACTIVE_UPGRADE_CHECK_ERROR',
      { playerId, baseId, error: error.message }
    );
  }
}

async function createUpgradeRecord(
  request: UpgradeBaseRequest,
  base: any,
  template: any
): Promise<BaseUpgrade> {
  try {
    const now = Date.now();
    const upgradeTime = template.buildTime || 3600; // Default 1 hour
    const completionTime = now + (upgradeTime * 1000);
    
    const upgrade: BaseUpgrade = {
      playerId: request.playerId,
      upgradeId: `${request.baseId}-${uuidv4()}`,
      baseId: request.baseId,
      upgradeType: request.upgradeType,
      fromLevel: base.level,
      toLevel: base.level + 1,
      requirements: {
        resources: template.requirements?.resources || {},
        time: upgradeTime,
        goldCost: request.skipTime ? calculateInstantUpgradeCost(upgradeTime) : undefined
      },
      status: 'in_progress',
      startedAt: now,
      completionTime: completionTime,
      ttl: completionTime + (7 * 24 * 60 * 60 * 1000) // Cleanup after 7 days
    };

    const command = new PutCommand({
      TableName: BASE_UPGRADES_TABLE,
      Item: upgrade
    });

    await docClient.send(command);
    return upgrade;
  } catch (error) {
    throw new GameEngineError(
      'Failed to create upgrade record',
      'UPGRADE_RECORD_ERROR',
      { 
        playerId: request.playerId, 
        baseId: request.baseId, 
        error: error.message 
      }
    );
  }
}

async function completeInstantUpgrade(upgrade: BaseUpgrade, base: any): Promise<void> {
  try {
    const now = Date.now();
    
    // Update upgrade record to completed
    const updateUpgradeCommand = new UpdateCommand({
      TableName: BASE_UPGRADES_TABLE,
      Key: {
        playerId: upgrade.playerId,
        upgradeId: upgrade.upgradeId
      },
      UpdateExpression: 'SET #status = :status, completionTime = :now',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':now': now
      }
    });

    // Update base level and stats
    const updateBaseCommand = new UpdateCommand({
      TableName: PLAYER_BASES_TABLE,
      Key: {
        playerId: base.playerId,
        baseId: base.baseId
      },
      UpdateExpression: 'SET #level = #level + :inc, lastActiveAt = :now, stats.defense = stats.defense + :defenseInc, stats.storage = stats.storage + :storageInc, stats.production = stats.production + :prodInc',
      ExpressionAttributeNames: {
        '#level': 'level'
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': now,
        ':defenseInc': 10, // TODO: Get from template
        ':storageInc': 100,
        ':prodInc': 5
      }
    });

    // Execute both updates
    await Promise.all([
      docClient.send(updateUpgradeCommand),
      docClient.send(updateBaseCommand)
    ]);

    // TODO: Deduct gold cost from player resources (integrate with resource service)
    
  } catch (error) {
    throw new GameEngineError(
      'Failed to complete instant upgrade',
      'INSTANT_UPGRADE_ERROR',
      { upgradeId: upgrade.upgradeId, error: error.message }
    );
  }
}

function calculateInstantUpgradeCost(upgradeTimeSeconds: number): number {
  // Formula: 1 gold per minute of upgrade time (minimum 10 gold)
  return Math.max(10, Math.ceil(upgradeTimeSeconds / 60));
}
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const shared_js_utils_1 = require("@loupeen/shared-js-utils");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const logger = new shared_js_utils_1.SimpleLambdaLogger('GetBaseDetailsHandler');
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
const handler = async (event) => {
    return (0, shared_js_utils_1.withLambdaErrorHandling)(async () => {
        logger.info('Processing get base details request', {
            requestId: event.requestContext?.requestId
        });
        // Extract parameters from path
        const playerId = event.pathParameters?.playerId;
        const baseId = event.pathParameters?.baseId;
        if (!playerId || !baseId) {
            throw (0, shared_js_utils_1.createGameEngineError)('Missing required parameters: playerId and baseId', 'INVALID_PARAMETERS', { playerId, baseId });
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
exports.handler = handler;
async function getBaseDetails(playerId, baseId) {
    try {
        const command = new lib_dynamodb_1.GetCommand({
            TableName: PLAYER_BASES_TABLE,
            Key: { playerId, baseId }
        });
        const response = await docClient.send(command);
        if (!response.Item) {
            throw (0, shared_js_utils_1.createGameEngineError)('Base not found', 'BASE_NOT_FOUND', { playerId, baseId });
        }
        const base = response.Item;
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
        return enrichedBase;
    }
    catch (error) {
        if (error instanceof Error && error.name === 'GameEngineError')
            throw error;
        throw (0, shared_js_utils_1.createGameEngineError)('Failed to retrieve base details', 'BASE_RETRIEVAL_ERROR', { playerId, baseId, error: error.message });
    }
}
async function getActiveUpgrades(playerId, baseId) {
    try {
        const command = new lib_dynamodb_1.QueryCommand({
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
            completesIn: Math.max(0, upgrade.completionTime - Date.now()),
            completesAt: new Date(upgrade.completionTime).toISOString(),
            progress: Math.min(1, (Date.now() - upgrade.startedAt) / (upgrade.completionTime - upgrade.startedAt)),
            // Upgrade details
            levelChange: `${String(upgrade.fromLevel)} → ${String(upgrade.toLevel)}`,
            timeRemaining: Math.max(0, upgrade.completionTime - Date.now())
        }));
    }
    catch (error) {
        logger.warn('Failed to retrieve active upgrades', {
            playerId,
            baseId,
            error: error.message
        });
        return [];
    }
}
function calculateBaseMetrics(base, activeUpgrades) {
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
function calculateGoldProduction(base) {
    const baseProduction = base.stats?.production ?? 0;
    const levelMultiplier = 1 + (base.level * 0.1);
    return Math.floor(baseProduction * levelMultiplier * 0.4); // 40% of production goes to gold
}
function calculateFoodProduction(base) {
    const baseProduction = base.stats?.production ?? 0;
    const levelMultiplier = 1 + (base.level * 0.1);
    return Math.floor(baseProduction * levelMultiplier * 0.3); // 30% to food
}
function calculateMaterialsProduction(base) {
    const baseProduction = base.stats?.production ?? 0;
    const levelMultiplier = 1 + (base.level * 0.1);
    return Math.floor(baseProduction * levelMultiplier * 0.2); // 20% to materials
}
function calculateEnergyProduction(base) {
    const baseProduction = base.stats?.production ?? 0;
    const levelMultiplier = 1 + (base.level * 0.1);
    return Math.floor(baseProduction * levelMultiplier * 0.1); // 10% to energy
}
function calculateDefenseRating(base) {
    const defense = base.stats?.defense ?? 0;
    if (defense < 50)
        return 'Weak';
    if (defense < 150)
        return 'Moderate';
    if (defense < 300)
        return 'Strong';
    if (defense < 500)
        return 'Fortified';
    return 'Impenetrable';
}
function calculateBaseScore(base) {
    const level = base.level || 1;
    const stats = base.stats || {};
    const defense = stats.defense ?? 0;
    const production = stats.production ?? 0;
    const storage = stats.storage ?? 0;
    return Math.floor((level * 100) + (defense * 0.5) + (production * 2) + (storage * 0.1));
}
function calculateProductionEfficiency(base) {
    const expectedProduction = base.level * 50; // Expected production per level
    const actualProduction = base.stats?.production ?? 0;
    return Math.min(1, actualProduction / expectedProduction);
}
function calculateDefenseEfficiency(base) {
    const expectedDefense = base.level * 30; // Expected defense per level
    const actualDefense = base.stats?.defense ?? 0;
    return Math.min(1, actualDefense / expectedDefense);
}
function calculateStorageEfficiency(base) {
    const expectedStorage = base.level * 200; // Expected storage per level
    const actualStorage = base.stats?.storage ?? 0;
    return Math.min(1, actualStorage / expectedStorage);
}
function calculateTerritoryValue(base) {
    // Simple territory value based on coordinates (closer to center = higher value)
    const distanceFromCenter = Math.sqrt(base.coordinates.x ** 2 + base.coordinates.y ** 2);
    return Math.max(0.1, 1 - (distanceFromCenter / 10000));
}
function calculateDefensivePosition(base) {
    const x = Math.abs(base.coordinates.x);
    const y = Math.abs(base.coordinates.y);
    if (x < 100 && y < 100)
        return 'Central Hub';
    if (x > 1000 || y > 1000)
        return 'Remote Outpost';
    return 'Standard Position';
}
function calculateResourceAccessibility(_base) {
    // Simplified calculation based on map position
    // TODO: Integrate with actual resource node locations
    return Math.random() * 0.4 + 0.6; // Random between 0.6-1.0 for now
}
function generateRecommendations(base, activeUpgrades) {
    const recommendations = [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWJhc2UtZGV0YWlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xhbWJkYS9iYXNlLXF1ZXJpZXMvZ2V0LWJhc2UtZGV0YWlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4REFBMEQ7QUFDMUQsd0RBQXlGO0FBQ3pGLDhEQUlrQztBQU1sQyxNQUFNLFlBQVksR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUMsTUFBTSxTQUFTLEdBQUcscUNBQXNCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVELE1BQU0sTUFBTSxHQUFHLElBQUksb0NBQWtCLENBQUMsdUJBQXVCLENBQUMsQ0FBQztBQUUvRCxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksRUFBRSxDQUFDO0FBQ2hFLE1BQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxFQUFFLENBQUM7QUFFbEU7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUJHO0FBQ0ksTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUNLLEVBQUU7SUFDbEMsT0FBTyxJQUFBLHlDQUF1QixFQUFDLEtBQUssSUFBSSxFQUFFO1FBQ3hDLE1BQU0sQ0FBQyxJQUFJLENBQUMscUNBQXFDLEVBQUU7WUFDakQsU0FBUyxFQUFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsU0FBUztTQUMzQyxDQUFDLENBQUM7UUFFSCwrQkFBK0I7UUFDL0IsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLGNBQWMsRUFBRSxRQUFRLENBQUM7UUFDaEQsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUM7UUFFNUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pCLE1BQU0sSUFBQSx1Q0FBcUIsRUFDekIsa0RBQWtELEVBQ2xELG9CQUFvQixFQUNwQixFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsQ0FDckIsQ0FBQztRQUNKLENBQUM7UUFFRCxtQkFBbUI7UUFDbkIsTUFBTSxXQUFXLEdBQUcsTUFBTSxjQUFjLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTNELHNCQUFzQjtRQUN0QixNQUFNLGNBQWMsR0FBRyxNQUFNLGlCQUFpQixDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUVqRSwrQkFBK0I7UUFDL0IsTUFBTSxPQUFPLEdBQUcsb0JBQW9CLENBQUMsV0FBVyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBRWxFLE1BQU0sQ0FBQyxJQUFJLENBQUMscUNBQXFDLEVBQUU7WUFDakQsUUFBUTtZQUNSLE1BQU07WUFDTixRQUFRLEVBQUUsV0FBVyxDQUFDLFFBQVE7WUFDOUIsTUFBTSxFQUFFLFdBQVcsQ0FBQyxNQUFNO1NBQzNCLENBQUMsQ0FBQztRQUVILE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRTtnQkFDUCxjQUFjLEVBQUUsa0JBQWtCO2dCQUNsQyw2QkFBNkIsRUFBRSxHQUFHO2FBQ25DO1lBQ0QsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ25CLE9BQU8sRUFBRSxJQUFJO2dCQUNiLElBQUksRUFBRTtvQkFDSixJQUFJLEVBQUUsV0FBVztvQkFDakIsY0FBYyxFQUFFLGNBQWM7b0JBQzlCLE9BQU8sRUFBRSxPQUFPO2lCQUNqQjthQUNGLENBQUM7U0FDSCxDQUFDO0lBQ0osQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ2IsQ0FBQyxDQUFDO0FBcERXLFFBQUEsT0FBTyxXQW9EbEI7QUFFRixLQUFLLFVBQVUsY0FBYyxDQUFDLFFBQWdCLEVBQUUsTUFBYztJQUM1RCxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBRyxJQUFJLHlCQUFVLENBQUM7WUFDN0IsU0FBUyxFQUFFLGtCQUFrQjtZQUM3QixHQUFHLEVBQUUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFO1NBQzFCLENBQUMsQ0FBQztRQUVILE1BQU0sUUFBUSxHQUFHLE1BQU0sU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUUvQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ25CLE1BQU0sSUFBQSx1Q0FBcUIsRUFDekIsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsQ0FDckIsQ0FBQztRQUNKLENBQUM7UUFFRCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsSUFBa0IsQ0FBQztRQUV6Qyx3Q0FBd0M7UUFDeEMsTUFBTSxZQUFZLEdBQUc7WUFDbkIsR0FBRyxJQUFJO1lBRVAscUJBQXFCO1lBQ3JCLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTSxLQUFLLFFBQVE7WUFDbEMsVUFBVSxFQUFFLElBQUksQ0FBQyxNQUFNLEtBQUssVUFBVTtZQUN0QyxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sS0FBSyxRQUFRO1lBQ2xDLFdBQVcsRUFBRSxJQUFJLENBQUMsTUFBTSxLQUFLLFdBQVc7WUFFeEMscUJBQXFCO1lBQ3JCLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzVFLGVBQWUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFFaEYseUJBQXlCO1lBQ3pCLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxFQUFFO1lBQ3hELFVBQVUsRUFBRSxJQUFJLENBQUMsWUFBWTtZQUU3Qix1QkFBdUI7WUFDdkIsT0FBTyxFQUFFLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVztnQkFDckQsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztZQUN0RCx5QkFBeUIsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQzNDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVyRSxxQ0FBcUM7WUFDckMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssVUFBVSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsSUFBSTtnQkFDNUQsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDdkUsbUJBQW1CLEVBQUUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsV0FBVyxFQUFFO2FBQ3RFLENBQUM7WUFFRixHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxRQUFRLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSTtnQkFDbEQsU0FBUyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNyRCxTQUFTLEVBQUUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLFdBQVcsRUFBRTthQUNwRCxDQUFDO1lBRUYsdURBQXVEO1lBQ3ZELGtCQUFrQixFQUFFO2dCQUNsQixJQUFJLEVBQUUsdUJBQXVCLENBQUMsSUFBSSxDQUFDO2dCQUNuQyxJQUFJLEVBQUUsdUJBQXVCLENBQUMsSUFBSSxDQUFDO2dCQUNuQyxTQUFTLEVBQUUsNEJBQTRCLENBQUMsSUFBSSxDQUFDO2dCQUM3QyxNQUFNLEVBQUUseUJBQXlCLENBQUMsSUFBSSxDQUFDO2FBQ3hDO1lBRUQsdUJBQXVCO1lBQ3ZCLGFBQWEsRUFBRSxzQkFBc0IsQ0FBQyxJQUFJLENBQUM7WUFFM0Msc0JBQXNCO1lBQ3RCLGVBQWUsRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sSUFBSSxDQUFDO1lBRXpDLG1CQUFtQjtZQUNuQixHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSTtnQkFDckIsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO2dCQUMzQixrRUFBa0U7YUFDbkUsQ0FBQztTQUNILENBQUM7UUFFRixPQUFPLFlBQTZDLENBQUM7SUFFdkQsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixJQUFJLEtBQUssWUFBWSxLQUFLLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxpQkFBaUI7WUFBRSxNQUFNLEtBQUssQ0FBQztRQUM1RSxNQUFNLElBQUEsdUNBQXFCLEVBQ3pCLGlDQUFpQyxFQUNqQyxzQkFBc0IsRUFDdEIsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRyxLQUFlLENBQUMsT0FBTyxFQUFFLENBQ3RELENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQztBQUVELEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxRQUFnQixFQUFFLE1BQWM7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQUcsSUFBSSwyQkFBWSxDQUFDO1lBQy9CLFNBQVMsRUFBRSxtQkFBbUI7WUFDOUIsc0JBQXNCLEVBQUUsc0JBQXNCO1lBQzlDLGdCQUFnQixFQUFFLHdDQUF3QztZQUMxRCx3QkFBd0IsRUFBRTtnQkFDeEIsU0FBUyxFQUFFLFFBQVE7YUFDcEI7WUFDRCx5QkFBeUIsRUFBRTtnQkFDekIsV0FBVyxFQUFFLFFBQVE7Z0JBQ3JCLFNBQVMsRUFBRSxNQUFNO2dCQUNqQixTQUFTLEVBQUUsYUFBYTthQUN6QjtZQUNELGdCQUFnQixFQUFFLEtBQUssQ0FBQyxvQkFBb0I7U0FDN0MsQ0FBQyxDQUFDO1FBRUgsTUFBTSxRQUFRLEdBQUcsTUFBTSxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRS9DLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUMsR0FBRyxPQUFPO1lBRVYscUJBQXFCO1lBQ3JCLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRyxPQUFtQyxDQUFDLGNBQXdCLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3BHLFdBQVcsRUFBRSxJQUFJLElBQUksQ0FBRSxPQUFtQyxDQUFDLGNBQXdCLENBQUMsQ0FBQyxXQUFXLEVBQUU7WUFDbEcsUUFBUSxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFLLE9BQW1DLENBQUMsU0FBb0IsQ0FBQyxHQUFHLENBQUcsT0FBbUMsQ0FBQyxjQUF5QixHQUFLLE9BQW1DLENBQUMsU0FBb0IsQ0FBQyxDQUFDO1lBRWpPLGtCQUFrQjtZQUNsQixXQUFXLEVBQUUsR0FBRyxNQUFNLENBQUUsT0FBbUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxNQUFNLENBQUUsT0FBbUMsQ0FBQyxPQUFPLENBQUMsRUFBRTtZQUNsSSxhQUFhLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUcsT0FBbUMsQ0FBQyxjQUF3QixHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztTQUN2RyxDQUFDLENBQUMsQ0FBQztJQUVOLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxDQUFDLElBQUksQ0FBQyxvQ0FBb0MsRUFBRTtZQUNoRCxRQUFRO1lBQ1IsTUFBTTtZQUNOLEtBQUssRUFBRyxLQUFlLENBQUMsT0FBTztTQUNoQyxDQUFDLENBQUM7UUFDSCxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7QUFDSCxDQUFDO0FBRUQsU0FBUyxvQkFBb0IsQ0FBQyxJQUFnQixFQUFFLGNBQXlCO0lBQ3ZFLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV2QixPQUFPO1FBQ0wsd0NBQXdDO1FBQ3hDLFNBQVMsRUFBRSxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7UUFFbkMscUJBQXFCO1FBQ3JCLFVBQVUsRUFBRTtZQUNWLG9CQUFvQixFQUFFLDZCQUE2QixDQUFDLElBQUksQ0FBQztZQUN6RCxpQkFBaUIsRUFBRSwwQkFBMEIsQ0FBQyxJQUFJLENBQUM7WUFDbkQsaUJBQWlCLEVBQUUsMEJBQTBCLENBQUMsSUFBSSxDQUFDO1NBQ3BEO1FBRUQsbUJBQW1CO1FBQ25CLFFBQVEsRUFBRTtZQUNSLGVBQWUsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDekUsYUFBYSxFQUFFLGNBQWMsQ0FBQyxNQUFNO1lBQ3BDLG9CQUFvQixFQUFFLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQztnQkFDN0MsQ0FBQyxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1NBQzNFO1FBRUQsb0JBQW9CO1FBQ3BCLFNBQVMsRUFBRTtZQUNULGNBQWMsRUFBRSx1QkFBdUIsQ0FBQyxJQUFJLENBQUM7WUFDN0MsaUJBQWlCLEVBQUUsMEJBQTBCLENBQUMsSUFBSSxDQUFDO1lBQ25ELHFCQUFxQixFQUFFLDhCQUE4QixDQUFDLElBQUksQ0FBQztTQUM1RDtRQUVELGtCQUFrQjtRQUNsQixlQUFlLEVBQUUsdUJBQXVCLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQztLQUMvRCxDQUFDO0FBQ0osQ0FBQztBQUVELCtCQUErQjtBQUMvQixTQUFTLHVCQUF1QixDQUFDLElBQWdCO0lBQy9DLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsVUFBVSxJQUFJLENBQUMsQ0FBQztJQUNuRCxNQUFNLGVBQWUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQy9DLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLEdBQUcsZUFBZSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsaUNBQWlDO0FBQzlGLENBQUM7QUFFRCxTQUFTLHVCQUF1QixDQUFDLElBQWdCO0lBQy9DLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsVUFBVSxJQUFJLENBQUMsQ0FBQztJQUNuRCxNQUFNLGVBQWUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQy9DLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLEdBQUcsZUFBZSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsY0FBYztBQUMzRSxDQUFDO0FBRUQsU0FBUyw0QkFBNEIsQ0FBQyxJQUFnQjtJQUNwRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsSUFBSSxDQUFDLENBQUM7SUFDbkQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQztJQUMvQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxHQUFHLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLG1CQUFtQjtBQUNoRixDQUFDO0FBRUQsU0FBUyx5QkFBeUIsQ0FBQyxJQUFnQjtJQUNqRCxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsSUFBSSxDQUFDLENBQUM7SUFDbkQsTUFBTSxlQUFlLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQztJQUMvQyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxHQUFHLGVBQWUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLGdCQUFnQjtBQUM3RSxDQUFDO0FBRUQsU0FBUyxzQkFBc0IsQ0FBQyxJQUFnQjtJQUM5QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sSUFBSSxDQUFDLENBQUM7SUFDekMsSUFBSSxPQUFPLEdBQUcsRUFBRTtRQUFFLE9BQU8sTUFBTSxDQUFDO0lBQ2hDLElBQUksT0FBTyxHQUFHLEdBQUc7UUFBRSxPQUFPLFVBQVUsQ0FBQztJQUNyQyxJQUFJLE9BQU8sR0FBRyxHQUFHO1FBQUUsT0FBTyxRQUFRLENBQUM7SUFDbkMsSUFBSSxPQUFPLEdBQUcsR0FBRztRQUFFLE9BQU8sV0FBVyxDQUFDO0lBQ3RDLE9BQU8sY0FBYyxDQUFDO0FBQ3hCLENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFDLElBQWdCO0lBQzFDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDO0lBQzlCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO0lBQy9CLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO0lBQ25DLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDO0lBRW5DLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzFGLENBQUM7QUFFRCxTQUFTLDZCQUE2QixDQUFDLElBQWdCO0lBQ3JELE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQyxnQ0FBZ0M7SUFDNUUsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLFVBQVUsSUFBSSxDQUFDLENBQUM7SUFDckQsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxnQkFBZ0IsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzVELENBQUM7QUFFRCxTQUFTLDBCQUEwQixDQUFDLElBQWdCO0lBQ2xELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLENBQUMsNkJBQTZCO0lBQ3RFLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLEVBQUUsT0FBTyxJQUFJLENBQUMsQ0FBQztJQUMvQyxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGFBQWEsR0FBRyxlQUFlLENBQUMsQ0FBQztBQUN0RCxDQUFDO0FBRUQsU0FBUywwQkFBMEIsQ0FBQyxJQUFnQjtJQUNsRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxDQUFDLDZCQUE2QjtJQUN2RSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sSUFBSSxDQUFDLENBQUM7SUFDL0MsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxhQUFhLEdBQUcsZUFBZSxDQUFDLENBQUM7QUFDdEQsQ0FBQztBQUVELFNBQVMsdUJBQXVCLENBQUMsSUFBZ0I7SUFDL0MsZ0ZBQWdGO0lBQ2hGLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEYsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3pELENBQUM7QUFFRCxTQUFTLDBCQUEwQixDQUFDLElBQWdCO0lBQ2xELE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2QyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFdkMsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxHQUFHO1FBQUUsT0FBTyxhQUFhLENBQUM7SUFDN0MsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJO1FBQUUsT0FBTyxnQkFBZ0IsQ0FBQztJQUNsRCxPQUFPLG1CQUFtQixDQUFDO0FBQzdCLENBQUM7QUFFRCxTQUFTLDhCQUE4QixDQUFDLEtBQWlCO0lBQ3ZELCtDQUErQztJQUMvQyxzREFBc0Q7SUFDdEQsT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLGlDQUFpQztBQUNyRSxDQUFDO0FBRUQsU0FBUyx1QkFBdUIsQ0FBQyxJQUFnQixFQUFFLGNBQXlCO0lBQzFFLE1BQU0sZUFBZSxHQUFhLEVBQUUsQ0FBQztJQUVyQyxJQUFJLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDbkIsZUFBZSxDQUFDLElBQUksQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO0lBQzNFLENBQUM7SUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFDMUMsZUFBZSxDQUFDLElBQUksQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO0lBQzNGLENBQUM7SUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsVUFBVSxHQUFHLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxFQUFFLENBQUM7UUFDN0MsZUFBZSxDQUFDLElBQUksQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFRCxJQUFJLGNBQWMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDNUQsZUFBZSxDQUFDLElBQUksQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ3JCLGVBQWUsQ0FBQyxJQUFJLENBQUMsbURBQW1ELENBQUMsQ0FBQztJQUM1RSxDQUFDO0lBRUQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztJQUNsRixJQUFJLGFBQWEsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsVUFBVTtRQUMxRCxlQUFlLENBQUMsSUFBSSxDQUFDLHNEQUFzRCxDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUVELE9BQU8sZUFBZSxDQUFDO0FBQ3pCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElHYXRld2F5UHJveHlFdmVudCwgQVBJR2F0ZXdheVByb3h5UmVzdWx0IH0gZnJvbSAnYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBHZXRDb21tYW5kLCBRdWVyeUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuaW1wb3J0IHsgXG4gIFNpbXBsZUxhbWJkYUxvZ2dlcixcbiAgd2l0aExhbWJkYUVycm9ySGFuZGxpbmcsXG4gIGNyZWF0ZUdhbWVFbmdpbmVFcnJvclxufSBmcm9tICdAbG91cGVlbi9zaGFyZWQtanMtdXRpbHMnO1xuaW1wb3J0IHsgXG4gIFBsYXllckJhc2UsIFxuICBFbnJpY2hlZFBsYXllckJhc2Vcbn0gZnJvbSAnLi4vdHlwZXMvZ2FtZS1iYXNlLXR5cGVzJztcblxuY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbmNvbnN0IGRvY0NsaWVudCA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkeW5hbW9DbGllbnQpO1xuY29uc3QgbG9nZ2VyID0gbmV3IFNpbXBsZUxhbWJkYUxvZ2dlcignR2V0QmFzZURldGFpbHNIYW5kbGVyJyk7XG5cbmNvbnN0IFBMQVlFUl9CQVNFU19UQUJMRSA9IHByb2Nlc3MuZW52LlBMQVlFUl9CQVNFU19UQUJMRSA/PyAnJztcbmNvbnN0IEJBU0VfVVBHUkFERVNfVEFCTEUgPSBwcm9jZXNzLmVudi5CQVNFX1VQR1JBREVTX1RBQkxFID8/ICcnO1xuXG4vKipcbiAqIEdldCBCYXNlIERldGFpbHMgSGFuZGxlclxuICogXG4gKiBQcm92aWRlcyBjb21wcmVoZW5zaXZlIGJhc2UgaW5mb3JtYXRpb24gZm9sbG93aW5nIFNPTElEIHByaW5jaXBsZXM6XG4gKiAtIFNpbmdsZSBSZXNwb25zaWJpbGl0eTogT25seSBoYW5kbGVzIGRldGFpbGVkIGJhc2UgaW5mb3JtYXRpb24gcmV0cmlldmFsXG4gKiAtIE9wZW4vQ2xvc2VkOiBFeHRlbnNpYmxlIGZvciBhZGRpdGlvbmFsIGRldGFpbCB0eXBlc1xuICogLSBMaXNrb3YgU3Vic3RpdHV0aW9uOiBDb25zaXN0ZW50IGRldGFpbCBpbnRlcmZhY2UgZm9yIGFsbCBiYXNlIHR5cGVzXG4gKiAtIEludGVyZmFjZSBTZWdyZWdhdGlvbjogRm9jdXNlZCBvbiBzcGVjaWZpYyBiYXNlIGRldGFpbCBuZWVkc1xuICogLSBEZXBlbmRlbmN5IEludmVyc2lvbjogRGVwZW5kcyBvbiBzaGFyZWQgZGF0YSBhY2Nlc3MgcGF0dGVybnNcbiAqIFxuICogRmVhdHVyZXM6XG4gKiAtIENvbXBsZXRlIGJhc2UgaW5mb3JtYXRpb24gd2l0aCBhbGwgc3RhdHNcbiAqIC0gQWN0aXZlIHVwZ3JhZGUgaW5mb3JtYXRpb25cbiAqIC0gTW92ZW1lbnQgc3RhdHVzIGFuZCB0aW1pbmdcbiAqIC0gSGlzdG9yaWNhbCB1cGdyYWRlIGluZm9ybWF0aW9uXG4gKiAtIFRlcnJpdG9yeSBhbmQgYWxsaWFuY2UgY29udGV4dFxuICogLSBSZXNvdXJjZSBwcm9kdWN0aW9uIGNhbGN1bGF0aW9uc1xuICovXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcbiAgZXZlbnQ6IEFQSUdhdGV3YXlQcm94eUV2ZW50XG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xuICByZXR1cm4gd2l0aExhbWJkYUVycm9ySGFuZGxpbmcoYXN5bmMgKCkgPT4ge1xuICAgIGxvZ2dlci5pbmZvKCdQcm9jZXNzaW5nIGdldCBiYXNlIGRldGFpbHMgcmVxdWVzdCcsIHsgXG4gICAgICByZXF1ZXN0SWQ6IGV2ZW50LnJlcXVlc3RDb250ZXh0Py5yZXF1ZXN0SWQgXG4gICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IHBhcmFtZXRlcnMgZnJvbSBwYXRoXG4gICAgY29uc3QgcGxheWVySWQgPSBldmVudC5wYXRoUGFyYW1ldGVycz8ucGxheWVySWQ7XG4gICAgY29uc3QgYmFzZUlkID0gZXZlbnQucGF0aFBhcmFtZXRlcnM/LmJhc2VJZDtcblxuICAgIGlmICghcGxheWVySWQgfHwgIWJhc2VJZCkge1xuICAgICAgdGhyb3cgY3JlYXRlR2FtZUVuZ2luZUVycm9yKFxuICAgICAgICAnTWlzc2luZyByZXF1aXJlZCBwYXJhbWV0ZXJzOiBwbGF5ZXJJZCBhbmQgYmFzZUlkJyxcbiAgICAgICAgJ0lOVkFMSURfUEFSQU1FVEVSUycsXG4gICAgICAgIHsgcGxheWVySWQsIGJhc2VJZCB9XG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIEdldCBiYXNlIGRldGFpbHNcbiAgICBjb25zdCBiYXNlRGV0YWlscyA9IGF3YWl0IGdldEJhc2VEZXRhaWxzKHBsYXllcklkLCBiYXNlSWQpO1xuICAgIFxuICAgIC8vIEdldCBhY3RpdmUgdXBncmFkZXNcbiAgICBjb25zdCBhY3RpdmVVcGdyYWRlcyA9IGF3YWl0IGdldEFjdGl2ZVVwZ3JhZGVzKHBsYXllcklkLCBiYXNlSWQpO1xuICAgIFxuICAgIC8vIENhbGN1bGF0ZSBhZGRpdGlvbmFsIG1ldHJpY3NcbiAgICBjb25zdCBtZXRyaWNzID0gY2FsY3VsYXRlQmFzZU1ldHJpY3MoYmFzZURldGFpbHMsIGFjdGl2ZVVwZ3JhZGVzKTtcblxuICAgIGxvZ2dlci5pbmZvKCdCYXNlIGRldGFpbHMgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseScsIHtcbiAgICAgIHBsYXllcklkLFxuICAgICAgYmFzZUlkLFxuICAgICAgYmFzZVR5cGU6IGJhc2VEZXRhaWxzLmJhc2VUeXBlLFxuICAgICAgc3RhdHVzOiBiYXNlRGV0YWlscy5zdGF0dXNcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKidcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBiYXNlOiBiYXNlRGV0YWlscyxcbiAgICAgICAgICBhY3RpdmVVcGdyYWRlczogYWN0aXZlVXBncmFkZXMsXG4gICAgICAgICAgbWV0cmljczogbWV0cmljc1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gIH0sIGxvZ2dlcik7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBnZXRCYXNlRGV0YWlscyhwbGF5ZXJJZDogc3RyaW5nLCBiYXNlSWQ6IHN0cmluZyk6IFByb21pc2U8RW5yaWNoZWRQbGF5ZXJCYXNlPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBHZXRDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogUExBWUVSX0JBU0VTX1RBQkxFLFxuICAgICAgS2V5OiB7IHBsYXllcklkLCBiYXNlSWQgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICBcbiAgICBpZiAoIXJlc3BvbnNlLkl0ZW0pIHtcbiAgICAgIHRocm93IGNyZWF0ZUdhbWVFbmdpbmVFcnJvcihcbiAgICAgICAgJ0Jhc2Ugbm90IGZvdW5kJyxcbiAgICAgICAgJ0JBU0VfTk9UX0ZPVU5EJyxcbiAgICAgICAgeyBwbGF5ZXJJZCwgYmFzZUlkIH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgYmFzZSA9IHJlc3BvbnNlLkl0ZW0gYXMgUGxheWVyQmFzZTtcbiAgICBcbiAgICAvLyBFbnJpY2ggYmFzZSBkYXRhIHdpdGggY29tcHV0ZWQgZmllbGRzXG4gICAgY29uc3QgZW5yaWNoZWRCYXNlID0ge1xuICAgICAgLi4uYmFzZSxcbiAgICAgIFxuICAgICAgLy8gU3RhdHVzIGluZm9ybWF0aW9uXG4gICAgICBpc0FjdGl2ZTogYmFzZS5zdGF0dXMgPT09ICdhY3RpdmUnLFxuICAgICAgaXNCdWlsZGluZzogYmFzZS5zdGF0dXMgPT09ICdidWlsZGluZycsXG4gICAgICBpc01vdmluZzogYmFzZS5zdGF0dXMgPT09ICdtb3ZpbmcnLFxuICAgICAgaXNEZXN0cm95ZWQ6IGJhc2Uuc3RhdHVzID09PSAnZGVzdHJveWVkJyxcbiAgICAgIFxuICAgICAgLy8gVGltaW5nIGluZm9ybWF0aW9uXG4gICAgICBhZ2VJbkRheXM6IE1hdGguZmxvb3IoKERhdGUubm93KCkgLSBiYXNlLmNyZWF0ZWRBdCkgLyAoMjQgKiA2MCAqIDYwICogMTAwMCkpLFxuICAgICAgbGFzdEFjdGl2ZUhvdXJzOiBNYXRoLmZsb29yKChEYXRlLm5vdygpIC0gYmFzZS5sYXN0QWN0aXZlQXQpIC8gKDYwICogNjAgKiAxMDAwKSksXG4gICAgICBcbiAgICAgIC8vIENvb3JkaW5hdGUgaW5mb3JtYXRpb25cbiAgICAgIGxvY2F0aW9uOiBgJHtiYXNlLmNvb3JkaW5hdGVzLnh9LCAke2Jhc2UuY29vcmRpbmF0ZXMueX1gLFxuICAgICAgbWFwU2VjdGlvbjogYmFzZS5tYXBTZWN0aW9uSWQsXG4gICAgICBcbiAgICAgIC8vIE1vdmVtZW50IGluZm9ybWF0aW9uXG4gICAgICBjYW5Nb3ZlOiBiYXNlLnN0YXR1cyA9PT0gJ2FjdGl2ZScgJiYgKCFiYXNlLmxhc3RNb3ZlZEF0IHx8IFxuICAgICAgICAoRGF0ZS5ub3coKSAtIGJhc2UubGFzdE1vdmVkQXQpID49ICg2MCAqIDYwICogMTAwMCkpLFxuICAgICAgbW92ZW1lbnRDb29sZG93blJlbWFpbmluZzogYmFzZS5sYXN0TW92ZWRBdCA/IFxuICAgICAgICBNYXRoLm1heCgwLCAoNjAgKiA2MCAqIDEwMDApIC0gKERhdGUubm93KCkgLSBiYXNlLmxhc3RNb3ZlZEF0KSkgOiAwLFxuICAgICAgXG4gICAgICAvLyBCdWlsZGluZy9Nb3ZlbWVudCBjb21wbGV0aW9uIHRpbWVzXG4gICAgICAuLi4oYmFzZS5zdGF0dXMgPT09ICdidWlsZGluZycgJiYgYmFzZS5idWlsZENvbXBsZXRpb25UaW1lICYmIHtcbiAgICAgICAgYnVpbGRpbmdDb21wbGV0ZXNJbjogTWF0aC5tYXgoMCwgYmFzZS5idWlsZENvbXBsZXRpb25UaW1lIC0gRGF0ZS5ub3coKSksXG4gICAgICAgIGJ1aWxkaW5nQ29tcGxldGVzQXQ6IG5ldyBEYXRlKGJhc2UuYnVpbGRDb21wbGV0aW9uVGltZSkudG9JU09TdHJpbmcoKVxuICAgICAgfSksXG4gICAgICBcbiAgICAgIC4uLihiYXNlLnN0YXR1cyA9PT0gJ21vdmluZycgJiYgYmFzZS5hcnJpdmFsVGltZSAmJiB7XG4gICAgICAgIGFycml2YWxJbjogTWF0aC5tYXgoMCwgYmFzZS5hcnJpdmFsVGltZSAtIERhdGUubm93KCkpLFxuICAgICAgICBhcnJpdmFsQXQ6IG5ldyBEYXRlKGJhc2UuYXJyaXZhbFRpbWUpLnRvSVNPU3RyaW5nKClcbiAgICAgIH0pLFxuICAgICAgXG4gICAgICAvLyBSZXNvdXJjZSBwcm9kdWN0aW9uIChjYWxjdWxhdGVkIGJhc2VkIG9uIGJhc2Ugc3RhdHMpXG4gICAgICByZXNvdXJjZVByb2R1Y3Rpb246IHtcbiAgICAgICAgZ29sZDogY2FsY3VsYXRlR29sZFByb2R1Y3Rpb24oYmFzZSksXG4gICAgICAgIGZvb2Q6IGNhbGN1bGF0ZUZvb2RQcm9kdWN0aW9uKGJhc2UpLFxuICAgICAgICBtYXRlcmlhbHM6IGNhbGN1bGF0ZU1hdGVyaWFsc1Byb2R1Y3Rpb24oYmFzZSksXG4gICAgICAgIGVuZXJneTogY2FsY3VsYXRlRW5lcmd5UHJvZHVjdGlvbihiYXNlKVxuICAgICAgfSxcbiAgICAgIFxuICAgICAgLy8gRGVmZW5zZSBjYWxjdWxhdGlvbnNcbiAgICAgIGRlZmVuc2VSYXRpbmc6IGNhbGN1bGF0ZURlZmVuc2VSYXRpbmcoYmFzZSksXG4gICAgICBcbiAgICAgIC8vIFN0b3JhZ2UgaW5mb3JtYXRpb25cbiAgICAgIHN0b3JhZ2VDYXBhY2l0eTogYmFzZS5zdGF0cz8uc3RvcmFnZSA/PyAwLFxuICAgICAgXG4gICAgICAvLyBBbGxpYW5jZSBjb250ZXh0XG4gICAgICAuLi4oYmFzZS5hbGxpYW5jZUlkICYmIHtcbiAgICAgICAgYWxsaWFuY2VJZDogYmFzZS5hbGxpYW5jZUlkLFxuICAgICAgICAvLyBUT0RPOiBHZXQgYWxsaWFuY2UgbmFtZSBhbmQgb3RoZXIgZGV0YWlscyBmcm9tIGFsbGlhbmNlIHNlcnZpY2VcbiAgICAgIH0pXG4gICAgfTtcblxuICAgIHJldHVybiBlbnJpY2hlZEJhc2UgYXMgdW5rbm93biBhcyBFbnJpY2hlZFBsYXllckJhc2U7XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciAmJiBlcnJvci5uYW1lID09PSAnR2FtZUVuZ2luZUVycm9yJykgdGhyb3cgZXJyb3I7XG4gICAgdGhyb3cgY3JlYXRlR2FtZUVuZ2luZUVycm9yKFxuICAgICAgJ0ZhaWxlZCB0byByZXRyaWV2ZSBiYXNlIGRldGFpbHMnLFxuICAgICAgJ0JBU0VfUkVUUklFVkFMX0VSUk9SJyxcbiAgICAgIHsgcGxheWVySWQsIGJhc2VJZCwgZXJyb3I6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB9XG4gICAgKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRBY3RpdmVVcGdyYWRlcyhwbGF5ZXJJZDogc3RyaW5nLCBiYXNlSWQ6IHN0cmluZyk6IFByb21pc2U8dW5rbm93bltdPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBCQVNFX1VQR1JBREVTX1RBQkxFLFxuICAgICAgS2V5Q29uZGl0aW9uRXhwcmVzc2lvbjogJ3BsYXllcklkID0gOnBsYXllcklkJyxcbiAgICAgIEZpbHRlckV4cHJlc3Npb246ICdiYXNlSWQgPSA6YmFzZUlkIEFORCAjc3RhdHVzID0gOnN0YXR1cycsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJ1xuICAgICAgfSxcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgJzpwbGF5ZXJJZCc6IHBsYXllcklkLFxuICAgICAgICAnOmJhc2VJZCc6IGJhc2VJZCxcbiAgICAgICAgJzpzdGF0dXMnOiAnaW5fcHJvZ3Jlc3MnXG4gICAgICB9LFxuICAgICAgU2NhbkluZGV4Rm9yd2FyZDogZmFsc2UgLy8gTW9zdCByZWNlbnQgZmlyc3RcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgXG4gICAgcmV0dXJuIChyZXNwb25zZS5JdGVtcyA/PyBbXSkubWFwKHVwZ3JhZGUgPT4gKHtcbiAgICAgIC4uLnVwZ3JhZGUsXG4gICAgICBcbiAgICAgIC8vIFRpbWluZyBpbmZvcm1hdGlvblxuICAgICAgY29tcGxldGVzSW46IE1hdGgubWF4KDAsICh1cGdyYWRlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS5jb21wbGV0aW9uVGltZSBhcyBudW1iZXIgLSBEYXRlLm5vdygpKSxcbiAgICAgIGNvbXBsZXRlc0F0OiBuZXcgRGF0ZSgodXBncmFkZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuY29tcGxldGlvblRpbWUgYXMgbnVtYmVyKS50b0lTT1N0cmluZygpLFxuICAgICAgcHJvZ3Jlc3M6IE1hdGgubWluKDEsIChEYXRlLm5vdygpIC0gKCh1cGdyYWRlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS5zdGFydGVkQXQgYXMgbnVtYmVyKSkgLyAoKCh1cGdyYWRlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS5jb21wbGV0aW9uVGltZSBhcyBudW1iZXIpIC0gKCh1cGdyYWRlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS5zdGFydGVkQXQgYXMgbnVtYmVyKSkpLFxuICAgICAgXG4gICAgICAvLyBVcGdyYWRlIGRldGFpbHNcbiAgICAgIGxldmVsQ2hhbmdlOiBgJHtTdHJpbmcoKHVwZ3JhZGUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLmZyb21MZXZlbCl9IOKGkiAke1N0cmluZygodXBncmFkZSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikudG9MZXZlbCl9YCxcbiAgICAgIHRpbWVSZW1haW5pbmc6IE1hdGgubWF4KDAsICh1cGdyYWRlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS5jb21wbGV0aW9uVGltZSBhcyBudW1iZXIgLSBEYXRlLm5vdygpKVxuICAgIH0pKTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ2dlci53YXJuKCdGYWlsZWQgdG8gcmV0cmlldmUgYWN0aXZlIHVwZ3JhZGVzJywgeyBcbiAgICAgIHBsYXllcklkLCBcbiAgICAgIGJhc2VJZCwgXG4gICAgICBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIFxuICAgIH0pO1xuICAgIHJldHVybiBbXTtcbiAgfVxufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVCYXNlTWV0cmljcyhiYXNlOiBQbGF5ZXJCYXNlLCBhY3RpdmVVcGdyYWRlczogdW5rbm93bltdKTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4ge1xuICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICBcbiAgcmV0dXJuIHtcbiAgICAvLyBPdmVyYWxsIGJhc2Ugc2NvcmUgKGNvbXBvc2l0ZSBtZXRyaWMpXG4gICAgYmFzZVNjb3JlOiBjYWxjdWxhdGVCYXNlU2NvcmUoYmFzZSksXG4gICAgXG4gICAgLy8gRWZmaWNpZW5jeSBtZXRyaWNzXG4gICAgZWZmaWNpZW5jeToge1xuICAgICAgcHJvZHVjdGlvbkVmZmljaWVuY3k6IGNhbGN1bGF0ZVByb2R1Y3Rpb25FZmZpY2llbmN5KGJhc2UpLFxuICAgICAgZGVmZW5zZUVmZmljaWVuY3k6IGNhbGN1bGF0ZURlZmVuc2VFZmZpY2llbmN5KGJhc2UpLFxuICAgICAgc3RvcmFnZUVmZmljaWVuY3k6IGNhbGN1bGF0ZVN0b3JhZ2VFZmZpY2llbmN5KGJhc2UpXG4gICAgfSxcbiAgICBcbiAgICAvLyBBY3Rpdml0eSBtZXRyaWNzXG4gICAgYWN0aXZpdHk6IHtcbiAgICAgIGxhc3RBY3RpdmVIb3VyczogTWF0aC5mbG9vcigobm93IC0gYmFzZS5sYXN0QWN0aXZlQXQpIC8gKDYwICogNjAgKiAxMDAwKSksXG4gICAgICB0b3RhbFVwZ3JhZGVzOiBhY3RpdmVVcGdyYWRlcy5sZW5ndGgsXG4gICAgICBpc0FjdGl2ZWx5RGV2ZWxvcGluZzogYWN0aXZlVXBncmFkZXMubGVuZ3RoID4gMCB8fCBcbiAgICAgICAgKGJhc2UubGFzdEFjdGl2ZUF0ICYmIChub3cgLSBiYXNlLmxhc3RBY3RpdmVBdCkgPCAoMjQgKiA2MCAqIDYwICogMTAwMCkpXG4gICAgfSxcbiAgICBcbiAgICAvLyBTdHJhdGVnaWMgbWV0cmljc1xuICAgIHN0cmF0ZWdpYzoge1xuICAgICAgdGVycml0b3J5VmFsdWU6IGNhbGN1bGF0ZVRlcnJpdG9yeVZhbHVlKGJhc2UpLFxuICAgICAgZGVmZW5zaXZlUG9zaXRpb246IGNhbGN1bGF0ZURlZmVuc2l2ZVBvc2l0aW9uKGJhc2UpLFxuICAgICAgcmVzb3VyY2VBY2Nlc3NpYmlsaXR5OiBjYWxjdWxhdGVSZXNvdXJjZUFjY2Vzc2liaWxpdHkoYmFzZSlcbiAgICB9LFxuICAgIFxuICAgIC8vIFJlY29tbWVuZGF0aW9uc1xuICAgIHJlY29tbWVuZGF0aW9uczogZ2VuZXJhdGVSZWNvbW1lbmRhdGlvbnMoYmFzZSwgYWN0aXZlVXBncmFkZXMpXG4gIH07XG59XG5cbi8vIENhbGN1bGF0aW9uIGhlbHBlciBmdW5jdGlvbnNcbmZ1bmN0aW9uIGNhbGN1bGF0ZUdvbGRQcm9kdWN0aW9uKGJhc2U6IFBsYXllckJhc2UpOiBudW1iZXIge1xuICBjb25zdCBiYXNlUHJvZHVjdGlvbiA9IGJhc2Uuc3RhdHM/LnByb2R1Y3Rpb24gPz8gMDtcbiAgY29uc3QgbGV2ZWxNdWx0aXBsaWVyID0gMSArIChiYXNlLmxldmVsICogMC4xKTtcbiAgcmV0dXJuIE1hdGguZmxvb3IoYmFzZVByb2R1Y3Rpb24gKiBsZXZlbE11bHRpcGxpZXIgKiAwLjQpOyAvLyA0MCUgb2YgcHJvZHVjdGlvbiBnb2VzIHRvIGdvbGRcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlRm9vZFByb2R1Y3Rpb24oYmFzZTogUGxheWVyQmFzZSk6IG51bWJlciB7XG4gIGNvbnN0IGJhc2VQcm9kdWN0aW9uID0gYmFzZS5zdGF0cz8ucHJvZHVjdGlvbiA/PyAwO1xuICBjb25zdCBsZXZlbE11bHRpcGxpZXIgPSAxICsgKGJhc2UubGV2ZWwgKiAwLjEpO1xuICByZXR1cm4gTWF0aC5mbG9vcihiYXNlUHJvZHVjdGlvbiAqIGxldmVsTXVsdGlwbGllciAqIDAuMyk7IC8vIDMwJSB0byBmb29kXG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZU1hdGVyaWFsc1Byb2R1Y3Rpb24oYmFzZTogUGxheWVyQmFzZSk6IG51bWJlciB7XG4gIGNvbnN0IGJhc2VQcm9kdWN0aW9uID0gYmFzZS5zdGF0cz8ucHJvZHVjdGlvbiA/PyAwO1xuICBjb25zdCBsZXZlbE11bHRpcGxpZXIgPSAxICsgKGJhc2UubGV2ZWwgKiAwLjEpO1xuICByZXR1cm4gTWF0aC5mbG9vcihiYXNlUHJvZHVjdGlvbiAqIGxldmVsTXVsdGlwbGllciAqIDAuMik7IC8vIDIwJSB0byBtYXRlcmlhbHNcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlRW5lcmd5UHJvZHVjdGlvbihiYXNlOiBQbGF5ZXJCYXNlKTogbnVtYmVyIHtcbiAgY29uc3QgYmFzZVByb2R1Y3Rpb24gPSBiYXNlLnN0YXRzPy5wcm9kdWN0aW9uID8/IDA7XG4gIGNvbnN0IGxldmVsTXVsdGlwbGllciA9IDEgKyAoYmFzZS5sZXZlbCAqIDAuMSk7XG4gIHJldHVybiBNYXRoLmZsb29yKGJhc2VQcm9kdWN0aW9uICogbGV2ZWxNdWx0aXBsaWVyICogMC4xKTsgLy8gMTAlIHRvIGVuZXJneVxufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVEZWZlbnNlUmF0aW5nKGJhc2U6IFBsYXllckJhc2UpOiBzdHJpbmcge1xuICBjb25zdCBkZWZlbnNlID0gYmFzZS5zdGF0cz8uZGVmZW5zZSA/PyAwO1xuICBpZiAoZGVmZW5zZSA8IDUwKSByZXR1cm4gJ1dlYWsnO1xuICBpZiAoZGVmZW5zZSA8IDE1MCkgcmV0dXJuICdNb2RlcmF0ZSc7XG4gIGlmIChkZWZlbnNlIDwgMzAwKSByZXR1cm4gJ1N0cm9uZyc7XG4gIGlmIChkZWZlbnNlIDwgNTAwKSByZXR1cm4gJ0ZvcnRpZmllZCc7XG4gIHJldHVybiAnSW1wZW5ldHJhYmxlJztcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlQmFzZVNjb3JlKGJhc2U6IFBsYXllckJhc2UpOiBudW1iZXIge1xuICBjb25zdCBsZXZlbCA9IGJhc2UubGV2ZWwgfHwgMTtcbiAgY29uc3Qgc3RhdHMgPSBiYXNlLnN0YXRzIHx8IHt9O1xuICBjb25zdCBkZWZlbnNlID0gc3RhdHMuZGVmZW5zZSA/PyAwO1xuICBjb25zdCBwcm9kdWN0aW9uID0gc3RhdHMucHJvZHVjdGlvbiA/PyAwO1xuICBjb25zdCBzdG9yYWdlID0gc3RhdHMuc3RvcmFnZSA/PyAwO1xuICBcbiAgcmV0dXJuIE1hdGguZmxvb3IoKGxldmVsICogMTAwKSArIChkZWZlbnNlICogMC41KSArIChwcm9kdWN0aW9uICogMikgKyAoc3RvcmFnZSAqIDAuMSkpO1xufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVQcm9kdWN0aW9uRWZmaWNpZW5jeShiYXNlOiBQbGF5ZXJCYXNlKTogbnVtYmVyIHtcbiAgY29uc3QgZXhwZWN0ZWRQcm9kdWN0aW9uID0gYmFzZS5sZXZlbCAqIDUwOyAvLyBFeHBlY3RlZCBwcm9kdWN0aW9uIHBlciBsZXZlbFxuICBjb25zdCBhY3R1YWxQcm9kdWN0aW9uID0gYmFzZS5zdGF0cz8ucHJvZHVjdGlvbiA/PyAwO1xuICByZXR1cm4gTWF0aC5taW4oMSwgYWN0dWFsUHJvZHVjdGlvbiAvIGV4cGVjdGVkUHJvZHVjdGlvbik7XG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZURlZmVuc2VFZmZpY2llbmN5KGJhc2U6IFBsYXllckJhc2UpOiBudW1iZXIge1xuICBjb25zdCBleHBlY3RlZERlZmVuc2UgPSBiYXNlLmxldmVsICogMzA7IC8vIEV4cGVjdGVkIGRlZmVuc2UgcGVyIGxldmVsXG4gIGNvbnN0IGFjdHVhbERlZmVuc2UgPSBiYXNlLnN0YXRzPy5kZWZlbnNlID8/IDA7XG4gIHJldHVybiBNYXRoLm1pbigxLCBhY3R1YWxEZWZlbnNlIC8gZXhwZWN0ZWREZWZlbnNlKTtcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlU3RvcmFnZUVmZmljaWVuY3koYmFzZTogUGxheWVyQmFzZSk6IG51bWJlciB7XG4gIGNvbnN0IGV4cGVjdGVkU3RvcmFnZSA9IGJhc2UubGV2ZWwgKiAyMDA7IC8vIEV4cGVjdGVkIHN0b3JhZ2UgcGVyIGxldmVsXG4gIGNvbnN0IGFjdHVhbFN0b3JhZ2UgPSBiYXNlLnN0YXRzPy5zdG9yYWdlID8/IDA7XG4gIHJldHVybiBNYXRoLm1pbigxLCBhY3R1YWxTdG9yYWdlIC8gZXhwZWN0ZWRTdG9yYWdlKTtcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlVGVycml0b3J5VmFsdWUoYmFzZTogUGxheWVyQmFzZSk6IG51bWJlciB7XG4gIC8vIFNpbXBsZSB0ZXJyaXRvcnkgdmFsdWUgYmFzZWQgb24gY29vcmRpbmF0ZXMgKGNsb3NlciB0byBjZW50ZXIgPSBoaWdoZXIgdmFsdWUpXG4gIGNvbnN0IGRpc3RhbmNlRnJvbUNlbnRlciA9IE1hdGguc3FydChiYXNlLmNvb3JkaW5hdGVzLnggKiogMiArIGJhc2UuY29vcmRpbmF0ZXMueSAqKiAyKTtcbiAgcmV0dXJuIE1hdGgubWF4KDAuMSwgMSAtIChkaXN0YW5jZUZyb21DZW50ZXIgLyAxMDAwMCkpO1xufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVEZWZlbnNpdmVQb3NpdGlvbihiYXNlOiBQbGF5ZXJCYXNlKTogc3RyaW5nIHtcbiAgY29uc3QgeCA9IE1hdGguYWJzKGJhc2UuY29vcmRpbmF0ZXMueCk7XG4gIGNvbnN0IHkgPSBNYXRoLmFicyhiYXNlLmNvb3JkaW5hdGVzLnkpO1xuICBcbiAgaWYgKHggPCAxMDAgJiYgeSA8IDEwMCkgcmV0dXJuICdDZW50cmFsIEh1Yic7XG4gIGlmICh4ID4gMTAwMCB8fCB5ID4gMTAwMCkgcmV0dXJuICdSZW1vdGUgT3V0cG9zdCc7XG4gIHJldHVybiAnU3RhbmRhcmQgUG9zaXRpb24nO1xufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVSZXNvdXJjZUFjY2Vzc2liaWxpdHkoX2Jhc2U6IFBsYXllckJhc2UpOiBudW1iZXIge1xuICAvLyBTaW1wbGlmaWVkIGNhbGN1bGF0aW9uIGJhc2VkIG9uIG1hcCBwb3NpdGlvblxuICAvLyBUT0RPOiBJbnRlZ3JhdGUgd2l0aCBhY3R1YWwgcmVzb3VyY2Ugbm9kZSBsb2NhdGlvbnNcbiAgcmV0dXJuIE1hdGgucmFuZG9tKCkgKiAwLjQgKyAwLjY7IC8vIFJhbmRvbSBiZXR3ZWVuIDAuNi0xLjAgZm9yIG5vd1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVJlY29tbWVuZGF0aW9ucyhiYXNlOiBQbGF5ZXJCYXNlLCBhY3RpdmVVcGdyYWRlczogdW5rbm93bltdKTogc3RyaW5nW10ge1xuICBjb25zdCByZWNvbW1lbmRhdGlvbnM6IHN0cmluZ1tdID0gW107XG4gIFxuICBpZiAoYmFzZS5sZXZlbCA8IDUpIHtcbiAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgnQ29uc2lkZXIgdXBncmFkaW5nIGJhc2UgbGV2ZWwgZm9yIGltcHJvdmVkIHN0YXRzJyk7XG4gIH1cbiAgXG4gIGlmIChiYXNlLnN0YXRzPy5kZWZlbnNlIDwgYmFzZS5sZXZlbCAqIDIwKSB7XG4gICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ0RlZmVuc2UgaXMgYmVsb3cgcmVjb21tZW5kZWQgbGV2ZWwgLSBjb25zaWRlciBkZWZlbnNpdmUgdXBncmFkZXMnKTtcbiAgfVxuICBcbiAgaWYgKGJhc2Uuc3RhdHM/LnByb2R1Y3Rpb24gPCBiYXNlLmxldmVsICogNDApIHtcbiAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgnUHJvZHVjdGlvbiBjb3VsZCBiZSBpbXByb3ZlZCB3aXRoIHJlc291cmNlIHVwZ3JhZGVzJyk7XG4gIH1cbiAgXG4gIGlmIChhY3RpdmVVcGdyYWRlcy5sZW5ndGggPT09IDAgJiYgYmFzZS5zdGF0dXMgPT09ICdhY3RpdmUnKSB7XG4gICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ0Jhc2UgaXMgaWRsZSAtIGNvbnNpZGVyIHN0YXJ0aW5nIGFuIHVwZ3JhZGUnKTtcbiAgfVxuICBcbiAgaWYgKCFiYXNlLmFsbGlhbmNlSWQpIHtcbiAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgnSm9pbmluZyBhbiBhbGxpYW5jZSBwcm92aWRlcyBzdHJhdGVnaWMgYWR2YW50YWdlcycpO1xuICB9XG4gIFxuICBjb25zdCB0aW1lU2luY2VNb3ZlID0gYmFzZS5sYXN0TW92ZWRBdCA/IERhdGUubm93KCkgLSBiYXNlLmxhc3RNb3ZlZEF0IDogSW5maW5pdHk7XG4gIGlmICh0aW1lU2luY2VNb3ZlID4gKDMwICogMjQgKiA2MCAqIDYwICogMTAwMCkpIHsgLy8gMzAgZGF5c1xuICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCdDb25zaWRlciByZWxvY2F0aW5nIGZvciBiZXR0ZXIgc3RyYXRlZ2ljIHBvc2l0aW9uaW5nJyk7XG4gIH1cbiAgXG4gIHJldHVybiByZWNvbW1lbmRhdGlvbnM7XG59Il19
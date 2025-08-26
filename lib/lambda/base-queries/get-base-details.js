"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const shared_mocks_1 = require("../../lib/shared-mocks");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const logger = new shared_mocks_1.StructuredLogger('GetBaseDetailsHandler');
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
    return (0, shared_mocks_1.withErrorHandling)(async () => {
        logger.info('Processing get base details request', {
            requestId: event.requestContext?.requestId
        });
        // Extract parameters from path
        const playerId = event.pathParameters?.playerId;
        const baseId = event.pathParameters?.baseId;
        if (!playerId || !baseId) {
            throw new shared_mocks_1.GameEngineError('Missing required parameters: playerId and baseId', 'INVALID_PARAMETERS', { playerId, baseId });
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
            throw new shared_mocks_1.GameEngineError('Base not found', 'BASE_NOT_FOUND', { playerId, baseId });
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
        if (error instanceof shared_mocks_1.GameEngineError)
            throw error;
        throw new shared_mocks_1.GameEngineError('Failed to retrieve base details', 'BASE_RETRIEVAL_ERROR', { playerId, baseId, error: error.message });
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
        return (response.Items || []).map(upgrade => ({
            ...upgrade,
            // Timing information
            completesIn: Math.max(0, upgrade.completionTime - Date.now()),
            completesAt: new Date(upgrade.completionTime).toISOString(),
            progress: Math.min(1, (Date.now() - upgrade.startedAt) / (upgrade.completionTime - upgrade.startedAt)),
            // Upgrade details
            levelChange: `${upgrade.fromLevel} → ${upgrade.toLevel}`,
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
function calculateResourceAccessibility(base) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWJhc2UtZGV0YWlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xhbWJkYS9iYXNlLXF1ZXJpZXMvZ2V0LWJhc2UtZGV0YWlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4REFBMEQ7QUFDMUQsd0RBQXlGO0FBQ3pGLHlEQUlnQztBQU1oQyxNQUFNLFlBQVksR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUMsTUFBTSxTQUFTLEdBQUcscUNBQXNCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVELE1BQU0sTUFBTSxHQUFHLElBQUksK0JBQWdCLENBQUMsdUJBQXVCLENBQUMsQ0FBQztBQUU3RCxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksRUFBRSxDQUFDO0FBQ2hFLE1BQU0sbUJBQW1CLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsSUFBSSxFQUFFLENBQUM7QUFFbEU7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUJHO0FBQ0ksTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUNLLEVBQUU7SUFDbEMsT0FBTyxJQUFBLGdDQUFpQixFQUFDLEtBQUssSUFBSSxFQUFFO1FBQ2xDLE1BQU0sQ0FBQyxJQUFJLENBQUMscUNBQXFDLEVBQUU7WUFDakQsU0FBUyxFQUFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsU0FBUztTQUMzQyxDQUFDLENBQUM7UUFFSCwrQkFBK0I7UUFDL0IsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLGNBQWMsRUFBRSxRQUFRLENBQUM7UUFDaEQsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUM7UUFFNUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3pCLE1BQU0sSUFBSSw4QkFBZSxDQUN2QixrREFBa0QsRUFDbEQsb0JBQW9C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cURBQXFELENBQUMsQ0FBQztJQUM5RSxDQUFDO0lBRUQsSUFBSSxjQUFjLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzVELGVBQWUsQ0FBQyxJQUFJLENBQUMsNkNBQTZDLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNyQixlQUFlLENBQUMsSUFBSSxDQUFDLG1EQUFtRCxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFDbEYsSUFBSSxhQUFhLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFVBQVU7UUFDMUQsZUFBZSxDQUFDLElBQUksQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO0lBQy9FLENBQUM7SUFFRCxPQUFPLGVBQWUsQ0FBQztBQUN6QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCB9IGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgRHluYW1vREJDbGllbnQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInO1xuaW1wb3J0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgR2V0Q29tbWFuZCwgUXVlcnlDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvbGliLWR5bmFtb2RiJztcbmltcG9ydCB7IFxuICBTdHJ1Y3R1cmVkTG9nZ2VyLCBcbiAgR2FtZUVuZ2luZUVycm9yLFxuICB3aXRoRXJyb3JIYW5kbGluZyBcbn0gZnJvbSAnLi4vLi4vbGliL3NoYXJlZC1tb2Nrcyc7XG5pbXBvcnQgeyBcbiAgUGxheWVyQmFzZSwgXG4gIEVucmljaGVkUGxheWVyQmFzZVxufSBmcm9tICcuLi90eXBlcy9nYW1lLWJhc2UtdHlwZXMnO1xuXG5jb25zdCBkeW5hbW9DbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xuY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGR5bmFtb0NsaWVudCk7XG5jb25zdCBsb2dnZXIgPSBuZXcgU3RydWN0dXJlZExvZ2dlcignR2V0QmFzZURldGFpbHNIYW5kbGVyJyk7XG5cbmNvbnN0IFBMQVlFUl9CQVNFU19UQUJMRSA9IHByb2Nlc3MuZW52LlBMQVlFUl9CQVNFU19UQUJMRSA/PyAnJztcbmNvbnN0IEJBU0VfVVBHUkFERVNfVEFCTEUgPSBwcm9jZXNzLmVudi5CQVNFX1VQR1JBREVTX1RBQkxFID8/ICcnO1xuXG4vKipcbiAqIEdldCBCYXNlIERldGFpbHMgSGFuZGxlclxuICogXG4gKiBQcm92aWRlcyBjb21wcmVoZW5zaXZlIGJhc2UgaW5mb3JtYXRpb24gZm9sbG93aW5nIFNPTElEIHByaW5jaXBsZXM6XG4gKiAtIFNpbmdsZSBSZXNwb25zaWJpbGl0eTogT25seSBoYW5kbGVzIGRldGFpbGVkIGJhc2UgaW5mb3JtYXRpb24gcmV0cmlldmFsXG4gKiAtIE9wZW4vQ2xvc2VkOiBFeHRlbnNpYmxlIGZvciBhZGRpdGlvbmFsIGRldGFpbCB0eXBlc1xuICogLSBMaXNrb3YgU3Vic3RpdHV0aW9uOiBDb25zaXN0ZW50IGRldGFpbCBpbnRlcmZhY2UgZm9yIGFsbCBiYXNlIHR5cGVzXG4gKiAtIEludGVyZmFjZSBTZWdyZWdhdGlvbjogRm9jdXNlZCBvbiBzcGVjaWZpYyBiYXNlIGRldGFpbCBuZWVkc1xuICogLSBEZXBlbmRlbmN5IEludmVyc2lvbjogRGVwZW5kcyBvbiBzaGFyZWQgZGF0YSBhY2Nlc3MgcGF0dGVybnNcbiAqIFxuICogRmVhdHVyZXM6XG4gKiAtIENvbXBsZXRlIGJhc2UgaW5mb3JtYXRpb24gd2l0aCBhbGwgc3RhdHNcbiAqIC0gQWN0aXZlIHVwZ3JhZGUgaW5mb3JtYXRpb25cbiAqIC0gTW92ZW1lbnQgc3RhdHVzIGFuZCB0aW1pbmdcbiAqIC0gSGlzdG9yaWNhbCB1cGdyYWRlIGluZm9ybWF0aW9uXG4gKiAtIFRlcnJpdG9yeSBhbmQgYWxsaWFuY2UgY29udGV4dFxuICogLSBSZXNvdXJjZSBwcm9kdWN0aW9uIGNhbGN1bGF0aW9uc1xuICovXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcbiAgZXZlbnQ6IEFQSUdhdGV3YXlQcm94eUV2ZW50XG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xuICByZXR1cm4gd2l0aEVycm9ySGFuZGxpbmcoYXN5bmMgKCkgPT4ge1xuICAgIGxvZ2dlci5pbmZvKCdQcm9jZXNzaW5nIGdldCBiYXNlIGRldGFpbHMgcmVxdWVzdCcsIHsgXG4gICAgICByZXF1ZXN0SWQ6IGV2ZW50LnJlcXVlc3RDb250ZXh0Py5yZXF1ZXN0SWQgXG4gICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IHBhcmFtZXRlcnMgZnJvbSBwYXRoXG4gICAgY29uc3QgcGxheWVySWQgPSBldmVudC5wYXRoUGFyYW1ldGVycz8ucGxheWVySWQ7XG4gICAgY29uc3QgYmFzZUlkID0gZXZlbnQucGF0aFBhcmFtZXRlcnM/LmJhc2VJZDtcblxuICAgIGlmICghcGxheWVySWQgfHwgIWJhc2VJZCkge1xuICAgICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcihcbiAgICAgICAgJ01pc3NpbmcgcmVxdWlyZWQgcGFyYW1ldGVyczogcGxheWVySWQgYW5kIGJhc2VJZCcsXG4gICAgICAgICdJTlZBTElEX1BBUkFNRVRFUlMnLFxuICAgICAgICB7IHBsYXllcklkLCBiYXNlSWQgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBHZXQgYmFzZSBkZXRhaWxzXG4gICAgY29uc3QgYmFzZURldGFpbHMgPSBhd2FpdCBnZXRCYXNlRGV0YWlscyhwbGF5ZXJJZCwgYmFzZUlkKTtcbiAgICBcbiAgICAvLyBHZXQgYWN0aXZlIHVwZ3JhZGVzXG4gICAgY29uc3QgYWN0aXZlVXBncmFkZXMgPSBhd2FpdCBnZXRBY3RpdmVVcGdyYWRlcyhwbGF5ZXJJZCwgYmFzZUlkKTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgYWRkaXRpb25hbCBtZXRyaWNzXG4gICAgY29uc3QgbWV0cmljcyA9IGNhbGN1bGF0ZUJhc2VNZXRyaWNzKGJhc2VEZXRhaWxzLCBhY3RpdmVVcGdyYWRlcyk7XG5cbiAgICBsb2dnZXIuaW5mbygnQmFzZSBkZXRhaWxzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknLCB7XG4gICAgICBwbGF5ZXJJZCxcbiAgICAgIGJhc2VJZCxcbiAgICAgIGJhc2VUeXBlOiBiYXNlRGV0YWlscy5iYXNlVHlwZSxcbiAgICAgIHN0YXR1czogYmFzZURldGFpbHMuc3RhdHVzXG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonXG4gICAgICB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgYmFzZTogYmFzZURldGFpbHMsXG4gICAgICAgICAgYWN0aXZlVXBncmFkZXM6IGFjdGl2ZVVwZ3JhZGVzLFxuICAgICAgICAgIG1ldHJpY3M6IG1ldHJpY3NcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICB9LCBsb2dnZXIpO1xufTtcblxuYXN5bmMgZnVuY3Rpb24gZ2V0QmFzZURldGFpbHMocGxheWVySWQ6IHN0cmluZywgYmFzZUlkOiBzdHJpbmcpOiBQcm9taXNlPEVucmljaGVkUGxheWVyQmFzZT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgR2V0Q29tbWFuZCh7XG4gICAgICBUYWJsZU5hbWU6IFBMQVlFUl9CQVNFU19UQUJMRSxcbiAgICAgIEtleTogeyBwbGF5ZXJJZCwgYmFzZUlkIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgXG4gICAgaWYgKCFyZXNwb25zZS5JdGVtKSB7XG4gICAgICB0aHJvdyBuZXcgR2FtZUVuZ2luZUVycm9yKFxuICAgICAgICAnQmFzZSBub3QgZm91bmQnLFxuICAgICAgICAnQkFTRV9OT1RfRk9VTkQnLFxuICAgICAgICB7IHBsYXllcklkLCBiYXNlSWQgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBiYXNlID0gcmVzcG9uc2UuSXRlbSBhcyBQbGF5ZXJCYXNlO1xuICAgIFxuICAgIC8vIEVucmljaCBiYXNlIGRhdGEgd2l0aCBjb21wdXRlZCBmaWVsZHNcbiAgICBjb25zdCBlbnJpY2hlZEJhc2UgPSB7XG4gICAgICAuLi5iYXNlLFxuICAgICAgXG4gICAgICAvLyBTdGF0dXMgaW5mb3JtYXRpb25cbiAgICAgIGlzQWN0aXZlOiBiYXNlLnN0YXR1cyA9PT0gJ2FjdGl2ZScsXG4gICAgICBpc0J1aWxkaW5nOiBiYXNlLnN0YXR1cyA9PT0gJ2J1aWxkaW5nJyxcbiAgICAgIGlzTW92aW5nOiBiYXNlLnN0YXR1cyA9PT0gJ21vdmluZycsXG4gICAgICBpc0Rlc3Ryb3llZDogYmFzZS5zdGF0dXMgPT09ICdkZXN0cm95ZWQnLFxuICAgICAgXG4gICAgICAvLyBUaW1pbmcgaW5mb3JtYXRpb25cbiAgICAgIGFnZUluRGF5czogTWF0aC5mbG9vcigoRGF0ZS5ub3coKSAtIGJhc2UuY3JlYXRlZEF0KSAvICgyNCAqIDYwICogNjAgKiAxMDAwKSksXG4gICAgICBsYXN0QWN0aXZlSG91cnM6IE1hdGguZmxvb3IoKERhdGUubm93KCkgLSBiYXNlLmxhc3RBY3RpdmVBdCkgLyAoNjAgKiA2MCAqIDEwMDApKSxcbiAgICAgIFxuICAgICAgLy8gQ29vcmRpbmF0ZSBpbmZvcm1hdGlvblxuICAgICAgbG9jYXRpb246IGAke2Jhc2UuY29vcmRpbmF0ZXMueH0sICR7YmFzZS5jb29yZGluYXRlcy55fWAsXG4gICAgICBtYXBTZWN0aW9uOiBiYXNlLm1hcFNlY3Rpb25JZCxcbiAgICAgIFxuICAgICAgLy8gTW92ZW1lbnQgaW5mb3JtYXRpb25cbiAgICAgIGNhbk1vdmU6IGJhc2Uuc3RhdHVzID09PSAnYWN0aXZlJyAmJiAoIWJhc2UubGFzdE1vdmVkQXQgfHwgXG4gICAgICAgIChEYXRlLm5vdygpIC0gYmFzZS5sYXN0TW92ZWRBdCkgPj0gKDYwICogNjAgKiAxMDAwKSksXG4gICAgICBtb3ZlbWVudENvb2xkb3duUmVtYWluaW5nOiBiYXNlLmxhc3RNb3ZlZEF0ID8gXG4gICAgICAgIE1hdGgubWF4KDAsICg2MCAqIDYwICogMTAwMCkgLSAoRGF0ZS5ub3coKSAtIGJhc2UubGFzdE1vdmVkQXQpKSA6IDAsXG4gICAgICBcbiAgICAgIC8vIEJ1aWxkaW5nL01vdmVtZW50IGNvbXBsZXRpb24gdGltZXNcbiAgICAgIC4uLihiYXNlLnN0YXR1cyA9PT0gJ2J1aWxkaW5nJyAmJiBiYXNlLmJ1aWxkQ29tcGxldGlvblRpbWUgJiYge1xuICAgICAgICBidWlsZGluZ0NvbXBsZXRlc0luOiBNYXRoLm1heCgwLCBiYXNlLmJ1aWxkQ29tcGxldGlvblRpbWUgLSBEYXRlLm5vdygpKSxcbiAgICAgICAgYnVpbGRpbmdDb21wbGV0ZXNBdDogbmV3IERhdGUoYmFzZS5idWlsZENvbXBsZXRpb25UaW1lKS50b0lTT1N0cmluZygpXG4gICAgICB9KSxcbiAgICAgIFxuICAgICAgLi4uKGJhc2Uuc3RhdHVzID09PSAnbW92aW5nJyAmJiBiYXNlLmFycml2YWxUaW1lICYmIHtcbiAgICAgICAgYXJyaXZhbEluOiBNYXRoLm1heCgwLCBiYXNlLmFycml2YWxUaW1lIC0gRGF0ZS5ub3coKSksXG4gICAgICAgIGFycml2YWxBdDogbmV3IERhdGUoYmFzZS5hcnJpdmFsVGltZSkudG9JU09TdHJpbmcoKVxuICAgICAgfSksXG4gICAgICBcbiAgICAgIC8vIFJlc291cmNlIHByb2R1Y3Rpb24gKGNhbGN1bGF0ZWQgYmFzZWQgb24gYmFzZSBzdGF0cylcbiAgICAgIHJlc291cmNlUHJvZHVjdGlvbjoge1xuICAgICAgICBnb2xkOiBjYWxjdWxhdGVHb2xkUHJvZHVjdGlvbihiYXNlKSxcbiAgICAgICAgZm9vZDogY2FsY3VsYXRlRm9vZFByb2R1Y3Rpb24oYmFzZSksXG4gICAgICAgIG1hdGVyaWFsczogY2FsY3VsYXRlTWF0ZXJpYWxzUHJvZHVjdGlvbihiYXNlKSxcbiAgICAgICAgZW5lcmd5OiBjYWxjdWxhdGVFbmVyZ3lQcm9kdWN0aW9uKGJhc2UpXG4gICAgICB9LFxuICAgICAgXG4gICAgICAvLyBEZWZlbnNlIGNhbGN1bGF0aW9uc1xuICAgICAgZGVmZW5zZVJhdGluZzogY2FsY3VsYXRlRGVmZW5zZVJhdGluZyhiYXNlKSxcbiAgICAgIFxuICAgICAgLy8gU3RvcmFnZSBpbmZvcm1hdGlvblxuICAgICAgc3RvcmFnZUNhcGFjaXR5OiBiYXNlLnN0YXRzPy5zdG9yYWdlID8/IDAsXG4gICAgICBcbiAgICAgIC8vIEFsbGlhbmNlIGNvbnRleHRcbiAgICAgIC4uLihiYXNlLmFsbGlhbmNlSWQgJiYge1xuICAgICAgICBhbGxpYW5jZUlkOiBiYXNlLmFsbGlhbmNlSWQsXG4gICAgICAgIC8vIFRPRE86IEdldCBhbGxpYW5jZSBuYW1lIGFuZCBvdGhlciBkZXRhaWxzIGZyb20gYWxsaWFuY2Ugc2VydmljZVxuICAgICAgfSlcbiAgICB9O1xuXG4gICAgcmV0dXJuIGVucmljaGVkQmFzZSBhcyB1bmtub3duIGFzIEVucmljaGVkUGxheWVyQmFzZTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIEdhbWVFbmdpbmVFcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcihcbiAgICAgICdGYWlsZWQgdG8gcmV0cmlldmUgYmFzZSBkZXRhaWxzJyxcbiAgICAgICdCQVNFX1JFVFJJRVZBTF9FUlJPUicsXG4gICAgICB7IHBsYXllcklkLCBiYXNlSWQsIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfVxuICAgICk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QWN0aXZlVXBncmFkZXMocGxheWVySWQ6IHN0cmluZywgYmFzZUlkOiBzdHJpbmcpOiBQcm9taXNlPHVua25vd25bXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogQkFTRV9VUEdSQURFU19UQUJMRSxcbiAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICdwbGF5ZXJJZCA9IDpwbGF5ZXJJZCcsXG4gICAgICBGaWx0ZXJFeHByZXNzaW9uOiAnYmFzZUlkID0gOmJhc2VJZCBBTkQgI3N0YXR1cyA9IDpzdGF0dXMnLFxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICcjc3RhdHVzJzogJ3N0YXR1cydcbiAgICAgIH0sXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6cGxheWVySWQnOiBwbGF5ZXJJZCxcbiAgICAgICAgJzpiYXNlSWQnOiBiYXNlSWQsXG4gICAgICAgICc6c3RhdHVzJzogJ2luX3Byb2dyZXNzJ1xuICAgICAgfSxcbiAgICAgIFNjYW5JbmRleEZvcndhcmQ6IGZhbHNlIC8vIE1vc3QgcmVjZW50IGZpcnN0XG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgIFxuICAgIHJldHVybiAocmVzcG9uc2UuSXRlbXMgfHwgW10pLm1hcCh1cGdyYWRlID0+ICh7XG4gICAgICAuLi51cGdyYWRlLFxuICAgICAgXG4gICAgICAvLyBUaW1pbmcgaW5mb3JtYXRpb25cbiAgICAgIGNvbXBsZXRlc0luOiBNYXRoLm1heCgwLCB1cGdyYWRlLmNvbXBsZXRpb25UaW1lIC0gRGF0ZS5ub3coKSksXG4gICAgICBjb21wbGV0ZXNBdDogbmV3IERhdGUodXBncmFkZS5jb21wbGV0aW9uVGltZSkudG9JU09TdHJpbmcoKSxcbiAgICAgIHByb2dyZXNzOiBNYXRoLm1pbigxLCAoRGF0ZS5ub3coKSAtIHVwZ3JhZGUuc3RhcnRlZEF0KSAvICh1cGdyYWRlLmNvbXBsZXRpb25UaW1lIC0gdXBncmFkZS5zdGFydGVkQXQpKSxcbiAgICAgIFxuICAgICAgLy8gVXBncmFkZSBkZXRhaWxzXG4gICAgICBsZXZlbENoYW5nZTogYCR7dXBncmFkZS5mcm9tTGV2ZWx9IOKGkiAke3VwZ3JhZGUudG9MZXZlbH1gLFxuICAgICAgdGltZVJlbWFpbmluZzogTWF0aC5tYXgoMCwgdXBncmFkZS5jb21wbGV0aW9uVGltZSAtIERhdGUubm93KCkpXG4gICAgfSkpO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byByZXRyaWV2ZSBhY3RpdmUgdXBncmFkZXMnLCB7IFxuICAgICAgcGxheWVySWQsIFxuICAgICAgYmFzZUlkLCBcbiAgICAgIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgXG4gICAgfSk7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZUJhc2VNZXRyaWNzKGJhc2U6IGFueSwgYWN0aXZlVXBncmFkZXM6IGFueVtdKTogYW55IHtcbiAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgXG4gIHJldHVybiB7XG4gICAgLy8gT3ZlcmFsbCBiYXNlIHNjb3JlIChjb21wb3NpdGUgbWV0cmljKVxuICAgIGJhc2VTY29yZTogY2FsY3VsYXRlQmFzZVNjb3JlKGJhc2UpLFxuICAgIFxuICAgIC8vIEVmZmljaWVuY3kgbWV0cmljc1xuICAgIGVmZmljaWVuY3k6IHtcbiAgICAgIHByb2R1Y3Rpb25FZmZpY2llbmN5OiBjYWxjdWxhdGVQcm9kdWN0aW9uRWZmaWNpZW5jeShiYXNlKSxcbiAgICAgIGRlZmVuc2VFZmZpY2llbmN5OiBjYWxjdWxhdGVEZWZlbnNlRWZmaWNpZW5jeShiYXNlKSxcbiAgICAgIHN0b3JhZ2VFZmZpY2llbmN5OiBjYWxjdWxhdGVTdG9yYWdlRWZmaWNpZW5jeShiYXNlKVxuICAgIH0sXG4gICAgXG4gICAgLy8gQWN0aXZpdHkgbWV0cmljc1xuICAgIGFjdGl2aXR5OiB7XG4gICAgICBsYXN0QWN0aXZlSG91cnM6IE1hdGguZmxvb3IoKG5vdyAtIGJhc2UubGFzdEFjdGl2ZUF0KSAvICg2MCAqIDYwICogMTAwMCkpLFxuICAgICAgdG90YWxVcGdyYWRlczogYWN0aXZlVXBncmFkZXMubGVuZ3RoLFxuICAgICAgaXNBY3RpdmVseURldmVsb3Bpbmc6IGFjdGl2ZVVwZ3JhZGVzLmxlbmd0aCA+IDAgfHwgXG4gICAgICAgIChiYXNlLmxhc3RBY3RpdmVBdCAmJiAobm93IC0gYmFzZS5sYXN0QWN0aXZlQXQpIDwgKDI0ICogNjAgKiA2MCAqIDEwMDApKVxuICAgIH0sXG4gICAgXG4gICAgLy8gU3RyYXRlZ2ljIG1ldHJpY3NcbiAgICBzdHJhdGVnaWM6IHtcbiAgICAgIHRlcnJpdG9yeVZhbHVlOiBjYWxjdWxhdGVUZXJyaXRvcnlWYWx1ZShiYXNlKSxcbiAgICAgIGRlZmVuc2l2ZVBvc2l0aW9uOiBjYWxjdWxhdGVEZWZlbnNpdmVQb3NpdGlvbihiYXNlKSxcbiAgICAgIHJlc291cmNlQWNjZXNzaWJpbGl0eTogY2FsY3VsYXRlUmVzb3VyY2VBY2Nlc3NpYmlsaXR5KGJhc2UpXG4gICAgfSxcbiAgICBcbiAgICAvLyBSZWNvbW1lbmRhdGlvbnNcbiAgICByZWNvbW1lbmRhdGlvbnM6IGdlbmVyYXRlUmVjb21tZW5kYXRpb25zKGJhc2UsIGFjdGl2ZVVwZ3JhZGVzKVxuICB9O1xufVxuXG4vLyBDYWxjdWxhdGlvbiBoZWxwZXIgZnVuY3Rpb25zXG5mdW5jdGlvbiBjYWxjdWxhdGVHb2xkUHJvZHVjdGlvbihiYXNlOiBhbnkpOiBudW1iZXIge1xuICBjb25zdCBiYXNlUHJvZHVjdGlvbiA9IGJhc2Uuc3RhdHM/LnByb2R1Y3Rpb24gPz8gMDtcbiAgY29uc3QgbGV2ZWxNdWx0aXBsaWVyID0gMSArIChiYXNlLmxldmVsICogMC4xKTtcbiAgcmV0dXJuIE1hdGguZmxvb3IoYmFzZVByb2R1Y3Rpb24gKiBsZXZlbE11bHRpcGxpZXIgKiAwLjQpOyAvLyA0MCUgb2YgcHJvZHVjdGlvbiBnb2VzIHRvIGdvbGRcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlRm9vZFByb2R1Y3Rpb24oYmFzZTogYW55KTogbnVtYmVyIHtcbiAgY29uc3QgYmFzZVByb2R1Y3Rpb24gPSBiYXNlLnN0YXRzPy5wcm9kdWN0aW9uID8/IDA7XG4gIGNvbnN0IGxldmVsTXVsdGlwbGllciA9IDEgKyAoYmFzZS5sZXZlbCAqIDAuMSk7XG4gIHJldHVybiBNYXRoLmZsb29yKGJhc2VQcm9kdWN0aW9uICogbGV2ZWxNdWx0aXBsaWVyICogMC4zKTsgLy8gMzAlIHRvIGZvb2Rcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlTWF0ZXJpYWxzUHJvZHVjdGlvbihiYXNlOiBhbnkpOiBudW1iZXIge1xuICBjb25zdCBiYXNlUHJvZHVjdGlvbiA9IGJhc2Uuc3RhdHM/LnByb2R1Y3Rpb24gPz8gMDtcbiAgY29uc3QgbGV2ZWxNdWx0aXBsaWVyID0gMSArIChiYXNlLmxldmVsICogMC4xKTtcbiAgcmV0dXJuIE1hdGguZmxvb3IoYmFzZVByb2R1Y3Rpb24gKiBsZXZlbE11bHRpcGxpZXIgKiAwLjIpOyAvLyAyMCUgdG8gbWF0ZXJpYWxzXG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZUVuZXJneVByb2R1Y3Rpb24oYmFzZTogYW55KTogbnVtYmVyIHtcbiAgY29uc3QgYmFzZVByb2R1Y3Rpb24gPSBiYXNlLnN0YXRzPy5wcm9kdWN0aW9uID8/IDA7XG4gIGNvbnN0IGxldmVsTXVsdGlwbGllciA9IDEgKyAoYmFzZS5sZXZlbCAqIDAuMSk7XG4gIHJldHVybiBNYXRoLmZsb29yKGJhc2VQcm9kdWN0aW9uICogbGV2ZWxNdWx0aXBsaWVyICogMC4xKTsgLy8gMTAlIHRvIGVuZXJneVxufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVEZWZlbnNlUmF0aW5nKGJhc2U6IGFueSk6IHN0cmluZyB7XG4gIGNvbnN0IGRlZmVuc2UgPSBiYXNlLnN0YXRzPy5kZWZlbnNlID8/IDA7XG4gIGlmIChkZWZlbnNlIDwgNTApIHJldHVybiAnV2Vhayc7XG4gIGlmIChkZWZlbnNlIDwgMTUwKSByZXR1cm4gJ01vZGVyYXRlJztcbiAgaWYgKGRlZmVuc2UgPCAzMDApIHJldHVybiAnU3Ryb25nJztcbiAgaWYgKGRlZmVuc2UgPCA1MDApIHJldHVybiAnRm9ydGlmaWVkJztcbiAgcmV0dXJuICdJbXBlbmV0cmFibGUnO1xufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVCYXNlU2NvcmUoYmFzZTogYW55KTogbnVtYmVyIHtcbiAgY29uc3QgbGV2ZWwgPSBiYXNlLmxldmVsIHx8IDE7XG4gIGNvbnN0IHN0YXRzID0gYmFzZS5zdGF0cyB8fCB7fTtcbiAgY29uc3QgZGVmZW5zZSA9IHN0YXRzLmRlZmVuc2UgPz8gMDtcbiAgY29uc3QgcHJvZHVjdGlvbiA9IHN0YXRzLnByb2R1Y3Rpb24gPz8gMDtcbiAgY29uc3Qgc3RvcmFnZSA9IHN0YXRzLnN0b3JhZ2UgPz8gMDtcbiAgXG4gIHJldHVybiBNYXRoLmZsb29yKChsZXZlbCAqIDEwMCkgKyAoZGVmZW5zZSAqIDAuNSkgKyAocHJvZHVjdGlvbiAqIDIpICsgKHN0b3JhZ2UgKiAwLjEpKTtcbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlUHJvZHVjdGlvbkVmZmljaWVuY3koYmFzZTogYW55KTogbnVtYmVyIHtcbiAgY29uc3QgZXhwZWN0ZWRQcm9kdWN0aW9uID0gYmFzZS5sZXZlbCAqIDUwOyAvLyBFeHBlY3RlZCBwcm9kdWN0aW9uIHBlciBsZXZlbFxuICBjb25zdCBhY3R1YWxQcm9kdWN0aW9uID0gYmFzZS5zdGF0cz8ucHJvZHVjdGlvbiA/PyAwO1xuICByZXR1cm4gTWF0aC5taW4oMSwgYWN0dWFsUHJvZHVjdGlvbiAvIGV4cGVjdGVkUHJvZHVjdGlvbik7XG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZURlZmVuc2VFZmZpY2llbmN5KGJhc2U6IGFueSk6IG51bWJlciB7XG4gIGNvbnN0IGV4cGVjdGVkRGVmZW5zZSA9IGJhc2UubGV2ZWwgKiAzMDsgLy8gRXhwZWN0ZWQgZGVmZW5zZSBwZXIgbGV2ZWxcbiAgY29uc3QgYWN0dWFsRGVmZW5zZSA9IGJhc2Uuc3RhdHM/LmRlZmVuc2UgPz8gMDtcbiAgcmV0dXJuIE1hdGgubWluKDEsIGFjdHVhbERlZmVuc2UgLyBleHBlY3RlZERlZmVuc2UpO1xufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVTdG9yYWdlRWZmaWNpZW5jeShiYXNlOiBhbnkpOiBudW1iZXIge1xuICBjb25zdCBleHBlY3RlZFN0b3JhZ2UgPSBiYXNlLmxldmVsICogMjAwOyAvLyBFeHBlY3RlZCBzdG9yYWdlIHBlciBsZXZlbFxuICBjb25zdCBhY3R1YWxTdG9yYWdlID0gYmFzZS5zdGF0cz8uc3RvcmFnZSA/PyAwO1xuICByZXR1cm4gTWF0aC5taW4oMSwgYWN0dWFsU3RvcmFnZSAvIGV4cGVjdGVkU3RvcmFnZSk7XG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZVRlcnJpdG9yeVZhbHVlKGJhc2U6IGFueSk6IG51bWJlciB7XG4gIC8vIFNpbXBsZSB0ZXJyaXRvcnkgdmFsdWUgYmFzZWQgb24gY29vcmRpbmF0ZXMgKGNsb3NlciB0byBjZW50ZXIgPSBoaWdoZXIgdmFsdWUpXG4gIGNvbnN0IGRpc3RhbmNlRnJvbUNlbnRlciA9IE1hdGguc3FydChiYXNlLmNvb3JkaW5hdGVzLnggKiogMiArIGJhc2UuY29vcmRpbmF0ZXMueSAqKiAyKTtcbiAgcmV0dXJuIE1hdGgubWF4KDAuMSwgMSAtIChkaXN0YW5jZUZyb21DZW50ZXIgLyAxMDAwMCkpO1xufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVEZWZlbnNpdmVQb3NpdGlvbihiYXNlOiBhbnkpOiBzdHJpbmcge1xuICBjb25zdCB4ID0gTWF0aC5hYnMoYmFzZS5jb29yZGluYXRlcy54KTtcbiAgY29uc3QgeSA9IE1hdGguYWJzKGJhc2UuY29vcmRpbmF0ZXMueSk7XG4gIFxuICBpZiAoeCA8IDEwMCAmJiB5IDwgMTAwKSByZXR1cm4gJ0NlbnRyYWwgSHViJztcbiAgaWYgKHggPiAxMDAwIHx8IHkgPiAxMDAwKSByZXR1cm4gJ1JlbW90ZSBPdXRwb3N0JztcbiAgcmV0dXJuICdTdGFuZGFyZCBQb3NpdGlvbic7XG59XG5cbmZ1bmN0aW9uIGNhbGN1bGF0ZVJlc291cmNlQWNjZXNzaWJpbGl0eShiYXNlOiBhbnkpOiBudW1iZXIge1xuICAvLyBTaW1wbGlmaWVkIGNhbGN1bGF0aW9uIGJhc2VkIG9uIG1hcCBwb3NpdGlvblxuICAvLyBUT0RPOiBJbnRlZ3JhdGUgd2l0aCBhY3R1YWwgcmVzb3VyY2Ugbm9kZSBsb2NhdGlvbnNcbiAgcmV0dXJuIE1hdGgucmFuZG9tKCkgKiAwLjQgKyAwLjY7IC8vIFJhbmRvbSBiZXR3ZWVuIDAuNi0xLjAgZm9yIG5vd1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVJlY29tbWVuZGF0aW9ucyhiYXNlOiBhbnksIGFjdGl2ZVVwZ3JhZGVzOiBhbnlbXSk6IHN0cmluZ1tdIHtcbiAgY29uc3QgcmVjb21tZW5kYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICBcbiAgaWYgKGJhc2UubGV2ZWwgPCA1KSB7XG4gICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ0NvbnNpZGVyIHVwZ3JhZGluZyBiYXNlIGxldmVsIGZvciBpbXByb3ZlZCBzdGF0cycpO1xuICB9XG4gIFxuICBpZiAoYmFzZS5zdGF0cz8uZGVmZW5zZSA8IGJhc2UubGV2ZWwgKiAyMCkge1xuICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCdEZWZlbnNlIGlzIGJlbG93IHJlY29tbWVuZGVkIGxldmVsIC0gY29uc2lkZXIgZGVmZW5zaXZlIHVwZ3JhZGVzJyk7XG4gIH1cbiAgXG4gIGlmIChiYXNlLnN0YXRzPy5wcm9kdWN0aW9uIDwgYmFzZS5sZXZlbCAqIDQwKSB7XG4gICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ1Byb2R1Y3Rpb24gY291bGQgYmUgaW1wcm92ZWQgd2l0aCByZXNvdXJjZSB1cGdyYWRlcycpO1xuICB9XG4gIFxuICBpZiAoYWN0aXZlVXBncmFkZXMubGVuZ3RoID09PSAwICYmIGJhc2Uuc3RhdHVzID09PSAnYWN0aXZlJykge1xuICAgIHJlY29tbWVuZGF0aW9ucy5wdXNoKCdCYXNlIGlzIGlkbGUgLSBjb25zaWRlciBzdGFydGluZyBhbiB1cGdyYWRlJyk7XG4gIH1cbiAgXG4gIGlmICghYmFzZS5hbGxpYW5jZUlkKSB7XG4gICAgcmVjb21tZW5kYXRpb25zLnB1c2goJ0pvaW5pbmcgYW4gYWxsaWFuY2UgcHJvdmlkZXMgc3RyYXRlZ2ljIGFkdmFudGFnZXMnKTtcbiAgfVxuICBcbiAgY29uc3QgdGltZVNpbmNlTW92ZSA9IGJhc2UubGFzdE1vdmVkQXQgPyBEYXRlLm5vdygpIC0gYmFzZS5sYXN0TW92ZWRBdCA6IEluZmluaXR5O1xuICBpZiAodGltZVNpbmNlTW92ZSA+ICgzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDApKSB7IC8vIDMwIGRheXNcbiAgICByZWNvbW1lbmRhdGlvbnMucHVzaCgnQ29uc2lkZXIgcmVsb2NhdGluZyBmb3IgYmV0dGVyIHN0cmF0ZWdpYyBwb3NpdGlvbmluZycpO1xuICB9XG4gIFxuICByZXR1cm4gcmVjb21tZW5kYXRpb25zO1xufSJdfQ==
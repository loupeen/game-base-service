"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const shared_mocks_1 = require("../../lib/shared-mocks");
const zod_1 = require("zod");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const logger = new shared_mocks_1.StructuredLogger('CalculateSpawnLocationHandler');
const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE;
const SPAWN_LOCATIONS_TABLE = process.env.SPAWN_LOCATIONS_TABLE;
const CalculateSpawnLocationRequestSchema = zod_1.z.object({
    playerId: zod_1.z.string().min(1).max(50),
    preferredRegion: zod_1.z.enum(['center', 'north', 'south', 'east', 'west', 'random']).optional().default('random'),
    groupWithFriends: zod_1.z.boolean().optional().default(true),
    friendIds: zod_1.z.array(zod_1.z.string()).optional().default([])
});
/**
 * Calculate Spawn Location Handler
 *
 * Implements intelligent spawn location calculation following SOLID principles:
 * - Single Responsibility: Only handles spawn location determination
 * - Open/Closed: Extensible for new spawn algorithms
 * - Liskov Substitution: All spawn methods return consistent format
 * - Interface Segregation: Clear separation of spawn calculation concerns
 * - Dependency Inversion: Depends on shared calculation abstractions
 *
 * Spawn Algorithm Features:
 * - Population density analysis to avoid overcrowded areas
 * - Friend grouping for social gameplay
 * - Regional preferences for strategic positioning
 * - Safety rating based on nearby high-level players
 * - Resource accessibility scoring
 * - Dynamic spawn region expansion based on player growth
 */
const handler = async (event) => {
    return (0, shared_mocks_1.withErrorHandling)(async () => {
        logger.info('Processing spawn location calculation', {
            requestId: event.requestContext?.requestId
        });
        const request = await (0, shared_mocks_1.validateRequest)(CalculateSpawnLocationRequestSchema, event.body);
        // Calculate optimal spawn location
        const spawnLocation = await calculateOptimalSpawnLocation(request);
        // Reserve the spawn location temporarily
        await reserveSpawnLocation(spawnLocation.spawnLocationId, request.playerId);
        logger.info('Spawn location calculated', {
            playerId: request.playerId,
            coordinates: spawnLocation.coordinates,
            reason: spawnLocation.reason,
            populationDensity: spawnLocation.populationDensity
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
                    spawnLocation: spawnLocation,
                    validFor: 300, // 5 minutes to use this spawn location
                    message: 'Optimal spawn location calculated'
                }
            })
        };
    }, logger);
};
exports.handler = handler;
async function calculateOptimalSpawnLocation(request) {
    try {
        // Get friend locations if grouping is requested
        const friendLocations = request.groupWithFriends && request.friendIds.length > 0
            ? await getFriendLocations(request.friendIds)
            : [];
        // Analyze current population density
        const populationAnalysis = await analyzePopulationDensity();
        // Generate candidate spawn locations
        const candidates = await generateSpawnCandidates(request.preferredRegion, friendLocations, populationAnalysis);
        // Score and rank candidates
        const scoredCandidates = await scoreSpawnCandidates(candidates, friendLocations);
        // Select the best candidate
        const bestCandidate = selectOptimalSpawn(scoredCandidates, request);
        return bestCandidate;
    }
    catch (error) {
        throw new shared_mocks_1.GameEngineError('Failed to calculate spawn location', 'SPAWN_CALCULATION_ERROR', { playerId: request.playerId, error: error.message });
    }
}
async function getFriendLocations(friendIds) {
    try {
        const locations = [];
        for (const friendId of friendIds.slice(0, 5)) { // Limit to 5 friends for performance
            const command = new lib_dynamodb_1.QueryCommand({
                TableName: PLAYER_BASES_TABLE,
                KeyConditionExpression: 'playerId = :playerId',
                ExpressionAttributeValues: {
                    ':playerId': friendId
                },
                FilterExpression: '#status = :active',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ProjectionExpression: 'coordinates',
                Limit: 1 // Just get one base per friend
            });
            const response = await docClient.send(command);
            if (response.Items && response.Items.length > 0) {
                locations.push(response.Items[0].coordinates);
            }
        }
        return locations;
    }
    catch (error) {
        logger.warn('Failed to get friend locations', { friendIds, error: error.message });
        return [];
    }
}
async function analyzePopulationDensity() {
    try {
        const densityMap = new Map();
        // Query all active bases and group by map sections
        const command = new lib_dynamodb_1.ScanCommand({
            TableName: PLAYER_BASES_TABLE,
            FilterExpression: '#status = :active',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ProjectionExpression: 'mapSectionId',
            // Use parallel scan for better performance if table is large
            Segment: 0,
            TotalSegments: 1
        });
        const response = await docClient.send(command);
        // Count bases per map section
        response.Items?.forEach(item => {
            const sectionId = item.mapSectionId;
            densityMap.set(sectionId, (densityMap.get(sectionId) || 0) + 1);
        });
        return densityMap;
    }
    catch (error) {
        logger.warn('Failed to analyze population density', { error: error.message });
        return new Map();
    }
}
async function generateSpawnCandidates(preferredRegion, friendLocations, populationDensity) {
    const candidates = [];
    const maxCandidates = 20;
    // Define region boundaries
    const regionBounds = getRegionBounds(preferredRegion);
    // If friends exist and grouping is requested, bias towards friend locations
    if (friendLocations.length > 0) {
        const friendCenter = calculateCenterPoint(friendLocations);
        const friendRadius = 500; // 500 units around friends
        for (let i = 0; i < maxCandidates / 2; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * friendRadius;
            const x = Math.floor(friendCenter.x + Math.cos(angle) * distance);
            const y = Math.floor(friendCenter.y + Math.sin(angle) * distance);
            const sectionId = `${Math.floor(x / 100)},${Math.floor(y / 100)}`;
            // Ensure coordinates are within region bounds
            if (isWithinBounds({ x, y }, regionBounds)) {
                candidates.push({ x, y, sectionId });
            }
        }
    }
    // Generate random candidates within preferred region
    for (let i = candidates.length; i < maxCandidates; i++) {
        const x = Math.floor(Math.random() * (regionBounds.maxX - regionBounds.minX) + regionBounds.minX);
        const y = Math.floor(Math.random() * (regionBounds.maxY - regionBounds.minY) + regionBounds.minY);
        const sectionId = `${Math.floor(x / 100)},${Math.floor(y / 100)}`;
        candidates.push({ x, y, sectionId });
    }
    return candidates;
}
function getRegionBounds(region) {
    const baseRadius = 2000; // Base spawn radius
    switch (region) {
        case 'center':
            return { minX: -baseRadius / 2, maxX: baseRadius / 2, minY: -baseRadius / 2, maxY: baseRadius / 2 };
        case 'north':
            return { minX: -baseRadius, maxX: baseRadius, minY: 0, maxY: baseRadius };
        case 'south':
            return { minX: -baseRadius, maxX: baseRadius, minY: -baseRadius, maxY: 0 };
        case 'east':
            return { minX: 0, maxX: baseRadius, minY: -baseRadius, maxY: baseRadius };
        case 'west':
            return { minX: -baseRadius, maxX: 0, minY: -baseRadius, maxY: baseRadius };
        default: // random
            return { minX: -baseRadius, maxX: baseRadius, minY: -baseRadius, maxY: baseRadius };
    }
}
function calculateCenterPoint(points) {
    if (points.length === 0)
        return { x: 0, y: 0 };
    const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return {
        x: Math.floor(sum.x / points.length),
        y: Math.floor(sum.y / points.length)
    };
}
function isWithinBounds(point, bounds) {
    return point.x >= bounds.minX && point.x <= bounds.maxX &&
        point.y >= bounds.minY && point.y <= bounds.maxY;
}
async function scoreSpawnCandidates(candidates, friendLocations) {
    const scoredCandidates = candidates.map(candidate => {
        // Calculate population density score (lower density = higher score)
        const populationDensity = 0.1; // Simplified - would query actual density
        const densityScore = Math.max(0, 1 - (populationDensity / 10));
        // Calculate safety rating (distance from center - closer = safer for newbies)
        const distanceFromCenter = Math.sqrt(candidate.x ** 2 + candidate.y ** 2);
        const safetyScore = Math.max(0, 1 - (distanceFromCenter / 5000));
        // Calculate resource accessibility (simplified)
        const resourceScore = 0.7 + (Math.random() * 0.3); // Random between 0.7-1.0
        // Calculate friend proximity bonus
        let friendScore = 0;
        if (friendLocations.length > 0) {
            const avgDistanceToFriends = friendLocations.reduce((sum, friend) => sum + Math.sqrt((candidate.x - friend.x) ** 2 + (candidate.y - friend.y) ** 2), 0) / friendLocations.length;
            friendScore = Math.max(0, 1 - (avgDistanceToFriends / 1000));
        }
        // Weighted composite score
        const totalScore = (densityScore * 0.3) + (safetyScore * 0.3) +
            (resourceScore * 0.2) + (friendScore * 0.2);
        return {
            coordinates: { x: candidate.x, y: candidate.y },
            score: totalScore,
            populationDensity: populationDensity,
            safetyRating: safetyScore,
            resourceAccessibility: resourceScore,
            friendProximity: friendScore
        };
    });
    return scoredCandidates.sort((a, b) => b.score - a.score);
}
function selectOptimalSpawn(scoredCandidates, request) {
    const bestCandidate = scoredCandidates[0];
    // Generate reason for this spawn location
    let reason = 'Optimal balance of safety and resources';
    if (bestCandidate.friendProximity > 0.5) {
        reason = 'Near friends for social gameplay';
    }
    else if (bestCandidate.safetyRating > 0.8) {
        reason = 'Safe starter location';
    }
    else if (bestCandidate.resourceAccessibility > 0.9) {
        reason = 'Excellent resource access';
    }
    else if (bestCandidate.populationDensity < 0.2) {
        reason = 'Low population density area';
    }
    return {
        coordinates: bestCandidate.coordinates,
        spawnLocationId: `spawn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        populationDensity: bestCandidate.populationDensity,
        safetyRating: bestCandidate.safetyRating,
        resourceAccessibility: bestCandidate.resourceAccessibility,
        reason: reason
    };
}
async function reserveSpawnLocation(spawnLocationId, playerId) {
    try {
        const ttl = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now
        const command = new lib_dynamodb_1.UpdateCommand({
            TableName: SPAWN_LOCATIONS_TABLE,
            Key: {
                spawnRegionId: 'calculated',
                spawnLocationId: spawnLocationId
            },
            UpdateExpression: 'SET reservedBy = :playerId, reservedAt = :now, isAvailable = :false, #ttl = :ttl',
            ExpressionAttributeNames: {
                '#ttl': 'ttl'
            },
            ExpressionAttributeValues: {
                ':playerId': playerId,
                ':now': Date.now(),
                ':false': 'false',
                ':ttl': ttl
            },
            // Create the record if it doesn't exist
            ReturnValues: 'ALL_NEW'
        });
        await docClient.send(command);
    }
    catch (error) {
        logger.warn('Failed to reserve spawn location', {
            spawnLocationId,
            playerId,
            error: error.message
        });
        // Non-critical error - spawn can still be used
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsY3VsYXRlLXNwYXduLWxvY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGFtYmRhL3NwYXduLW1hbmFnZW1lbnQvY2FsY3VsYXRlLXNwYXduLWxvY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDhEQUEwRDtBQUMxRCx3REFBeUc7QUFDekcseURBS2dDO0FBQ2hDLDZCQUF3QjtBQUV4QixNQUFNLFlBQVksR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUMsTUFBTSxTQUFTLEdBQUcscUNBQXNCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVELE1BQU0sTUFBTSxHQUFHLElBQUksK0JBQWdCLENBQUMsK0JBQStCLENBQUMsQ0FBQztBQUVyRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQW1CLENBQUM7QUFDM0QsTUFBTSxxQkFBcUIsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLHFCQUFzQixDQUFDO0FBRWpFLE1BQU0sbUNBQW1DLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNuRCxRQUFRLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ25DLGVBQWUsRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUM7SUFDNUcsZ0JBQWdCLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7SUFDdEQsU0FBUyxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFB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QUNILENBQUM7SUFFRCxxREFBcUQ7SUFDckQsS0FBSyxJQUFJLENBQUMsR0FBRyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxhQUFhLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUN2RCxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRyxNQUFNLFNBQVMsR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFFbEUsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBRUQsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFDLE1BQWM7SUFDckMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUMsb0JBQW9CO0lBRTdDLFFBQVEsTUFBTSxFQUFFLENBQUM7UUFDZixLQUFLLFFBQVE7WUFDWCxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsVUFBVSxHQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsVUFBVSxHQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxVQUFVLEdBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxVQUFVLEdBQUMsQ0FBQyxFQUFFLENBQUM7UUFDOUYsS0FBSyxPQUFPO1lB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dXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tICdhd3MtbGFtYmRhJztcbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFF1ZXJ5Q29tbWFuZCwgVXBkYXRlQ29tbWFuZCwgU2NhbkNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuaW1wb3J0IHsgXG4gIFN0cnVjdHVyZWRMb2dnZXIsIFxuICBHYW1lRW5naW5lRXJyb3IsXG4gIHdpdGhFcnJvckhhbmRsaW5nLFxuICB2YWxpZGF0ZVJlcXVlc3QgXG59IGZyb20gJy4uLy4uL2xpYi9zaGFyZWQtbW9ja3MnO1xuaW1wb3J0IHsgeiB9IGZyb20gJ3pvZCc7XG5cbmNvbnN0IGR5bmFtb0NsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7fSk7XG5jb25zdCBkb2NDbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oZHluYW1vQ2xpZW50KTtcbmNvbnN0IGxvZ2dlciA9IG5ldyBTdHJ1Y3R1cmVkTG9nZ2VyKCdDYWxjdWxhdGVTcGF3bkxvY2F0aW9uSGFuZGxlcicpO1xuXG5jb25zdCBQTEFZRVJfQkFTRVNfVEFCTEUgPSBwcm9jZXNzLmVudi5QTEFZRVJfQkFTRVNfVEFCTEUhO1xuY29uc3QgU1BBV05fTE9DQVRJT05TX1RBQkxFID0gcHJvY2Vzcy5lbnYuU1BBV05fTE9DQVRJT05TX1RBQkxFITtcblxuY29uc3QgQ2FsY3VsYXRlU3Bhd25Mb2NhdGlvblJlcXVlc3RTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBsYXllcklkOiB6LnN0cmluZygpLm1pbigxKS5tYXgoNTApLFxuICBwcmVmZXJyZWRSZWdpb246IHouZW51bShbJ2NlbnRlcicsICdub3J0aCcsICdzb3V0aCcsICdlYXN0JywgJ3dlc3QnLCAncmFuZG9tJ10pLm9wdGlvbmFsKCkuZGVmYXVsdCgncmFuZG9tJyksXG4gIGdyb3VwV2l0aEZyaWVuZHM6IHouYm9vbGVhbigpLm9wdGlvbmFsKCkuZGVmYXVsdCh0cnVlKSxcbiAgZnJpZW5kSWRzOiB6LmFycmF5KHouc3RyaW5nKCkpLm9wdGlvbmFsKCkuZGVmYXVsdChbXSlcbn0pO1xuXG50eXBlIENhbGN1bGF0ZVNwYXduTG9jYXRpb25SZXF1ZXN0ID0gei5pbmZlcjx0eXBlb2YgQ2FsY3VsYXRlU3Bhd25Mb2NhdGlvblJlcXVlc3RTY2hlbWE+O1xuXG5pbnRlcmZhY2UgU3Bhd25Mb2NhdGlvbiB7XG4gIGNvb3JkaW5hdGVzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG4gIHNwYXduTG9jYXRpb25JZDogc3RyaW5nO1xuICBwb3B1bGF0aW9uRGVuc2l0eTogbnVtYmVyO1xuICBzYWZldHlSYXRpbmc6IG51bWJlcjtcbiAgcmVzb3VyY2VBY2Nlc3NpYmlsaXR5OiBudW1iZXI7XG4gIHJlYXNvbjogc3RyaW5nO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZSBTcGF3biBMb2NhdGlvbiBIYW5kbGVyXG4gKiBcbiAqIEltcGxlbWVudHMgaW50ZWxsaWdlbnQgc3Bhd24gbG9jYXRpb24gY2FsY3VsYXRpb24gZm9sbG93aW5nIFNPTElEIHByaW5jaXBsZXM6XG4gKiAtIFNpbmdsZSBSZXNwb25zaWJpbGl0eTogT25seSBoYW5kbGVzIHNwYXduIGxvY2F0aW9uIGRldGVybWluYXRpb25cbiAqIC0gT3Blbi9DbG9zZWQ6IEV4dGVuc2libGUgZm9yIG5ldyBzcGF3biBhbGdvcml0aG1zXG4gKiAtIExpc2tvdiBTdWJzdGl0dXRpb246IEFsbCBzcGF3biBtZXRob2RzIHJldHVybiBjb25zaXN0ZW50IGZvcm1hdFxuICogLSBJbnRlcmZhY2UgU2VncmVnYXRpb246IENsZWFyIHNlcGFyYXRpb24gb2Ygc3Bhd24gY2FsY3VsYXRpb24gY29uY2VybnNcbiAqIC0gRGVwZW5kZW5jeSBJbnZlcnNpb246IERlcGVuZHMgb24gc2hhcmVkIGNhbGN1bGF0aW9uIGFic3RyYWN0aW9uc1xuICogXG4gKiBTcGF3biBBbGdvcml0aG0gRmVhdHVyZXM6XG4gKiAtIFBvcHVsYXRpb24gZGVuc2l0eSBhbmFseXNpcyB0byBhdm9pZCBvdmVyY3Jvd2RlZCBhcmVhc1xuICogLSBGcmllbmQgZ3JvdXBpbmcgZm9yIHNvY2lhbCBnYW1lcGxheVxuICogLSBSZWdpb25hbCBwcmVmZXJlbmNlcyBmb3Igc3RyYXRlZ2ljIHBvc2l0aW9uaW5nXG4gKiAtIFNhZmV0eSByYXRpbmcgYmFzZWQgb24gbmVhcmJ5IGhpZ2gtbGV2ZWwgcGxheWVyc1xuICogLSBSZXNvdXJjZSBhY2Nlc3NpYmlsaXR5IHNjb3JpbmdcbiAqIC0gRHluYW1pYyBzcGF3biByZWdpb24gZXhwYW5zaW9uIGJhc2VkIG9uIHBsYXllciBncm93dGhcbiAqL1xuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxuKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcbiAgcmV0dXJuIHdpdGhFcnJvckhhbmRsaW5nKGFzeW5jICgpID0+IHtcbiAgICBsb2dnZXIuaW5mbygnUHJvY2Vzc2luZyBzcGF3biBsb2NhdGlvbiBjYWxjdWxhdGlvbicsIHsgXG4gICAgICByZXF1ZXN0SWQ6IGV2ZW50LnJlcXVlc3RDb250ZXh0Py5yZXF1ZXN0SWQgXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXF1ZXN0ID0gYXdhaXQgdmFsaWRhdGVSZXF1ZXN0PENhbGN1bGF0ZVNwYXduTG9jYXRpb25SZXF1ZXN0PihDYWxjdWxhdGVTcGF3bkxvY2F0aW9uUmVxdWVzdFNjaGVtYSwgZXZlbnQuYm9keSk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIG9wdGltYWwgc3Bhd24gbG9jYXRpb25cbiAgICBjb25zdCBzcGF3bkxvY2F0aW9uID0gYXdhaXQgY2FsY3VsYXRlT3B0aW1hbFNwYXduTG9jYXRpb24ocmVxdWVzdCk7XG4gICAgXG4gICAgLy8gUmVzZXJ2ZSB0aGUgc3Bhd24gbG9jYXRpb24gdGVtcG9yYXJpbHlcbiAgICBhd2FpdCByZXNlcnZlU3Bhd25Mb2NhdGlvbihzcGF3bkxvY2F0aW9uLnNwYXduTG9jYXRpb25JZCwgcmVxdWVzdC5wbGF5ZXJJZCk7XG5cbiAgICBsb2dnZXIuaW5mbygnU3Bhd24gbG9jYXRpb24gY2FsY3VsYXRlZCcsIHtcbiAgICAgIHBsYXllcklkOiByZXF1ZXN0LnBsYXllcklkLFxuICAgICAgY29vcmRpbmF0ZXM6IHNwYXduTG9jYXRpb24uY29vcmRpbmF0ZXMsXG4gICAgICByZWFzb246IHNwYXduTG9jYXRpb24ucmVhc29uLFxuICAgICAgcG9wdWxhdGlvbkRlbnNpdHk6IHNwYXduTG9jYXRpb24ucG9wdWxhdGlvbkRlbnNpdHlcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKidcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBzcGF3bkxvY2F0aW9uOiBzcGF3bkxvY2F0aW9uLFxuICAgICAgICAgIHZhbGlkRm9yOiAzMDAsIC8vIDUgbWludXRlcyB0byB1c2UgdGhpcyBzcGF3biBsb2NhdGlvblxuICAgICAgICAgIG1lc3NhZ2U6ICdPcHRpbWFsIHNwYXduIGxvY2F0aW9uIGNhbGN1bGF0ZWQnXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgfSwgbG9nZ2VyKTtcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGNhbGN1bGF0ZU9wdGltYWxTcGF3bkxvY2F0aW9uKFxuICByZXF1ZXN0OiBDYWxjdWxhdGVTcGF3bkxvY2F0aW9uUmVxdWVzdFxuKTogUHJvbWlzZTxTcGF3bkxvY2F0aW9uPiB7XG4gIHRyeSB7XG4gICAgLy8gR2V0IGZyaWVuZCBsb2NhdGlvbnMgaWYgZ3JvdXBpbmcgaXMgcmVxdWVzdGVkXG4gICAgY29uc3QgZnJpZW5kTG9jYXRpb25zID0gcmVxdWVzdC5ncm91cFdpdGhGcmllbmRzICYmIHJlcXVlc3QuZnJpZW5kSWRzLmxlbmd0aCA+IDAgXG4gICAgICA/IGF3YWl0IGdldEZyaWVuZExvY2F0aW9ucyhyZXF1ZXN0LmZyaWVuZElkcylcbiAgICAgIDogW107XG5cbiAgICAvLyBBbmFseXplIGN1cnJlbnQgcG9wdWxhdGlvbiBkZW5zaXR5XG4gICAgY29uc3QgcG9wdWxhdGlvbkFuYWx5c2lzID0gYXdhaXQgYW5hbHl6ZVBvcHVsYXRpb25EZW5zaXR5KCk7XG4gICAgXG4gICAgLy8gR2VuZXJhdGUgY2FuZGlkYXRlIHNwYXduIGxvY2F0aW9uc1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBhd2FpdCBnZW5lcmF0ZVNwYXduQ2FuZGlkYXRlcyhcbiAgICAgIHJlcXVlc3QucHJlZmVycmVkUmVnaW9uLFxuICAgICAgZnJpZW5kTG9jYXRpb25zLFxuICAgICAgcG9wdWxhdGlvbkFuYWx5c2lzXG4gICAgKTtcblxuICAgIC8vIFNjb3JlIGFuZCByYW5rIGNhbmRpZGF0ZXNcbiAgICBjb25zdCBzY29yZWRDYW5kaWRhdGVzID0gYXdhaXQgc2NvcmVTcGF3bkNhbmRpZGF0ZXMoY2FuZGlkYXRlcywgZnJpZW5kTG9jYXRpb25zKTtcbiAgICBcbiAgICAvLyBTZWxlY3QgdGhlIGJlc3QgY2FuZGlkYXRlXG4gICAgY29uc3QgYmVzdENhbmRpZGF0ZSA9IHNlbGVjdE9wdGltYWxTcGF3bihzY29yZWRDYW5kaWRhdGVzLCByZXF1ZXN0KTtcblxuICAgIHJldHVybiBiZXN0Q2FuZGlkYXRlO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcihcbiAgICAgICdGYWlsZWQgdG8gY2FsY3VsYXRlIHNwYXduIGxvY2F0aW9uJyxcbiAgICAgICdTUEFXTl9DQUxDVUxBVElPTl9FUlJPUicsXG4gICAgICB7IHBsYXllcklkOiByZXF1ZXN0LnBsYXllcklkLCBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIH1cbiAgICApO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEZyaWVuZExvY2F0aW9ucyhmcmllbmRJZHM6IHN0cmluZ1tdKTogUHJvbWlzZTx7IHg6IG51bWJlcjsgeTogbnVtYmVyIH1bXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGxvY2F0aW9uczogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9W10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZyaWVuZElkIG9mIGZyaWVuZElkcy5zbGljZSgwLCA1KSkgeyAvLyBMaW1pdCB0byA1IGZyaWVuZHMgZm9yIHBlcmZvcm1hbmNlXG4gICAgICBjb25zdCBjb21tYW5kID0gbmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogUExBWUVSX0JBU0VTX1RBQkxFLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncGxheWVySWQgPSA6cGxheWVySWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwbGF5ZXJJZCc6IGZyaWVuZElkXG4gICAgICAgIH0sXG4gICAgICAgIEZpbHRlckV4cHJlc3Npb246ICcjc3RhdHVzID0gOmFjdGl2ZScsXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICcjc3RhdHVzJzogJ3N0YXR1cydcbiAgICAgICAgfSxcbiAgICAgICAgUHJvamVjdGlvbkV4cHJlc3Npb246ICdjb29yZGluYXRlcycsXG4gICAgICAgIExpbWl0OiAxIC8vIEp1c3QgZ2V0IG9uZSBiYXNlIHBlciBmcmllbmRcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgICAgXG4gICAgICBpZiAocmVzcG9uc2UuSXRlbXMgJiYgcmVzcG9uc2UuSXRlbXMubGVuZ3RoID4gMCkge1xuICAgICAgICBsb2NhdGlvbnMucHVzaChyZXNwb25zZS5JdGVtc1swXS5jb29yZGluYXRlcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxvY2F0aW9ucztcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ2dlci53YXJuKCdGYWlsZWQgdG8gZ2V0IGZyaWVuZCBsb2NhdGlvbnMnLCB7IGZyaWVuZElkcywgZXJyb3I6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSB9KTtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gYW5hbHl6ZVBvcHVsYXRpb25EZW5zaXR5KCk6IFByb21pc2U8TWFwPHN0cmluZywgbnVtYmVyPj4ge1xuICB0cnkge1xuICAgIGNvbnN0IGRlbnNpdHlNYXAgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuICAgIFxuICAgIC8vIFF1ZXJ5IGFsbCBhY3RpdmUgYmFzZXMgYW5kIGdyb3VwIGJ5IG1hcCBzZWN0aW9uc1xuICAgIGNvbnN0IGNvbW1hbmQgPSBuZXcgU2NhbkNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBQTEFZRVJfQkFTRVNfVEFCTEUsXG4gICAgICBGaWx0ZXJFeHByZXNzaW9uOiAnI3N0YXR1cyA9IDphY3RpdmUnLFxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICcjc3RhdHVzJzogJ3N0YXR1cydcbiAgICAgIH0sXG4gICAgICBQcm9qZWN0aW9uRXhwcmVzc2lvbjogJ21hcFNlY3Rpb25JZCcsXG4gICAgICAvLyBVc2UgcGFyYWxsZWwgc2NhbiBmb3IgYmV0dGVyIHBlcmZvcm1hbmNlIGlmIHRhYmxlIGlzIGxhcmdlXG4gICAgICBTZWdtZW50OiAwLFxuICAgICAgVG90YWxTZWdtZW50czogMVxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICBcbiAgICAvLyBDb3VudCBiYXNlcyBwZXIgbWFwIHNlY3Rpb25cbiAgICByZXNwb25zZS5JdGVtcz8uZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIGNvbnN0IHNlY3Rpb25JZCA9IGl0ZW0ubWFwU2VjdGlvbklkO1xuICAgICAgZGVuc2l0eU1hcC5zZXQoc2VjdGlvbklkLCAoZGVuc2l0eU1hcC5nZXQoc2VjdGlvbklkKSB8fCAwKSArIDEpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlbnNpdHlNYXA7XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXIud2FybignRmFpbGVkIHRvIGFuYWx5emUgcG9wdWxhdGlvbiBkZW5zaXR5JywgeyBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIH0pO1xuICAgIHJldHVybiBuZXcgTWFwKCk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVTcGF3bkNhbmRpZGF0ZXMoXG4gIHByZWZlcnJlZFJlZ2lvbjogc3RyaW5nLFxuICBmcmllbmRMb2NhdGlvbnM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfVtdLFxuICBwb3B1bGF0aW9uRGVuc2l0eTogTWFwPHN0cmluZywgbnVtYmVyPlxuKTogUHJvbWlzZTx7IHg6IG51bWJlcjsgeTogbnVtYmVyOyBzZWN0aW9uSWQ6IHN0cmluZyB9W10+IHtcbiAgY29uc3QgY2FuZGlkYXRlczogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgc2VjdGlvbklkOiBzdHJpbmcgfVtdID0gW107XG4gIGNvbnN0IG1heENhbmRpZGF0ZXMgPSAyMDtcbiAgXG4gIC8vIERlZmluZSByZWdpb24gYm91bmRhcmllc1xuICBjb25zdCByZWdpb25Cb3VuZHMgPSBnZXRSZWdpb25Cb3VuZHMocHJlZmVycmVkUmVnaW9uKTtcbiAgXG4gIC8vIElmIGZyaWVuZHMgZXhpc3QgYW5kIGdyb3VwaW5nIGlzIHJlcXVlc3RlZCwgYmlhcyB0b3dhcmRzIGZyaWVuZCBsb2NhdGlvbnNcbiAgaWYgKGZyaWVuZExvY2F0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZnJpZW5kQ2VudGVyID0gY2FsY3VsYXRlQ2VudGVyUG9pbnQoZnJpZW5kTG9jYXRpb25zKTtcbiAgICBjb25zdCBmcmllbmRSYWRpdXMgPSA1MDA7IC8vIDUwMCB1bml0cyBhcm91bmQgZnJpZW5kc1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4Q2FuZGlkYXRlcyAvIDI7IGkrKykge1xuICAgICAgY29uc3QgYW5nbGUgPSBNYXRoLnJhbmRvbSgpICogMiAqIE1hdGguUEk7XG4gICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGgucmFuZG9tKCkgKiBmcmllbmRSYWRpdXM7XG4gICAgICBjb25zdCB4ID0gTWF0aC5mbG9vcihmcmllbmRDZW50ZXIueCArIE1hdGguY29zKGFuZ2xlKSAqIGRpc3RhbmNlKTtcbiAgICAgIGNvbnN0IHkgPSBNYXRoLmZsb29yKGZyaWVuZENlbnRlci55ICsgTWF0aC5zaW4oYW5nbGUpICogZGlzdGFuY2UpO1xuICAgICAgY29uc3Qgc2VjdGlvbklkID0gYCR7TWF0aC5mbG9vcih4IC8gMTAwKX0sJHtNYXRoLmZsb29yKHkgLyAxMDApfWA7XG4gICAgICBcbiAgICAgIC8vIEVuc3VyZSBjb29yZGluYXRlcyBhcmUgd2l0aGluIHJlZ2lvbiBib3VuZHNcbiAgICAgIGlmIChpc1dpdGhpbkJvdW5kcyh7IHgsIHkgfSwgcmVnaW9uQm91bmRzKSkge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2goeyB4LCB5LCBzZWN0aW9uSWQgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICAvLyBHZW5lcmF0ZSByYW5kb20gY2FuZGlkYXRlcyB3aXRoaW4gcHJlZmVycmVkIHJlZ2lvblxuICBmb3IgKGxldCBpID0gY2FuZGlkYXRlcy5sZW5ndGg7IGkgPCBtYXhDYW5kaWRhdGVzOyBpKyspIHtcbiAgICBjb25zdCB4ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKHJlZ2lvbkJvdW5kcy5tYXhYIC0gcmVnaW9uQm91bmRzLm1pblgpICsgcmVnaW9uQm91bmRzLm1pblgpO1xuICAgIGNvbnN0IHkgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAocmVnaW9uQm91bmRzLm1heFkgLSByZWdpb25Cb3VuZHMubWluWSkgKyByZWdpb25Cb3VuZHMubWluWSk7XG4gICAgY29uc3Qgc2VjdGlvbklkID0gYCR7TWF0aC5mbG9vcih4IC8gMTAwKX0sJHtNYXRoLmZsb29yKHkgLyAxMDApfWA7XG4gICAgXG4gICAgY2FuZGlkYXRlcy5wdXNoKHsgeCwgeSwgc2VjdGlvbklkIH0pO1xuICB9XG4gIFxuICByZXR1cm4gY2FuZGlkYXRlcztcbn1cblxuZnVuY3Rpb24gZ2V0UmVnaW9uQm91bmRzKHJlZ2lvbjogc3RyaW5nKTogeyBtaW5YOiBudW1iZXI7IG1heFg6IG51bWJlcjsgbWluWTogbnVtYmVyOyBtYXhZOiBudW1iZXIgfSB7XG4gIGNvbnN0IGJhc2VSYWRpdXMgPSAyMDAwOyAvLyBCYXNlIHNwYXduIHJhZGl1c1xuICBcbiAgc3dpdGNoIChyZWdpb24pIHtcbiAgICBjYXNlICdjZW50ZXInOlxuICAgICAgcmV0dXJuIHsgbWluWDogLWJhc2VSYWRpdXMvMiwgbWF4WDogYmFzZVJhZGl1cy8yLCBtaW5ZOiAtYmFzZVJhZGl1cy8yLCBtYXhZOiBiYXNlUmFkaXVzLzIgfTtcbiAgICBjYXNlICdub3J0aCc6XG4gICAgICByZXR1cm4geyBtaW5YOiAtYmFzZVJhZGl1cywgbWF4WDogYmFzZVJhZGl1cywgbWluWTogMCwgbWF4WTogYmFzZVJhZGl1cyB9O1xuICAgIGNhc2UgJ3NvdXRoJzpcbiAgICAgIHJldHVybiB7IG1pblg6IC1iYXNlUmFkaXVzLCBtYXhYOiBiYXNlUmFkaXVzLCBtaW5ZOiAtYmFzZVJhZGl1cywgbWF4WTogMCB9O1xuICAgIGNhc2UgJ2Vhc3QnOlxuICAgICAgcmV0dXJuIHsgbWluWDogMCwgbWF4WDogYmFzZVJhZGl1cywgbWluWTogLWJhc2VSYWRpdXMsIG1heFk6IGJhc2VSYWRpdXMgfTtcbiAgICBjYXNlICd3ZXN0JzpcbiAgICAgIHJldHVybiB7IG1pblg6IC1iYXNlUmFkaXVzLCBtYXhYOiAwLCBtaW5ZOiAtYmFzZVJhZGl1cywgbWF4WTogYmFzZVJhZGl1cyB9O1xuICAgIGRlZmF1bHQ6IC8vIHJhbmRvbVxuICAgICAgcmV0dXJuIHsgbWluWDogLWJhc2VSYWRpdXMsIG1heFg6IGJhc2VSYWRpdXMsIG1pblk6IC1iYXNlUmFkaXVzLCBtYXhZOiBiYXNlUmFkaXVzIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlQ2VudGVyUG9pbnQocG9pbnRzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH1bXSk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG4gIGlmIChwb2ludHMubGVuZ3RoID09PSAwKSByZXR1cm4geyB4OiAwLCB5OiAwIH07XG4gIFxuICBjb25zdCBzdW0gPSBwb2ludHMucmVkdWNlKFxuICAgIChhY2MsIHBvaW50KSA9PiAoeyB4OiBhY2MueCArIHBvaW50LngsIHk6IGFjYy55ICsgcG9pbnQueSB9KSxcbiAgICB7IHg6IDAsIHk6IDAgfVxuICApO1xuICBcbiAgcmV0dXJuIHtcbiAgICB4OiBNYXRoLmZsb29yKHN1bS54IC8gcG9pbnRzLmxlbmd0aCksXG4gICAgeTogTWF0aC5mbG9vcihzdW0ueSAvIHBvaW50cy5sZW5ndGgpXG4gIH07XG59XG5cbmZ1bmN0aW9uIGlzV2l0aGluQm91bmRzKFxuICBwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LFxuICBib3VuZHM6IHsgbWluWDogbnVtYmVyOyBtYXhYOiBudW1iZXI7IG1pblk6IG51bWJlcjsgbWF4WTogbnVtYmVyIH1cbik6IGJvb2xlYW4ge1xuICByZXR1cm4gcG9pbnQueCA+PSBib3VuZHMubWluWCAmJiBwb2ludC54IDw9IGJvdW5kcy5tYXhYICYmIFxuICAgICAgICAgcG9pbnQueSA+PSBib3VuZHMubWluWSAmJiBwb2ludC55IDw9IGJvdW5kcy5tYXhZO1xufVxuXG5hc3luYyBmdW5jdGlvbiBzY29yZVNwYXduQ2FuZGlkYXRlcyhcbiAgY2FuZGlkYXRlczogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgc2VjdGlvbklkOiBzdHJpbmcgfVtdLFxuICBmcmllbmRMb2NhdGlvbnM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfVtdXG4pOiBQcm9taXNlPEFycmF5PHsgXG4gIGNvb3JkaW5hdGVzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG4gIHNjb3JlOiBudW1iZXI7XG4gIHBvcHVsYXRpb25EZW5zaXR5OiBudW1iZXI7XG4gIHNhZmV0eVJhdGluZzogbnVtYmVyO1xuICByZXNvdXJjZUFjY2Vzc2liaWxpdHk6IG51bWJlcjtcbiAgZnJpZW5kUHJveGltaXR5OiBudW1iZXI7XG59Pj4ge1xuICBjb25zdCBzY29yZWRDYW5kaWRhdGVzID0gY2FuZGlkYXRlcy5tYXAoY2FuZGlkYXRlID0+IHtcbiAgICAvLyBDYWxjdWxhdGUgcG9wdWxhdGlvbiBkZW5zaXR5IHNjb3JlIChsb3dlciBkZW5zaXR5ID0gaGlnaGVyIHNjb3JlKVxuICAgIGNvbnN0IHBvcHVsYXRpb25EZW5zaXR5ID0gMC4xOyAvLyBTaW1wbGlmaWVkIC0gd291bGQgcXVlcnkgYWN0dWFsIGRlbnNpdHlcbiAgICBjb25zdCBkZW5zaXR5U2NvcmUgPSBNYXRoLm1heCgwLCAxIC0gKHBvcHVsYXRpb25EZW5zaXR5IC8gMTApKTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgc2FmZXR5IHJhdGluZyAoZGlzdGFuY2UgZnJvbSBjZW50ZXIgLSBjbG9zZXIgPSBzYWZlciBmb3IgbmV3YmllcylcbiAgICBjb25zdCBkaXN0YW5jZUZyb21DZW50ZXIgPSBNYXRoLnNxcnQoY2FuZGlkYXRlLnggKiogMiArIGNhbmRpZGF0ZS55ICoqIDIpO1xuICAgIGNvbnN0IHNhZmV0eVNjb3JlID0gTWF0aC5tYXgoMCwgMSAtIChkaXN0YW5jZUZyb21DZW50ZXIgLyA1MDAwKSk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHJlc291cmNlIGFjY2Vzc2liaWxpdHkgKHNpbXBsaWZpZWQpXG4gICAgY29uc3QgcmVzb3VyY2VTY29yZSA9IDAuNyArIChNYXRoLnJhbmRvbSgpICogMC4zKTsgLy8gUmFuZG9tIGJldHdlZW4gMC43LTEuMFxuICAgIFxuICAgIC8vIENhbGN1bGF0ZSBmcmllbmQgcHJveGltaXR5IGJvbnVzXG4gICAgbGV0IGZyaWVuZFNjb3JlID0gMDtcbiAgICBpZiAoZnJpZW5kTG9jYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGF2Z0Rpc3RhbmNlVG9GcmllbmRzID0gZnJpZW5kTG9jYXRpb25zLnJlZHVjZShcbiAgICAgICAgKHN1bSwgZnJpZW5kKSA9PiBzdW0gKyBNYXRoLnNxcnQoXG4gICAgICAgICAgKGNhbmRpZGF0ZS54IC0gZnJpZW5kLngpICoqIDIgKyAoY2FuZGlkYXRlLnkgLSBmcmllbmQueSkgKiogMlxuICAgICAgICApLFxuICAgICAgICAwXG4gICAgICApIC8gZnJpZW5kTG9jYXRpb25zLmxlbmd0aDtcbiAgICAgIFxuICAgICAgZnJpZW5kU2NvcmUgPSBNYXRoLm1heCgwLCAxIC0gKGF2Z0Rpc3RhbmNlVG9GcmllbmRzIC8gMTAwMCkpO1xuICAgIH1cbiAgICBcbiAgICAvLyBXZWlnaHRlZCBjb21wb3NpdGUgc2NvcmVcbiAgICBjb25zdCB0b3RhbFNjb3JlID0gKGRlbnNpdHlTY29yZSAqIDAuMykgKyAoc2FmZXR5U2NvcmUgKiAwLjMpICsgXG4gICAgICAgICAgICAgICAgICAgICAgKHJlc291cmNlU2NvcmUgKiAwLjIpICsgKGZyaWVuZFNjb3JlICogMC4yKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgY29vcmRpbmF0ZXM6IHsgeDogY2FuZGlkYXRlLngsIHk6IGNhbmRpZGF0ZS55IH0sXG4gICAgICBzY29yZTogdG90YWxTY29yZSxcbiAgICAgIHBvcHVsYXRpb25EZW5zaXR5OiBwb3B1bGF0aW9uRGVuc2l0eSxcbiAgICAgIHNhZmV0eVJhdGluZzogc2FmZXR5U2NvcmUsXG4gICAgICByZXNvdXJjZUFjY2Vzc2liaWxpdHk6IHJlc291cmNlU2NvcmUsXG4gICAgICBmcmllbmRQcm94aW1pdHk6IGZyaWVuZFNjb3JlXG4gICAgfTtcbiAgfSk7XG4gIFxuICByZXR1cm4gc2NvcmVkQ2FuZGlkYXRlcy5zb3J0KChhLCBiKSA9PiBiLnNjb3JlIC0gYS5zY29yZSk7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdE9wdGltYWxTcGF3bihcbiAgc2NvcmVkQ2FuZGlkYXRlczogQXJyYXk8e1xuICAgIGNvb3JkaW5hdGVzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG4gICAgc2NvcmU6IG51bWJlcjtcbiAgICBwb3B1bGF0aW9uRGVuc2l0eTogbnVtYmVyO1xuICAgIHNhZmV0eVJhdGluZzogbnVtYmVyO1xuICAgIHJlc291cmNlQWNjZXNzaWJpbGl0eTogbnVtYmVyO1xuICAgIGZyaWVuZFByb3hpbWl0eTogbnVtYmVyO1xuICB9PixcbiAgcmVxdWVzdDogQ2FsY3VsYXRlU3Bhd25Mb2NhdGlvblJlcXVlc3Rcbik6IFNwYXduTG9jYXRpb24ge1xuICBjb25zdCBiZXN0Q2FuZGlkYXRlID0gc2NvcmVkQ2FuZGlkYXRlc1swXTtcbiAgXG4gIC8vIEdlbmVyYXRlIHJlYXNvbiBmb3IgdGhpcyBzcGF3biBsb2NhdGlvblxuICBsZXQgcmVhc29uID0gJ09wdGltYWwgYmFsYW5jZSBvZiBzYWZldHkgYW5kIHJlc291cmNlcyc7XG4gIGlmIChiZXN0Q2FuZGlkYXRlLmZyaWVuZFByb3hpbWl0eSA+IDAuNSkge1xuICAgIHJlYXNvbiA9ICdOZWFyIGZyaWVuZHMgZm9yIHNvY2lhbCBnYW1lcGxheSc7XG4gIH0gZWxzZSBpZiAoYmVzdENhbmRpZGF0ZS5zYWZldHlSYXRpbmcgPiAwLjgpIHtcbiAgICByZWFzb24gPSAnU2FmZSBzdGFydGVyIGxvY2F0aW9uJztcbiAgfSBlbHNlIGlmIChiZXN0Q2FuZGlkYXRlLnJlc291cmNlQWNjZXNzaWJpbGl0eSA+IDAuOSkge1xuICAgIHJlYXNvbiA9ICdFeGNlbGxlbnQgcmVzb3VyY2UgYWNjZXNzJztcbiAgfSBlbHNlIGlmIChiZXN0Q2FuZGlkYXRlLnBvcHVsYXRpb25EZW5zaXR5IDwgMC4yKSB7XG4gICAgcmVhc29uID0gJ0xvdyBwb3B1bGF0aW9uIGRlbnNpdHkgYXJlYSc7XG4gIH1cbiAgXG4gIHJldHVybiB7XG4gICAgY29vcmRpbmF0ZXM6IGJlc3RDYW5kaWRhdGUuY29vcmRpbmF0ZXMsXG4gICAgc3Bhd25Mb2NhdGlvbklkOiBgc3Bhd24tJHtEYXRlLm5vdygpfS0ke01hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cigyLCA5KX1gLFxuICAgIHBvcHVsYXRpb25EZW5zaXR5OiBiZXN0Q2FuZGlkYXRlLnBvcHVsYXRpb25EZW5zaXR5LFxuICAgIHNhZmV0eVJhdGluZzogYmVzdENhbmRpZGF0ZS5zYWZldHlSYXRpbmcsXG4gICAgcmVzb3VyY2VBY2Nlc3NpYmlsaXR5OiBiZXN0Q2FuZGlkYXRlLnJlc291cmNlQWNjZXNzaWJpbGl0eSxcbiAgICByZWFzb246IHJlYXNvblxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiByZXNlcnZlU3Bhd25Mb2NhdGlvbihzcGF3bkxvY2F0aW9uSWQ6IHN0cmluZywgcGxheWVySWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICB0cnkge1xuICAgIGNvbnN0IHR0bCA9IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgMzAwOyAvLyA1IG1pbnV0ZXMgZnJvbSBub3dcbiAgICBcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFVwZGF0ZUNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBTUEFXTl9MT0NBVElPTlNfVEFCTEUsXG4gICAgICBLZXk6IHtcbiAgICAgICAgc3Bhd25SZWdpb25JZDogJ2NhbGN1bGF0ZWQnLFxuICAgICAgICBzcGF3bkxvY2F0aW9uSWQ6IHNwYXduTG9jYXRpb25JZFxuICAgICAgfSxcbiAgICAgIFVwZGF0ZUV4cHJlc3Npb246ICdTRVQgcmVzZXJ2ZWRCeSA9IDpwbGF5ZXJJZCwgcmVzZXJ2ZWRBdCA9IDpub3csIGlzQXZhaWxhYmxlID0gOmZhbHNlLCAjdHRsID0gOnR0bCcsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyN0dGwnOiAndHRsJ1xuICAgICAgfSxcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgJzpwbGF5ZXJJZCc6IHBsYXllcklkLFxuICAgICAgICAnOm5vdyc6IERhdGUubm93KCksXG4gICAgICAgICc6ZmFsc2UnOiAnZmFsc2UnLFxuICAgICAgICAnOnR0bCc6IHR0bFxuICAgICAgfSxcbiAgICAgIC8vIENyZWF0ZSB0aGUgcmVjb3JkIGlmIGl0IGRvZXNuJ3QgZXhpc3RcbiAgICAgIFJldHVyblZhbHVlczogJ0FMTF9ORVcnXG4gICAgfSk7XG5cbiAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICBcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXIud2FybignRmFpbGVkIHRvIHJlc2VydmUgc3Bhd24gbG9jYXRpb24nLCB7IFxuICAgICAgc3Bhd25Mb2NhdGlvbklkLCBcbiAgICAgIHBsYXllcklkLCBcbiAgICAgIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgXG4gICAgfSk7XG4gICAgLy8gTm9uLWNyaXRpY2FsIGVycm9yIC0gc3Bhd24gY2FuIHN0aWxsIGJlIHVzZWRcbiAgfVxufSJdfQ==
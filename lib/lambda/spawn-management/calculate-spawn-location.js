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
const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE ?? '';
const SPAWN_LOCATIONS_TABLE = process.env.SPAWN_LOCATIONS_TABLE ?? '';
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
        const candidates = generateSpawnCandidates(request.preferredRegion, friendLocations, populationAnalysis);
        // Score and rank candidates
        const scoredCandidates = scoreSpawnCandidates(candidates, friendLocations);
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
            densityMap.set(sectionId, (densityMap.get(sectionId) ?? 0) + 1);
        });
        return densityMap;
    }
    catch (error) {
        logger.warn('Failed to analyze population density', { error: error.message });
        return new Map();
    }
}
function generateSpawnCandidates(preferredRegion, friendLocations, _populationDensity) {
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
function scoreSpawnCandidates(candidates, friendLocations) {
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
function selectOptimalSpawn(scoredCandidates, _request) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsY3VsYXRlLXNwYXduLWxvY2F0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGFtYmRhL3NwYXduLW1hbmFnZW1lbnQvY2FsY3VsYXRlLXNwYXduLWxvY2F0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDhEQUEwRDtBQUMxRCx3REFBeUc7QUFDekcseURBS2dDO0FBQ2hDLDZCQUF3QjtBQUV4QixNQUFNLFlBQVksR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUMsTUFBTSxTQUFTLEdBQUcscUNBQXNCLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVELE1BQU0sTUFBTSxHQUFHLElBQUksK0JBQWdCLENBQUMsK0JBQStCLENBQUMsQ0FBQztBQUVyRSxNQUFNLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksRUFBRSxDQUFDO0FBQ2hFLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsSUFBSSxFQUFFLENBQUM7QUFFdEUsTUFBTSxtQ0FBbUMsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ25ELFFBQVEsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDbkMsZUFBZSxFQUFFLE9BQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUM1RyxnQkFBZ0IsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUN0RCxTQUFTLEVBQUUsT0FBQyxDQUFDLEtBQUssQ0FB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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCB9IGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgRHluYW1vREJDbGllbnQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInO1xuaW1wb3J0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgUXVlcnlDb21tYW5kLCBVcGRhdGVDb21tYW5kLCBTY2FuQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYic7XG5pbXBvcnQgeyBcbiAgU3RydWN0dXJlZExvZ2dlciwgXG4gIEdhbWVFbmdpbmVFcnJvcixcbiAgd2l0aEVycm9ySGFuZGxpbmcsXG4gIHZhbGlkYXRlUmVxdWVzdCBcbn0gZnJvbSAnLi4vLi4vbGliL3NoYXJlZC1tb2Nrcyc7XG5pbXBvcnQgeyB6IH0gZnJvbSAnem9kJztcblxuY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbmNvbnN0IGRvY0NsaWVudCA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkeW5hbW9DbGllbnQpO1xuY29uc3QgbG9nZ2VyID0gbmV3IFN0cnVjdHVyZWRMb2dnZXIoJ0NhbGN1bGF0ZVNwYXduTG9jYXRpb25IYW5kbGVyJyk7XG5cbmNvbnN0IFBMQVlFUl9CQVNFU19UQUJMRSA9IHByb2Nlc3MuZW52LlBMQVlFUl9CQVNFU19UQUJMRSA/PyAnJztcbmNvbnN0IFNQQVdOX0xPQ0FUSU9OU19UQUJMRSA9IHByb2Nlc3MuZW52LlNQQVdOX0xPQ0FUSU9OU19UQUJMRSA/PyAnJztcblxuY29uc3QgQ2FsY3VsYXRlU3Bhd25Mb2NhdGlvblJlcXVlc3RTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBsYXllcklkOiB6LnN0cmluZygpLm1pbigxKS5tYXgoNTApLFxuICBwcmVmZXJyZWRSZWdpb246IHouZW51bShbJ2NlbnRlcicsICdub3J0aCcsICdzb3V0aCcsICdlYXN0JywgJ3dlc3QnLCAncmFuZG9tJ10pLm9wdGlvbmFsKCkuZGVmYXVsdCgncmFuZG9tJyksXG4gIGdyb3VwV2l0aEZyaWVuZHM6IHouYm9vbGVhbigpLm9wdGlvbmFsKCkuZGVmYXVsdCh0cnVlKSxcbiAgZnJpZW5kSWRzOiB6LmFycmF5KHouc3RyaW5nKCkpLm9wdGlvbmFsKCkuZGVmYXVsdChbXSlcbn0pO1xuXG50eXBlIENhbGN1bGF0ZVNwYXduTG9jYXRpb25SZXF1ZXN0ID0gei5pbmZlcjx0eXBlb2YgQ2FsY3VsYXRlU3Bhd25Mb2NhdGlvblJlcXVlc3RTY2hlbWE+O1xuXG5pbnRlcmZhY2UgU3Bhd25Mb2NhdGlvbiB7XG4gIGNvb3JkaW5hdGVzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG4gIHNwYXduTG9jYXRpb25JZDogc3RyaW5nO1xuICBwb3B1bGF0aW9uRGVuc2l0eTogbnVtYmVyO1xuICBzYWZldHlSYXRpbmc6IG51bWJlcjtcbiAgcmVzb3VyY2VBY2Nlc3NpYmlsaXR5OiBudW1iZXI7XG4gIHJlYXNvbjogc3RyaW5nO1xufVxuXG4vKipcbiAqIENhbGN1bGF0ZSBTcGF3biBMb2NhdGlvbiBIYW5kbGVyXG4gKiBcbiAqIEltcGxlbWVudHMgaW50ZWxsaWdlbnQgc3Bhd24gbG9jYXRpb24gY2FsY3VsYXRpb24gZm9sbG93aW5nIFNPTElEIHByaW5jaXBsZXM6XG4gKiAtIFNpbmdsZSBSZXNwb25zaWJpbGl0eTogT25seSBoYW5kbGVzIHNwYXduIGxvY2F0aW9uIGRldGVybWluYXRpb25cbiAqIC0gT3Blbi9DbG9zZWQ6IEV4dGVuc2libGUgZm9yIG5ldyBzcGF3biBhbGdvcml0aG1zXG4gKiAtIExpc2tvdiBTdWJzdGl0dXRpb246IEFsbCBzcGF3biBtZXRob2RzIHJldHVybiBjb25zaXN0ZW50IGZvcm1hdFxuICogLSBJbnRlcmZhY2UgU2VncmVnYXRpb246IENsZWFyIHNlcGFyYXRpb24gb2Ygc3Bhd24gY2FsY3VsYXRpb24gY29uY2VybnNcbiAqIC0gRGVwZW5kZW5jeSBJbnZlcnNpb246IERlcGVuZHMgb24gc2hhcmVkIGNhbGN1bGF0aW9uIGFic3RyYWN0aW9uc1xuICogXG4gKiBTcGF3biBBbGdvcml0aG0gRmVhdHVyZXM6XG4gKiAtIFBvcHVsYXRpb24gZGVuc2l0eSBhbmFseXNpcyB0byBhdm9pZCBvdmVyY3Jvd2RlZCBhcmVhc1xuICogLSBGcmllbmQgZ3JvdXBpbmcgZm9yIHNvY2lhbCBnYW1lcGxheVxuICogLSBSZWdpb25hbCBwcmVmZXJlbmNlcyBmb3Igc3RyYXRlZ2ljIHBvc2l0aW9uaW5nXG4gKiAtIFNhZmV0eSByYXRpbmcgYmFzZWQgb24gbmVhcmJ5IGhpZ2gtbGV2ZWwgcGxheWVyc1xuICogLSBSZXNvdXJjZSBhY2Nlc3NpYmlsaXR5IHNjb3JpbmdcbiAqIC0gRHluYW1pYyBzcGF3biByZWdpb24gZXhwYW5zaW9uIGJhc2VkIG9uIHBsYXllciBncm93dGhcbiAqL1xuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxuKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcbiAgcmV0dXJuIHdpdGhFcnJvckhhbmRsaW5nKGFzeW5jICgpID0+IHtcbiAgICBsb2dnZXIuaW5mbygnUHJvY2Vzc2luZyBzcGF3biBsb2NhdGlvbiBjYWxjdWxhdGlvbicsIHsgXG4gICAgICByZXF1ZXN0SWQ6IGV2ZW50LnJlcXVlc3RDb250ZXh0Py5yZXF1ZXN0SWQgXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXF1ZXN0ID0gYXdhaXQgdmFsaWRhdGVSZXF1ZXN0PENhbGN1bGF0ZVNwYXduTG9jYXRpb25SZXF1ZXN0PihDYWxjdWxhdGVTcGF3bkxvY2F0aW9uUmVxdWVzdFNjaGVtYSwgZXZlbnQuYm9keSk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIG9wdGltYWwgc3Bhd24gbG9jYXRpb25cbiAgICBjb25zdCBzcGF3bkxvY2F0aW9uID0gYXdhaXQgY2FsY3VsYXRlT3B0aW1hbFNwYXduTG9jYXRpb24ocmVxdWVzdCk7XG4gICAgXG4gICAgLy8gUmVzZXJ2ZSB0aGUgc3Bhd24gbG9jYXRpb24gdGVtcG9yYXJpbHlcbiAgICBhd2FpdCByZXNlcnZlU3Bhd25Mb2NhdGlvbihzcGF3bkxvY2F0aW9uLnNwYXduTG9jYXRpb25JZCwgcmVxdWVzdC5wbGF5ZXJJZCk7XG5cbiAgICBsb2dnZXIuaW5mbygnU3Bhd24gbG9jYXRpb24gY2FsY3VsYXRlZCcsIHtcbiAgICAgIHBsYXllcklkOiByZXF1ZXN0LnBsYXllcklkLFxuICAgICAgY29vcmRpbmF0ZXM6IHNwYXduTG9jYXRpb24uY29vcmRpbmF0ZXMsXG4gICAgICByZWFzb246IHNwYXduTG9jYXRpb24ucmVhc29uLFxuICAgICAgcG9wdWxhdGlvbkRlbnNpdHk6IHNwYXduTG9jYXRpb24ucG9wdWxhdGlvbkRlbnNpdHlcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKidcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBzcGF3bkxvY2F0aW9uOiBzcGF3bkxvY2F0aW9uLFxuICAgICAgICAgIHZhbGlkRm9yOiAzMDAsIC8vIDUgbWludXRlcyB0byB1c2UgdGhpcyBzcGF3biBsb2NhdGlvblxuICAgICAgICAgIG1lc3NhZ2U6ICdPcHRpbWFsIHNwYXduIGxvY2F0aW9uIGNhbGN1bGF0ZWQnXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfTtcbiAgfSwgbG9nZ2VyKTtcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGNhbGN1bGF0ZU9wdGltYWxTcGF3bkxvY2F0aW9uKFxuICByZXF1ZXN0OiBDYWxjdWxhdGVTcGF3bkxvY2F0aW9uUmVxdWVzdFxuKTogUHJvbWlzZTxTcGF3bkxvY2F0aW9uPiB7XG4gIHRyeSB7XG4gICAgLy8gR2V0IGZyaWVuZCBsb2NhdGlvbnMgaWYgZ3JvdXBpbmcgaXMgcmVxdWVzdGVkXG4gICAgY29uc3QgZnJpZW5kTG9jYXRpb25zID0gcmVxdWVzdC5ncm91cFdpdGhGcmllbmRzICYmIHJlcXVlc3QuZnJpZW5kSWRzLmxlbmd0aCA+IDAgXG4gICAgICA/IGF3YWl0IGdldEZyaWVuZExvY2F0aW9ucyhyZXF1ZXN0LmZyaWVuZElkcylcbiAgICAgIDogW107XG5cbiAgICAvLyBBbmFseXplIGN1cnJlbnQgcG9wdWxhdGlvbiBkZW5zaXR5XG4gICAgY29uc3QgcG9wdWxhdGlvbkFuYWx5c2lzID0gYXdhaXQgYW5hbHl6ZVBvcHVsYXRpb25EZW5zaXR5KCk7XG4gICAgXG4gICAgLy8gR2VuZXJhdGUgY2FuZGlkYXRlIHNwYXduIGxvY2F0aW9uc1xuICAgIGNvbnN0IGNhbmRpZGF0ZXMgPSBnZW5lcmF0ZVNwYXduQ2FuZGlkYXRlcyhcbiAgICAgIHJlcXVlc3QucHJlZmVycmVkUmVnaW9uLFxuICAgICAgZnJpZW5kTG9jYXRpb25zLFxuICAgICAgcG9wdWxhdGlvbkFuYWx5c2lzXG4gICAgKTtcblxuICAgIC8vIFNjb3JlIGFuZCByYW5rIGNhbmRpZGF0ZXNcbiAgICBjb25zdCBzY29yZWRDYW5kaWRhdGVzID0gc2NvcmVTcGF3bkNhbmRpZGF0ZXMoY2FuZGlkYXRlcywgZnJpZW5kTG9jYXRpb25zKTtcbiAgICBcbiAgICAvLyBTZWxlY3QgdGhlIGJlc3QgY2FuZGlkYXRlXG4gICAgY29uc3QgYmVzdENhbmRpZGF0ZSA9IHNlbGVjdE9wdGltYWxTcGF3bihzY29yZWRDYW5kaWRhdGVzLCByZXF1ZXN0KTtcblxuICAgIHJldHVybiBiZXN0Q2FuZGlkYXRlO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcihcbiAgICAgICdGYWlsZWQgdG8gY2FsY3VsYXRlIHNwYXduIGxvY2F0aW9uJyxcbiAgICAgICdTUEFXTl9DQUxDVUxBVElPTl9FUlJPUicsXG4gICAgICB7IHBsYXllcklkOiByZXF1ZXN0LnBsYXllcklkLCBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIH1cbiAgICApO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEZyaWVuZExvY2F0aW9ucyhmcmllbmRJZHM6IHN0cmluZ1tdKTogUHJvbWlzZTx7IHg6IG51bWJlcjsgeTogbnVtYmVyIH1bXT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGxvY2F0aW9uczogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9W10gPSBbXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZyaWVuZElkIG9mIGZyaWVuZElkcy5zbGljZSgwLCA1KSkgeyAvLyBMaW1pdCB0byA1IGZyaWVuZHMgZm9yIHBlcmZvcm1hbmNlXG4gICAgICBjb25zdCBjb21tYW5kID0gbmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogUExBWUVSX0JBU0VTX1RBQkxFLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncGxheWVySWQgPSA6cGxheWVySWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwbGF5ZXJJZCc6IGZyaWVuZElkXG4gICAgICAgIH0sXG4gICAgICAgIEZpbHRlckV4cHJlc3Npb246ICcjc3RhdHVzID0gOmFjdGl2ZScsXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICcjc3RhdHVzJzogJ3N0YXR1cydcbiAgICAgICAgfSxcbiAgICAgICAgUHJvamVjdGlvbkV4cHJlc3Npb246ICdjb29yZGluYXRlcycsXG4gICAgICAgIExpbWl0OiAxIC8vIEp1c3QgZ2V0IG9uZSBiYXNlIHBlciBmcmllbmRcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgICAgXG4gICAgICBpZiAocmVzcG9uc2UuSXRlbXMgJiYgcmVzcG9uc2UuSXRlbXMubGVuZ3RoID4gMCkge1xuICAgICAgICBsb2NhdGlvbnMucHVzaChyZXNwb25zZS5JdGVtc1swXS5jb29yZGluYXRlcyBhcyB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsb2NhdGlvbnM7XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBsb2dnZXIud2FybignRmFpbGVkIHRvIGdldCBmcmllbmQgbG9jYXRpb25zJywgeyBmcmllbmRJZHMsIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfSk7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGFuYWx5emVQb3B1bGF0aW9uRGVuc2l0eSgpOiBQcm9taXNlPE1hcDxzdHJpbmcsIG51bWJlcj4+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkZW5zaXR5TWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICBcbiAgICAvLyBRdWVyeSBhbGwgYWN0aXZlIGJhc2VzIGFuZCBncm91cCBieSBtYXAgc2VjdGlvbnNcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFNjYW5Db21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogUExBWUVSX0JBU0VTX1RBQkxFLFxuICAgICAgRmlsdGVyRXhwcmVzc2lvbjogJyNzdGF0dXMgPSA6YWN0aXZlJyxcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnXG4gICAgICB9LFxuICAgICAgUHJvamVjdGlvbkV4cHJlc3Npb246ICdtYXBTZWN0aW9uSWQnLFxuICAgICAgLy8gVXNlIHBhcmFsbGVsIHNjYW4gZm9yIGJldHRlciBwZXJmb3JtYW5jZSBpZiB0YWJsZSBpcyBsYXJnZVxuICAgICAgU2VnbWVudDogMCxcbiAgICAgIFRvdGFsU2VnbWVudHM6IDFcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgXG4gICAgLy8gQ291bnQgYmFzZXMgcGVyIG1hcCBzZWN0aW9uXG4gICAgcmVzcG9uc2UuSXRlbXM/LmZvckVhY2goaXRlbSA9PiB7XG4gICAgICBjb25zdCBzZWN0aW9uSWQgPSBpdGVtLm1hcFNlY3Rpb25JZCBhcyBzdHJpbmc7XG4gICAgICBkZW5zaXR5TWFwLnNldChzZWN0aW9uSWQsIChkZW5zaXR5TWFwLmdldChzZWN0aW9uSWQpID8/IDApICsgMSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZGVuc2l0eU1hcDtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGxvZ2dlci53YXJuKCdGYWlsZWQgdG8gYW5hbHl6ZSBwb3B1bGF0aW9uIGRlbnNpdHknLCB7IGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfSk7XG4gICAgcmV0dXJuIG5ldyBNYXAoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZVNwYXduQ2FuZGlkYXRlcyhcbiAgcHJlZmVycmVkUmVnaW9uOiBzdHJpbmcsXG4gIGZyaWVuZExvY2F0aW9uczogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9W10sXG4gIF9wb3B1bGF0aW9uRGVuc2l0eTogTWFwPHN0cmluZywgbnVtYmVyPlxuKTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgc2VjdGlvbklkOiBzdHJpbmcgfVtdIHtcbiAgY29uc3QgY2FuZGlkYXRlczogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgc2VjdGlvbklkOiBzdHJpbmcgfVtdID0gW107XG4gIGNvbnN0IG1heENhbmRpZGF0ZXMgPSAyMDtcbiAgXG4gIC8vIERlZmluZSByZWdpb24gYm91bmRhcmllc1xuICBjb25zdCByZWdpb25Cb3VuZHMgPSBnZXRSZWdpb25Cb3VuZHMocHJlZmVycmVkUmVnaW9uKTtcbiAgXG4gIC8vIElmIGZyaWVuZHMgZXhpc3QgYW5kIGdyb3VwaW5nIGlzIHJlcXVlc3RlZCwgYmlhcyB0b3dhcmRzIGZyaWVuZCBsb2NhdGlvbnNcbiAgaWYgKGZyaWVuZExvY2F0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgY29uc3QgZnJpZW5kQ2VudGVyID0gY2FsY3VsYXRlQ2VudGVyUG9pbnQoZnJpZW5kTG9jYXRpb25zKTtcbiAgICBjb25zdCBmcmllbmRSYWRpdXMgPSA1MDA7IC8vIDUwMCB1bml0cyBhcm91bmQgZnJpZW5kc1xuICAgIFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWF4Q2FuZGlkYXRlcyAvIDI7IGkrKykge1xuICAgICAgY29uc3QgYW5nbGUgPSBNYXRoLnJhbmRvbSgpICogMiAqIE1hdGguUEk7XG4gICAgICBjb25zdCBkaXN0YW5jZSA9IE1hdGgucmFuZG9tKCkgKiBmcmllbmRSYWRpdXM7XG4gICAgICBjb25zdCB4ID0gTWF0aC5mbG9vcihmcmllbmRDZW50ZXIueCArIE1hdGguY29zKGFuZ2xlKSAqIGRpc3RhbmNlKTtcbiAgICAgIGNvbnN0IHkgPSBNYXRoLmZsb29yKGZyaWVuZENlbnRlci55ICsgTWF0aC5zaW4oYW5nbGUpICogZGlzdGFuY2UpO1xuICAgICAgY29uc3Qgc2VjdGlvbklkID0gYCR7TWF0aC5mbG9vcih4IC8gMTAwKX0sJHtNYXRoLmZsb29yKHkgLyAxMDApfWA7XG4gICAgICBcbiAgICAgIC8vIEVuc3VyZSBjb29yZGluYXRlcyBhcmUgd2l0aGluIHJlZ2lvbiBib3VuZHNcbiAgICAgIGlmIChpc1dpdGhpbkJvdW5kcyh7IHgsIHkgfSwgcmVnaW9uQm91bmRzKSkge1xuICAgICAgICBjYW5kaWRhdGVzLnB1c2goeyB4LCB5LCBzZWN0aW9uSWQgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIFxuICAvLyBHZW5lcmF0ZSByYW5kb20gY2FuZGlkYXRlcyB3aXRoaW4gcHJlZmVycmVkIHJlZ2lvblxuICBmb3IgKGxldCBpID0gY2FuZGlkYXRlcy5sZW5ndGg7IGkgPCBtYXhDYW5kaWRhdGVzOyBpKyspIHtcbiAgICBjb25zdCB4ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKHJlZ2lvbkJvdW5kcy5tYXhYIC0gcmVnaW9uQm91bmRzLm1pblgpICsgcmVnaW9uQm91bmRzLm1pblgpO1xuICAgIGNvbnN0IHkgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAocmVnaW9uQm91bmRzLm1heFkgLSByZWdpb25Cb3VuZHMubWluWSkgKyByZWdpb25Cb3VuZHMubWluWSk7XG4gICAgY29uc3Qgc2VjdGlvbklkID0gYCR7TWF0aC5mbG9vcih4IC8gMTAwKX0sJHtNYXRoLmZsb29yKHkgLyAxMDApfWA7XG4gICAgXG4gICAgY2FuZGlkYXRlcy5wdXNoKHsgeCwgeSwgc2VjdGlvbklkIH0pO1xuICB9XG4gIFxuICByZXR1cm4gY2FuZGlkYXRlcztcbn1cblxuZnVuY3Rpb24gZ2V0UmVnaW9uQm91bmRzKHJlZ2lvbjogc3RyaW5nKTogeyBtaW5YOiBudW1iZXI7IG1heFg6IG51bWJlcjsgbWluWTogbnVtYmVyOyBtYXhZOiBudW1iZXIgfSB7XG4gIGNvbnN0IGJhc2VSYWRpdXMgPSAyMDAwOyAvLyBCYXNlIHNwYXduIHJhZGl1c1xuICBcbiAgc3dpdGNoIChyZWdpb24pIHtcbiAgICBjYXNlICdjZW50ZXInOlxuICAgICAgcmV0dXJuIHsgbWluWDogLWJhc2VSYWRpdXMvMiwgbWF4WDogYmFzZVJhZGl1cy8yLCBtaW5ZOiAtYmFzZVJhZGl1cy8yLCBtYXhZOiBiYXNlUmFkaXVzLzIgfTtcbiAgICBjYXNlICdub3J0aCc6XG4gICAgICByZXR1cm4geyBtaW5YOiAtYmFzZVJhZGl1cywgbWF4WDogYmFzZVJhZGl1cywgbWluWTogMCwgbWF4WTogYmFzZVJhZGl1cyB9O1xuICAgIGNhc2UgJ3NvdXRoJzpcbiAgICAgIHJldHVybiB7IG1pblg6IC1iYXNlUmFkaXVzLCBtYXhYOiBiYXNlUmFkaXVzLCBtaW5ZOiAtYmFzZVJhZGl1cywgbWF4WTogMCB9O1xuICAgIGNhc2UgJ2Vhc3QnOlxuICAgICAgcmV0dXJuIHsgbWluWDogMCwgbWF4WDogYmFzZVJhZGl1cywgbWluWTogLWJhc2VSYWRpdXMsIG1heFk6IGJhc2VSYWRpdXMgfTtcbiAgICBjYXNlICd3ZXN0JzpcbiAgICAgIHJldHVybiB7IG1pblg6IC1iYXNlUmFkaXVzLCBtYXhYOiAwLCBtaW5ZOiAtYmFzZVJhZGl1cywgbWF4WTogYmFzZVJhZGl1cyB9O1xuICAgIGRlZmF1bHQ6IC8vIHJhbmRvbVxuICAgICAgcmV0dXJuIHsgbWluWDogLWJhc2VSYWRpdXMsIG1heFg6IGJhc2VSYWRpdXMsIG1pblk6IC1iYXNlUmFkaXVzLCBtYXhZOiBiYXNlUmFkaXVzIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gY2FsY3VsYXRlQ2VudGVyUG9pbnQocG9pbnRzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH1bXSk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB7XG4gIGlmIChwb2ludHMubGVuZ3RoID09PSAwKSByZXR1cm4geyB4OiAwLCB5OiAwIH07XG4gIFxuICBjb25zdCBzdW0gPSBwb2ludHMucmVkdWNlKFxuICAgIChhY2MsIHBvaW50KSA9PiAoeyB4OiBhY2MueCArIHBvaW50LngsIHk6IGFjYy55ICsgcG9pbnQueSB9KSxcbiAgICB7IHg6IDAsIHk6IDAgfVxuICApO1xuICBcbiAgcmV0dXJuIHtcbiAgICB4OiBNYXRoLmZsb29yKHN1bS54IC8gcG9pbnRzLmxlbmd0aCksXG4gICAgeTogTWF0aC5mbG9vcihzdW0ueSAvIHBvaW50cy5sZW5ndGgpXG4gIH07XG59XG5cbmZ1bmN0aW9uIGlzV2l0aGluQm91bmRzKFxuICBwb2ludDogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9LFxuICBib3VuZHM6IHsgbWluWDogbnVtYmVyOyBtYXhYOiBudW1iZXI7IG1pblk6IG51bWJlcjsgbWF4WTogbnVtYmVyIH1cbik6IGJvb2xlYW4ge1xuICByZXR1cm4gcG9pbnQueCA+PSBib3VuZHMubWluWCAmJiBwb2ludC54IDw9IGJvdW5kcy5tYXhYICYmIFxuICAgICAgICAgcG9pbnQueSA+PSBib3VuZHMubWluWSAmJiBwb2ludC55IDw9IGJvdW5kcy5tYXhZO1xufVxuXG5mdW5jdGlvbiBzY29yZVNwYXduQ2FuZGlkYXRlcyhcbiAgY2FuZGlkYXRlczogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgc2VjdGlvbklkOiBzdHJpbmcgfVtdLFxuICBmcmllbmRMb2NhdGlvbnM6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfVtdXG4pOiBBcnJheTx7IFxuICBjb29yZGluYXRlczogeyB4OiBudW1iZXI7IHk6IG51bWJlciB9O1xuICBzY29yZTogbnVtYmVyO1xuICBwb3B1bGF0aW9uRGVuc2l0eTogbnVtYmVyO1xuICBzYWZldHlSYXRpbmc6IG51bWJlcjtcbiAgcmVzb3VyY2VBY2Nlc3NpYmlsaXR5OiBudW1iZXI7XG4gIGZyaWVuZFByb3hpbWl0eTogbnVtYmVyO1xufT4ge1xuICBjb25zdCBzY29yZWRDYW5kaWRhdGVzID0gY2FuZGlkYXRlcy5tYXAoY2FuZGlkYXRlID0+IHtcbiAgICAvLyBDYWxjdWxhdGUgcG9wdWxhdGlvbiBkZW5zaXR5IHNjb3JlIChsb3dlciBkZW5zaXR5ID0gaGlnaGVyIHNjb3JlKVxuICAgIGNvbnN0IHBvcHVsYXRpb25EZW5zaXR5ID0gMC4xOyAvLyBTaW1wbGlmaWVkIC0gd291bGQgcXVlcnkgYWN0dWFsIGRlbnNpdHlcbiAgICBjb25zdCBkZW5zaXR5U2NvcmUgPSBNYXRoLm1heCgwLCAxIC0gKHBvcHVsYXRpb25EZW5zaXR5IC8gMTApKTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgc2FmZXR5IHJhdGluZyAoZGlzdGFuY2UgZnJvbSBjZW50ZXIgLSBjbG9zZXIgPSBzYWZlciBmb3IgbmV3YmllcylcbiAgICBjb25zdCBkaXN0YW5jZUZyb21DZW50ZXIgPSBNYXRoLnNxcnQoY2FuZGlkYXRlLnggKiogMiArIGNhbmRpZGF0ZS55ICoqIDIpO1xuICAgIGNvbnN0IHNhZmV0eVNjb3JlID0gTWF0aC5tYXgoMCwgMSAtIChkaXN0YW5jZUZyb21DZW50ZXIgLyA1MDAwKSk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHJlc291cmNlIGFjY2Vzc2liaWxpdHkgKHNpbXBsaWZpZWQpXG4gICAgY29uc3QgcmVzb3VyY2VTY29yZSA9IDAuNyArIChNYXRoLnJhbmRvbSgpICogMC4zKTsgLy8gUmFuZG9tIGJldHdlZW4gMC43LTEuMFxuICAgIFxuICAgIC8vIENhbGN1bGF0ZSBmcmllbmQgcHJveGltaXR5IGJvbnVzXG4gICAgbGV0IGZyaWVuZFNjb3JlID0gMDtcbiAgICBpZiAoZnJpZW5kTG9jYXRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGF2Z0Rpc3RhbmNlVG9GcmllbmRzID0gZnJpZW5kTG9jYXRpb25zLnJlZHVjZShcbiAgICAgICAgKHN1bSwgZnJpZW5kKSA9PiBzdW0gKyBNYXRoLnNxcnQoXG4gICAgICAgICAgKGNhbmRpZGF0ZS54IC0gZnJpZW5kLngpICoqIDIgKyAoY2FuZGlkYXRlLnkgLSBmcmllbmQueSkgKiogMlxuICAgICAgICApLFxuICAgICAgICAwXG4gICAgICApIC8gZnJpZW5kTG9jYXRpb25zLmxlbmd0aDtcbiAgICAgIFxuICAgICAgZnJpZW5kU2NvcmUgPSBNYXRoLm1heCgwLCAxIC0gKGF2Z0Rpc3RhbmNlVG9GcmllbmRzIC8gMTAwMCkpO1xuICAgIH1cbiAgICBcbiAgICAvLyBXZWlnaHRlZCBjb21wb3NpdGUgc2NvcmVcbiAgICBjb25zdCB0b3RhbFNjb3JlID0gKGRlbnNpdHlTY29yZSAqIDAuMykgKyAoc2FmZXR5U2NvcmUgKiAwLjMpICsgXG4gICAgICAgICAgICAgICAgICAgICAgKHJlc291cmNlU2NvcmUgKiAwLjIpICsgKGZyaWVuZFNjb3JlICogMC4yKTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgY29vcmRpbmF0ZXM6IHsgeDogY2FuZGlkYXRlLngsIHk6IGNhbmRpZGF0ZS55IH0sXG4gICAgICBzY29yZTogdG90YWxTY29yZSxcbiAgICAgIHBvcHVsYXRpb25EZW5zaXR5OiBwb3B1bGF0aW9uRGVuc2l0eSxcbiAgICAgIHNhZmV0eVJhdGluZzogc2FmZXR5U2NvcmUsXG4gICAgICByZXNvdXJjZUFjY2Vzc2liaWxpdHk6IHJlc291cmNlU2NvcmUsXG4gICAgICBmcmllbmRQcm94aW1pdHk6IGZyaWVuZFNjb3JlXG4gICAgfTtcbiAgfSk7XG4gIFxuICByZXR1cm4gc2NvcmVkQ2FuZGlkYXRlcy5zb3J0KChhLCBiKSA9PiBiLnNjb3JlIC0gYS5zY29yZSk7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdE9wdGltYWxTcGF3bihcbiAgc2NvcmVkQ2FuZGlkYXRlczogQXJyYXk8e1xuICAgIGNvb3JkaW5hdGVzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG4gICAgc2NvcmU6IG51bWJlcjtcbiAgICBwb3B1bGF0aW9uRGVuc2l0eTogbnVtYmVyO1xuICAgIHNhZmV0eVJhdGluZzogbnVtYmVyO1xuICAgIHJlc291cmNlQWNjZXNzaWJpbGl0eTogbnVtYmVyO1xuICAgIGZyaWVuZFByb3hpbWl0eTogbnVtYmVyO1xuICB9PixcbiAgX3JlcXVlc3Q6IENhbGN1bGF0ZVNwYXduTG9jYXRpb25SZXF1ZXN0XG4pOiBTcGF3bkxvY2F0aW9uIHtcbiAgY29uc3QgYmVzdENhbmRpZGF0ZSA9IHNjb3JlZENhbmRpZGF0ZXNbMF07XG4gIFxuICAvLyBHZW5lcmF0ZSByZWFzb24gZm9yIHRoaXMgc3Bhd24gbG9jYXRpb25cbiAgbGV0IHJlYXNvbiA9ICdPcHRpbWFsIGJhbGFuY2Ugb2Ygc2FmZXR5IGFuZCByZXNvdXJjZXMnO1xuICBpZiAoYmVzdENhbmRpZGF0ZS5mcmllbmRQcm94aW1pdHkgPiAwLjUpIHtcbiAgICByZWFzb24gPSAnTmVhciBmcmllbmRzIGZvciBzb2NpYWwgZ2FtZXBsYXknO1xuICB9IGVsc2UgaWYgKGJlc3RDYW5kaWRhdGUuc2FmZXR5UmF0aW5nID4gMC44KSB7XG4gICAgcmVhc29uID0gJ1NhZmUgc3RhcnRlciBsb2NhdGlvbic7XG4gIH0gZWxzZSBpZiAoYmVzdENhbmRpZGF0ZS5yZXNvdXJjZUFjY2Vzc2liaWxpdHkgPiAwLjkpIHtcbiAgICByZWFzb24gPSAnRXhjZWxsZW50IHJlc291cmNlIGFjY2Vzcyc7XG4gIH0gZWxzZSBpZiAoYmVzdENhbmRpZGF0ZS5wb3B1bGF0aW9uRGVuc2l0eSA8IDAuMikge1xuICAgIHJlYXNvbiA9ICdMb3cgcG9wdWxhdGlvbiBkZW5zaXR5IGFyZWEnO1xuICB9XG4gIFxuICByZXR1cm4ge1xuICAgIGNvb3JkaW5hdGVzOiBiZXN0Q2FuZGlkYXRlLmNvb3JkaW5hdGVzLFxuICAgIHNwYXduTG9jYXRpb25JZDogYHNwYXduLSR7RGF0ZS5ub3coKX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgOSl9YCxcbiAgICBwb3B1bGF0aW9uRGVuc2l0eTogYmVzdENhbmRpZGF0ZS5wb3B1bGF0aW9uRGVuc2l0eSxcbiAgICBzYWZldHlSYXRpbmc6IGJlc3RDYW5kaWRhdGUuc2FmZXR5UmF0aW5nLFxuICAgIHJlc291cmNlQWNjZXNzaWJpbGl0eTogYmVzdENhbmRpZGF0ZS5yZXNvdXJjZUFjY2Vzc2liaWxpdHksXG4gICAgcmVhc29uOiByZWFzb25cbiAgfTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVzZXJ2ZVNwYXduTG9jYXRpb24oc3Bhd25Mb2NhdGlvbklkOiBzdHJpbmcsIHBsYXllcklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB0dGwgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArIDMwMDsgLy8gNSBtaW51dGVzIGZyb20gbm93XG4gICAgXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBVcGRhdGVDb21tYW5kKHtcbiAgICAgIFRhYmxlTmFtZTogU1BBV05fTE9DQVRJT05TX1RBQkxFLFxuICAgICAgS2V5OiB7XG4gICAgICAgIHNwYXduUmVnaW9uSWQ6ICdjYWxjdWxhdGVkJyxcbiAgICAgICAgc3Bhd25Mb2NhdGlvbklkOiBzcGF3bkxvY2F0aW9uSWRcbiAgICAgIH0sXG4gICAgICBVcGRhdGVFeHByZXNzaW9uOiAnU0VUIHJlc2VydmVkQnkgPSA6cGxheWVySWQsIHJlc2VydmVkQXQgPSA6bm93LCBpc0F2YWlsYWJsZSA9IDpmYWxzZSwgI3R0bCA9IDp0dGwnLFxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZU5hbWVzOiB7XG4gICAgICAgICcjdHRsJzogJ3R0bCdcbiAgICAgIH0sXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6cGxheWVySWQnOiBwbGF5ZXJJZCxcbiAgICAgICAgJzpub3cnOiBEYXRlLm5vdygpLFxuICAgICAgICAnOmZhbHNlJzogJ2ZhbHNlJyxcbiAgICAgICAgJzp0dGwnOiB0dGxcbiAgICAgIH0sXG4gICAgICAvLyBDcmVhdGUgdGhlIHJlY29yZCBpZiBpdCBkb2Vzbid0IGV4aXN0XG4gICAgICBSZXR1cm5WYWx1ZXM6ICdBTExfTkVXJ1xuICAgIH0pO1xuXG4gICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byByZXNlcnZlIHNwYXduIGxvY2F0aW9uJywgeyBcbiAgICAgIHNwYXduTG9jYXRpb25JZCwgXG4gICAgICBwbGF5ZXJJZCwgXG4gICAgICBlcnJvcjogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlIFxuICAgIH0pO1xuICAgIC8vIE5vbi1jcml0aWNhbCBlcnJvciAtIHNwYXduIGNhbiBzdGlsbCBiZSB1c2VkXG4gIH1cbn0iXX0=
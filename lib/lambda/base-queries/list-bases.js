"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const shared_mocks_1 = require("../../lib/shared-mocks");
const zod_1 = require("zod");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const logger = new shared_mocks_1.StructuredLogger('ListBasesHandler');
const PLAYER_BASES_TABLE = process.env.PLAYER_BASES_TABLE ?? '';
const ListBasesRequestSchema = zod_1.z.object({
    playerId: zod_1.z.string().min(1).max(50),
    status: zod_1.z.enum(['active', 'building', 'moving', 'destroyed', 'all']).optional().default('all'),
    limit: zod_1.z.number().min(1).max(100).optional().default(20),
    lastEvaluatedKey: zod_1.z.string().optional(),
    includeStats: zod_1.z.boolean().optional().default(true)
});
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
const handler = async (event) => {
    return (0, shared_mocks_1.withErrorHandling)(async () => {
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
exports.handler = handler;
function extractListBasesRequest(event) {
    const queryParams = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    return {
        playerId: (pathParams.playerId ?? queryParams.playerId) ?? '',
        status: queryParams.status ?? 'all',
        limit: queryParams.limit ? parseInt(queryParams.limit) : 20,
        lastEvaluatedKey: queryParams.lastEvaluatedKey,
        includeStats: queryParams.includeStats !== 'false'
    };
}
async function getPlayerBases(request) {
    try {
        const keyConditionExpression = 'playerId = :playerId';
        let filterExpression;
        const expressionAttributeValues = {
            ':playerId': request.playerId
        };
        // Add status filtering if not 'all'
        if (request.status !== 'all') {
            filterExpression = '#status = :status';
            expressionAttributeValues[':status'] = request.status;
        }
        // Prepare projection expression based on includeStats
        let projectionExpression;
        if (!request.includeStats) {
            projectionExpression = 'playerId, baseId, baseName, baseType, #level, coordinates, #status, createdAt, lastActiveAt';
        }
        const command = new lib_dynamodb_1.QueryCommand({
            TableName: PLAYER_BASES_TABLE,
            KeyConditionExpression: keyConditionExpression,
            FilterExpression: filterExpression,
            ExpressionAttributeNames: {
                '#status': 'status',
                '#level': 'level'
            },
            ExpressionAttributeValues: expressionAttributeValues,
            ProjectionExpression: projectionExpression,
            Limit: request.limit,
            ExclusiveStartKey: request.lastEvaluatedKey ? JSON.parse(Buffer.from(request.lastEvaluatedKey, 'base64').toString()) : undefined,
            ScanIndexForward: false // Most recent bases first
        });
        const response = await docClient.send(command);
        // Process and enrich the base data
        const bases = response.Items?.map(base => ({
            ...base,
            // Add computed fields
            isActive: base.status === 'active',
            isUpgrading: base.buildCompletionTime && base.buildCompletionTime > Date.now(),
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
        })) || [];
        // Encode pagination key
        const lastEvaluatedKey = response.LastEvaluatedKey ?
            Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') :
            undefined;
        return {
            bases: bases,
            lastEvaluatedKey: lastEvaluatedKey
        };
    }
    catch (error) {
        throw new shared_mocks_1.GameEngineError('Failed to retrieve player bases', 'BASE_QUERY_ERROR', { playerId: request.playerId, error: error.message });
    }
}
async function calculateBaseSummary(playerId) {
    try {
        // Get all bases for summary statistics
        const command = new lib_dynamodb_1.QueryCommand({
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
        const bases = response.Items || [];
        // Calculate statistics
        const summary = {
            totalBases: bases.length,
            activeBase: bases.filter(b => b.status === 'active').length,
            buildingBases: bases.filter(b => b.status === 'building').length,
            movingBases: bases.filter(b => b.status === 'moving').length,
            destroyedBases: bases.filter(b => b.status === 'destroyed').length,
            // Base type distribution
            baseTypes: bases.reduce((acc, base) => {
                acc[base.baseType] = (acc[base.baseType] ?? 0) + 1;
                return acc;
            }, {}),
            // Level distribution
            averageLevel: bases.length > 0 ?
                Math.round(bases.reduce((sum, base) => sum + (base.level || 1), 0) / bases.length * 10) / 10 : 0,
            maxLevel: bases.length > 0 ? Math.max(...bases.map(base => base.level || 1)) : 0,
            // TODO: Add subscription info (max bases allowed)
            maxBasesAllowed: 5, // Default for free players
            canCreateMore: bases.filter(b => b.status !== 'destroyed').length < 5,
            // Oldest and newest base
            oldestBase: bases.length > 0 ? Math.min(...bases.map(base => base.createdAt)) : null,
            newestBase: bases.length > 0 ? Math.max(...bases.map(base => base.createdAt)) : null
        };
        return summary;
    }
    catch (error) {
        // Return basic summary if detailed calculation fails
        logger.warn('Failed to calculate detailed base summary', {
            playerId,
            error: error.message
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlzdC1iYXNlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xhbWJkYS9iYXNlLXF1ZXJpZXMvbGlzdC1iYXNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4REFBMEQ7QUFDMUQsd0RBQTZFO0FBQzdFLHlEQUtnQztBQUNoQyw2QkFBd0I7QUFFeEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sU0FBUyxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM1RCxNQUFNLE1BQU0sR0FBRyxJQUFJLCtCQUFnQixDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFFeEQsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLEVBQUUsQ0FBQztBQUVoRSxNQUFNLHNCQUFzQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDdEMsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUNuQyxNQUFNLEVBQUUsT0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDOUYsS0FBSyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7SUFDeEQsZ0JBQWdCLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN2QyxZQUFZLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFD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QVUsRUFBRSxDQUFDO1lBQ2IsV0FBVyxFQUFFLENBQUM7WUFDZCxhQUFhLEVBQUUsQ0FBQztZQUNoQixXQUFXLEVBQUUsQ0FBQztZQUNkLGNBQWMsRUFBRSxDQUFDO1lBQ2pCLFNBQVMsRUFBRSxFQUFFO1lBQ2IsWUFBWSxFQUFFLENBQUM7WUFDZixRQUFRLEVBQUUsQ0FBQztZQUNYLGVBQWUsRUFBRSxDQUFDO1lBQ2xCLGFBQWEsRUFBRSxJQUFJO1lBQ25CLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFVBQVUsRUFBRSxJQUFJO1NBQ2pCLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tICdhd3MtbGFtYmRhJztcbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFF1ZXJ5Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYic7XG5pbXBvcnQgeyBcbiAgU3RydWN0dXJlZExvZ2dlciwgXG4gIEdhbWVFbmdpbmVFcnJvcixcbiAgd2l0aEVycm9ySGFuZGxpbmcsXG4gIHZhbGlkYXRlUmVxdWVzdCBcbn0gZnJvbSAnLi4vLi4vbGliL3NoYXJlZC1tb2Nrcyc7XG5pbXBvcnQgeyB6IH0gZnJvbSAnem9kJztcblxuY29uc3QgZHluYW1vQ2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbmNvbnN0IGRvY0NsaWVudCA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShkeW5hbW9DbGllbnQpO1xuY29uc3QgbG9nZ2VyID0gbmV3IFN0cnVjdHVyZWRMb2dnZXIoJ0xpc3RCYXNlc0hhbmRsZXInKTtcblxuY29uc3QgUExBWUVSX0JBU0VTX1RBQkxFID0gcHJvY2Vzcy5lbnYuUExBWUVSX0JBU0VTX1RBQkxFID8/ICcnO1xuXG5jb25zdCBMaXN0QmFzZXNSZXF1ZXN0U2NoZW1hID0gei5vYmplY3Qoe1xuICBwbGF5ZXJJZDogei5zdHJpbmcoKS5taW4oMSkubWF4KDUwKSxcbiAgc3RhdHVzOiB6LmVudW0oWydhY3RpdmUnLCAnYnVpbGRpbmcnLCAnbW92aW5nJywgJ2Rlc3Ryb3llZCcsICdhbGwnXSkub3B0aW9uYWwoKS5kZWZhdWx0KCdhbGwnKSxcbiAgbGltaXQ6IHoubnVtYmVyKCkubWluKDEpLm1heCgxMDApLm9wdGlvbmFsKCkuZGVmYXVsdCgyMCksXG4gIGxhc3RFdmFsdWF0ZWRLZXk6IHouc3RyaW5nKCkub3B0aW9uYWwoKSxcbiAgaW5jbHVkZVN0YXRzOiB6LmJvb2xlYW4oKS5vcHRpb25hbCgpLmRlZmF1bHQodHJ1ZSlcbn0pO1xuXG50eXBlIExpc3RCYXNlc1JlcXVlc3QgPSB6LmluZmVyPHR5cGVvZiBMaXN0QmFzZXNSZXF1ZXN0U2NoZW1hPjtcblxuLyoqXG4gKiBMaXN0IEJhc2VzIEhhbmRsZXJcbiAqIFxuICogSW1wbGVtZW50cyBiYXNlIGxpc3Rpbmcgd2l0aCBlZmZpY2llbnQgcGFnaW5hdGlvbiBmb2xsb3dpbmcgU09MSUQgcHJpbmNpcGxlczpcbiAqIC0gU2luZ2xlIFJlc3BvbnNpYmlsaXR5OiBPbmx5IGhhbmRsZXMgYmFzZSBsaXN0aW5nIG9wZXJhdGlvbnNcbiAqIC0gT3Blbi9DbG9zZWQ6IEV4dGVuc2libGUgZm9yIGFkZGl0aW9uYWwgZmlsdGVyaW5nIG9wdGlvbnNcbiAqIC0gTGlza292IFN1YnN0aXR1dGlvbjogQ29uc2lzdGVudCBxdWVyeSBpbnRlcmZhY2UgYWNyb3NzIGFsbCBmaWx0ZXJzXG4gKiAtIEludGVyZmFjZSBTZWdyZWdhdGlvbjogQ2xlYXIgc2VwYXJhdGlvbiBvZiBxdWVyeSBjb25jZXJuc1xuICogLSBEZXBlbmRlbmN5IEludmVyc2lvbjogRGVwZW5kcyBvbiBzaGFyZWQgcXVlcnkgYWJzdHJhY3Rpb25zXG4gKiBcbiAqIEZlYXR1cmVzOlxuICogLSBQYWdpbmF0ZWQgcmVzdWx0cyBmb3IgcGVyZm9ybWFuY2VcbiAqIC0gU3RhdHVzLWJhc2VkIGZpbHRlcmluZyAoYWN0aXZlLCBidWlsZGluZywgbW92aW5nLCBldGMuKVxuICogLSBPcHRpb25hbCBkZXRhaWxlZCBzdGF0cyBpbmNsdXNpb25cbiAqIC0gRWZmaWNpZW50IER5bmFtb0RCIHF1ZXJ5aW5nIHdpdGggcHJvcGVyIGluZGV4aW5nXG4gKiAtIFN1bW1hcnkgc3RhdGlzdGljcyAodG90YWwgYmFzZXMsIGJ5IHN0YXR1cylcbiAqL1xuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudFxuKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcbiAgcmV0dXJuIHdpdGhFcnJvckhhbmRsaW5nKGFzeW5jICgpID0+IHtcbiAgICBsb2dnZXIuaW5mbygnUHJvY2Vzc2luZyBsaXN0IGJhc2VzIHJlcXVlc3QnLCB7IFxuICAgICAgcmVxdWVzdElkOiBldmVudC5yZXF1ZXN0Q29udGV4dD8ucmVxdWVzdElkIFxuICAgIH0pO1xuXG4gICAgLy8gRXh0cmFjdCByZXF1ZXN0IGZyb20gcXVlcnkgcGFyYW1ldGVycyBmb3IgR0VUIHJlcXVlc3RcbiAgICBjb25zdCByZXF1ZXN0ID0gZXh0cmFjdExpc3RCYXNlc1JlcXVlc3QoZXZlbnQpO1xuICAgIFxuICAgIC8vIFZhbGlkYXRlIHRoZSBleHRyYWN0ZWQgcmVxdWVzdFxuICAgIGNvbnN0IHZhbGlkYXRlZFJlcXVlc3QgPSBMaXN0QmFzZXNSZXF1ZXN0U2NoZW1hLnBhcnNlKHJlcXVlc3QpO1xuICAgIFxuICAgIC8vIEdldCBwbGF5ZXIgYmFzZXMgd2l0aCBwYWdpbmF0aW9uXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0UGxheWVyQmFzZXModmFsaWRhdGVkUmVxdWVzdCk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHN1bW1hcnkgc3RhdGlzdGljc1xuICAgIGNvbnN0IHN1bW1hcnkgPSBhd2FpdCBjYWxjdWxhdGVCYXNlU3VtbWFyeSh2YWxpZGF0ZWRSZXF1ZXN0LnBsYXllcklkKTtcblxuICAgIGxvZ2dlci5pbmZvKCdCYXNlcyBsaXN0ZWQgc3VjY2Vzc2Z1bGx5Jywge1xuICAgICAgcGxheWVySWQ6IHZhbGlkYXRlZFJlcXVlc3QucGxheWVySWQsXG4gICAgICBiYXNlQ291bnQ6IHJlc3VsdC5iYXNlcy5sZW5ndGgsXG4gICAgICBoYXNNb3JlOiAhIXJlc3VsdC5sYXN0RXZhbHVhdGVkS2V5XG4gICAgfSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonXG4gICAgICB9LFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgYmFzZXM6IHJlc3VsdC5iYXNlcyxcbiAgICAgICAgICBzdW1tYXJ5OiBzdW1tYXJ5LFxuICAgICAgICAgIHBhZ2luYXRpb246IHtcbiAgICAgICAgICAgIGxpbWl0OiB2YWxpZGF0ZWRSZXF1ZXN0LmxpbWl0LFxuICAgICAgICAgICAgbGFzdEV2YWx1YXRlZEtleTogcmVzdWx0Lmxhc3RFdmFsdWF0ZWRLZXksXG4gICAgICAgICAgICBoYXNNb3JlOiAhIXJlc3VsdC5sYXN0RXZhbHVhdGVkS2V5XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH07XG4gIH0sIGxvZ2dlcik7XG59O1xuXG5mdW5jdGlvbiBleHRyYWN0TGlzdEJhc2VzUmVxdWVzdChldmVudDogQVBJR2F0ZXdheVByb3h5RXZlbnQpOiBMaXN0QmFzZXNSZXF1ZXN0IHtcbiAgY29uc3QgcXVlcnlQYXJhbXMgPSBldmVudC5xdWVyeVN0cmluZ1BhcmFtZXRlcnMgfHwge307XG4gIGNvbnN0IHBhdGhQYXJhbXMgPSBldmVudC5wYXRoUGFyYW1ldGVycyB8fCB7fTtcbiAgXG4gIHJldHVybiB7XG4gICAgcGxheWVySWQ6IChwYXRoUGFyYW1zLnBsYXllcklkID8/IHF1ZXJ5UGFyYW1zLnBsYXllcklkKSA/PyAnJyxcbiAgICBzdGF0dXM6IChxdWVyeVBhcmFtcy5zdGF0dXMgYXMgYW55KSA/PyAnYWxsJyxcbiAgICBsaW1pdDogcXVlcnlQYXJhbXMubGltaXQgPyBwYXJzZUludChxdWVyeVBhcmFtcy5saW1pdCkgOiAyMCxcbiAgICBsYXN0RXZhbHVhdGVkS2V5OiBxdWVyeVBhcmFtcy5sYXN0RXZhbHVhdGVkS2V5LFxuICAgIGluY2x1ZGVTdGF0czogcXVlcnlQYXJhbXMuaW5jbHVkZVN0YXRzICE9PSAnZmFsc2UnXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFBsYXllckJhc2VzKHJlcXVlc3Q6IExpc3RCYXNlc1JlcXVlc3QpOiBQcm9taXNlPHtcbiAgYmFzZXM6IGFueVtdO1xuICBsYXN0RXZhbHVhdGVkS2V5Pzogc3RyaW5nO1xufT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGtleUNvbmRpdGlvbkV4cHJlc3Npb24gPSAncGxheWVySWQgPSA6cGxheWVySWQnO1xuICAgIGxldCBmaWx0ZXJFeHByZXNzaW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgXG4gICAgY29uc3QgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICc6cGxheWVySWQnOiByZXF1ZXN0LnBsYXllcklkXG4gICAgfTtcblxuICAgIC8vIEFkZCBzdGF0dXMgZmlsdGVyaW5nIGlmIG5vdCAnYWxsJ1xuICAgIGlmIChyZXF1ZXN0LnN0YXR1cyAhPT0gJ2FsbCcpIHtcbiAgICAgIGZpbHRlckV4cHJlc3Npb24gPSAnI3N0YXR1cyA9IDpzdGF0dXMnO1xuICAgICAgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlc1snOnN0YXR1cyddID0gcmVxdWVzdC5zdGF0dXM7XG4gICAgfVxuXG4gICAgLy8gUHJlcGFyZSBwcm9qZWN0aW9uIGV4cHJlc3Npb24gYmFzZWQgb24gaW5jbHVkZVN0YXRzXG4gICAgbGV0IHByb2plY3Rpb25FeHByZXNzaW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKCFyZXF1ZXN0LmluY2x1ZGVTdGF0cykge1xuICAgICAgcHJvamVjdGlvbkV4cHJlc3Npb24gPSAncGxheWVySWQsIGJhc2VJZCwgYmFzZU5hbWUsIGJhc2VUeXBlLCAjbGV2ZWwsIGNvb3JkaW5hdGVzLCAjc3RhdHVzLCBjcmVhdGVkQXQsIGxhc3RBY3RpdmVBdCc7XG4gICAgfVxuXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBQTEFZRVJfQkFTRVNfVEFCTEUsXG4gICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiBrZXlDb25kaXRpb25FeHByZXNzaW9uLFxuICAgICAgRmlsdGVyRXhwcmVzc2lvbjogZmlsdGVyRXhwcmVzc2lvbixcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAnI2xldmVsJzogJ2xldmVsJ1xuICAgICAgfSxcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXMsXG4gICAgICBQcm9qZWN0aW9uRXhwcmVzc2lvbjogcHJvamVjdGlvbkV4cHJlc3Npb24sXG4gICAgICBMaW1pdDogcmVxdWVzdC5saW1pdCxcbiAgICAgIEV4Y2x1c2l2ZVN0YXJ0S2V5OiByZXF1ZXN0Lmxhc3RFdmFsdWF0ZWRLZXkgPyBKU09OLnBhcnNlKFxuICAgICAgICBCdWZmZXIuZnJvbShyZXF1ZXN0Lmxhc3RFdmFsdWF0ZWRLZXksICdiYXNlNjQnKS50b1N0cmluZygpXG4gICAgICApIDogdW5kZWZpbmVkLFxuICAgICAgU2NhbkluZGV4Rm9yd2FyZDogZmFsc2UgLy8gTW9zdCByZWNlbnQgYmFzZXMgZmlyc3RcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgXG4gICAgLy8gUHJvY2VzcyBhbmQgZW5yaWNoIHRoZSBiYXNlIGRhdGFcbiAgICBjb25zdCBiYXNlcyA9IHJlc3BvbnNlLkl0ZW1zPy5tYXAoYmFzZSA9PiAoe1xuICAgICAgLi4uYmFzZSxcbiAgICAgIC8vIEFkZCBjb21wdXRlZCBmaWVsZHNcbiAgICAgIGlzQWN0aXZlOiBiYXNlLnN0YXR1cyA9PT0gJ2FjdGl2ZScsXG4gICAgICBpc1VwZ3JhZGluZzogYmFzZS5idWlsZENvbXBsZXRpb25UaW1lICYmIGJhc2UuYnVpbGRDb21wbGV0aW9uVGltZSA+IERhdGUubm93KCksXG4gICAgICBjYW5Nb3ZlOiBiYXNlLnN0YXR1cyA9PT0gJ2FjdGl2ZScgJiYgKCFiYXNlLmxhc3RNb3ZlZEF0IHx8IFxuICAgICAgICAoRGF0ZS5ub3coKSAtIGJhc2UubGFzdE1vdmVkQXQpID49ICg2MCAqIDYwICogMTAwMCkpLCAvLyA2MCBtaW51dGUgY29vbGRvd25cbiAgICAgIFxuICAgICAgLy8gRm9ybWF0IGNvb3JkaW5hdGVzIGZvciBkaXNwbGF5XG4gICAgICBsb2NhdGlvbjogYCR7YmFzZS5jb29yZGluYXRlcy54fSwgJHtiYXNlLmNvb3JkaW5hdGVzLnl9YCxcbiAgICAgIFxuICAgICAgLy8gQ2FsY3VsYXRlIGFnZVxuICAgICAgYWdlSW5EYXlzOiBNYXRoLmZsb29yKChEYXRlLm5vdygpIC0gYmFzZS5jcmVhdGVkQXQpIC8gKDI0ICogNjAgKiA2MCAqIDEwMDApKSxcbiAgICAgIFxuICAgICAgLy8gU3RhdHVzLXNwZWNpZmljIGluZm9ybWF0aW9uXG4gICAgICAuLi4oYmFzZS5zdGF0dXMgPT09ICdidWlsZGluZycgJiYgYmFzZS5idWlsZENvbXBsZXRpb25UaW1lICYmIHtcbiAgICAgICAgY29tcGxldGlvbkluOiBNYXRoLm1heCgwLCBiYXNlLmJ1aWxkQ29tcGxldGlvblRpbWUgLSBEYXRlLm5vdygpKVxuICAgICAgfSksXG4gICAgICAuLi4oYmFzZS5zdGF0dXMgPT09ICdtb3ZpbmcnICYmIGJhc2UuYXJyaXZhbFRpbWUgJiYge1xuICAgICAgICBhcnJpdmFsSW46IE1hdGgubWF4KDAsIGJhc2UuYXJyaXZhbFRpbWUgLSBEYXRlLm5vdygpKVxuICAgICAgfSlcbiAgICB9KSkgfHwgW107XG5cbiAgICAvLyBFbmNvZGUgcGFnaW5hdGlvbiBrZXlcbiAgICBjb25zdCBsYXN0RXZhbHVhdGVkS2V5ID0gcmVzcG9uc2UuTGFzdEV2YWx1YXRlZEtleSA/IFxuICAgICAgQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UuTGFzdEV2YWx1YXRlZEtleSkpLnRvU3RyaW5nKCdiYXNlNjQnKSA6IFxuICAgICAgdW5kZWZpbmVkO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGJhc2VzOiBiYXNlcyxcbiAgICAgIGxhc3RFdmFsdWF0ZWRLZXk6IGxhc3RFdmFsdWF0ZWRLZXlcbiAgICB9O1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcihcbiAgICAgICdGYWlsZWQgdG8gcmV0cmlldmUgcGxheWVyIGJhc2VzJyxcbiAgICAgICdCQVNFX1FVRVJZX0VSUk9SJyxcbiAgICAgIHsgcGxheWVySWQ6IHJlcXVlc3QucGxheWVySWQsIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfVxuICAgICk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2FsY3VsYXRlQmFzZVN1bW1hcnkocGxheWVySWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHRyeSB7XG4gICAgLy8gR2V0IGFsbCBiYXNlcyBmb3Igc3VtbWFyeSBzdGF0aXN0aWNzXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBQTEFZRVJfQkFTRVNfVEFCTEUsXG4gICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncGxheWVySWQgPSA6cGxheWVySWQnLFxuICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAnOnBsYXllcklkJzogcGxheWVySWRcbiAgICAgIH0sXG4gICAgICBQcm9qZWN0aW9uRXhwcmVzc2lvbjogJyNzdGF0dXMsIGJhc2VUeXBlLCAjbGV2ZWwsIGNyZWF0ZWRBdCcsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlTmFtZXM6IHtcbiAgICAgICAgJyNzdGF0dXMnOiAnc3RhdHVzJyxcbiAgICAgICAgJyNsZXZlbCc6ICdsZXZlbCdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgY29uc3QgYmFzZXMgPSByZXNwb25zZS5JdGVtcyB8fCBbXTtcblxuICAgIC8vIENhbGN1bGF0ZSBzdGF0aXN0aWNzXG4gICAgY29uc3Qgc3VtbWFyeSA9IHtcbiAgICAgIHRvdGFsQmFzZXM6IGJhc2VzLmxlbmd0aCxcbiAgICAgIGFjdGl2ZUJhc2U6IGJhc2VzLmZpbHRlcihiID0+IGIuc3RhdHVzID09PSAnYWN0aXZlJykubGVuZ3RoLFxuICAgICAgYnVpbGRpbmdCYXNlczogYmFzZXMuZmlsdGVyKGIgPT4gYi5zdGF0dXMgPT09ICdidWlsZGluZycpLmxlbmd0aCxcbiAgICAgIG1vdmluZ0Jhc2VzOiBiYXNlcy5maWx0ZXIoYiA9PiBiLnN0YXR1cyA9PT0gJ21vdmluZycpLmxlbmd0aCxcbiAgICAgIGRlc3Ryb3llZEJhc2VzOiBiYXNlcy5maWx0ZXIoYiA9PiBiLnN0YXR1cyA9PT0gJ2Rlc3Ryb3llZCcpLmxlbmd0aCxcbiAgICAgIFxuICAgICAgLy8gQmFzZSB0eXBlIGRpc3RyaWJ1dGlvblxuICAgICAgYmFzZVR5cGVzOiBiYXNlcy5yZWR1Y2UoKGFjYywgYmFzZSkgPT4ge1xuICAgICAgICBhY2NbYmFzZS5iYXNlVHlwZV0gPSAoYWNjW2Jhc2UuYmFzZVR5cGVdID8/IDApICsgMTtcbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sIHt9IGFzIFJlY29yZDxzdHJpbmcsIG51bWJlcj4pLFxuICAgICAgXG4gICAgICAvLyBMZXZlbCBkaXN0cmlidXRpb25cbiAgICAgIGF2ZXJhZ2VMZXZlbDogYmFzZXMubGVuZ3RoID4gMCA/IFxuICAgICAgICBNYXRoLnJvdW5kKGJhc2VzLnJlZHVjZSgoc3VtLCBiYXNlKSA9PiBzdW0gKyAoYmFzZS5sZXZlbCB8fCAxKSwgMCkgLyBiYXNlcy5sZW5ndGggKiAxMCkgLyAxMCA6IDAsXG4gICAgICBtYXhMZXZlbDogYmFzZXMubGVuZ3RoID4gMCA/IE1hdGgubWF4KC4uLmJhc2VzLm1hcChiYXNlID0+IGJhc2UubGV2ZWwgfHwgMSkpIDogMCxcbiAgICAgIFxuICAgICAgLy8gVE9ETzogQWRkIHN1YnNjcmlwdGlvbiBpbmZvIChtYXggYmFzZXMgYWxsb3dlZClcbiAgICAgIG1heEJhc2VzQWxsb3dlZDogNSwgLy8gRGVmYXVsdCBmb3IgZnJlZSBwbGF5ZXJzXG4gICAgICBjYW5DcmVhdGVNb3JlOiBiYXNlcy5maWx0ZXIoYiA9PiBiLnN0YXR1cyAhPT0gJ2Rlc3Ryb3llZCcpLmxlbmd0aCA8IDUsXG4gICAgICBcbiAgICAgIC8vIE9sZGVzdCBhbmQgbmV3ZXN0IGJhc2VcbiAgICAgIG9sZGVzdEJhc2U6IGJhc2VzLmxlbmd0aCA+IDAgPyBNYXRoLm1pbiguLi5iYXNlcy5tYXAoYmFzZSA9PiBiYXNlLmNyZWF0ZWRBdCkpIDogbnVsbCxcbiAgICAgIG5ld2VzdEJhc2U6IGJhc2VzLmxlbmd0aCA+IDAgPyBNYXRoLm1heCguLi5iYXNlcy5tYXAoYmFzZSA9PiBiYXNlLmNyZWF0ZWRBdCkpIDogbnVsbFxuICAgIH07XG5cbiAgICByZXR1cm4gc3VtbWFyeTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIFJldHVybiBiYXNpYyBzdW1tYXJ5IGlmIGRldGFpbGVkIGNhbGN1bGF0aW9uIGZhaWxzXG4gICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byBjYWxjdWxhdGUgZGV0YWlsZWQgYmFzZSBzdW1tYXJ5JywgeyBcbiAgICAgIHBsYXllcklkLCBcbiAgICAgIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsQmFzZXM6IDAsXG4gICAgICBhY3RpdmVCYXNlczogMCxcbiAgICAgIGJ1aWxkaW5nQmFzZXM6IDAsXG4gICAgICBtb3ZpbmdCYXNlczogMCxcbiAgICAgIGRlc3Ryb3llZEJhc2VzOiAwLFxuICAgICAgYmFzZVR5cGVzOiB7fSxcbiAgICAgIGF2ZXJhZ2VMZXZlbDogMCxcbiAgICAgIG1heExldmVsOiAwLFxuICAgICAgbWF4QmFzZXNBbGxvd2VkOiA1LFxuICAgICAgY2FuQ3JlYXRlTW9yZTogdHJ1ZSxcbiAgICAgIG9sZGVzdEJhc2U6IG51bGwsXG4gICAgICBuZXdlc3RCYXNlOiBudWxsXG4gICAgfTtcbiAgfVxufSJdfQ==
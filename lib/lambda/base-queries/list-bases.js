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
    const queryParams = event.queryStringParameters ?? {};
    const pathParams = event.pathParameters ?? {};
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
        const bases = (response.Items ?? []).map(item => {
            // Type assertion to ensure we have the expected structure
            const base = item;
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
            };
        });
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
        const bases = (response.Items ?? []).map(item => item);
        // Calculate statistics
        const summary = {
            totalBases: bases.length,
            activeBases: bases.filter(b => b.status === 'active').length,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlzdC1iYXNlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xhbWJkYS9iYXNlLXF1ZXJpZXMvbGlzdC1iYXNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4REFBMEQ7QUFDMUQsd0RBQTZFO0FBQzdFLHlEQUlnQztBQUNoQyw2QkFBd0I7QUFNeEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxnQ0FBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQzVDLE1BQU0sU0FBUyxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM1RCxNQUFNLE1BQU0sR0FBRyxJQUFJLCtCQUFnQixDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFFeEQsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLEVBQUUsQ0FBQztBQUVoRSxNQUFNLHNCQUFzQixHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDdEMsUUFBUSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztJQUNuQyxNQUFNLEVBQUUsT0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDOUYsS0FBSyxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7SUFDeEQsZ0JBQWdCLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN2QyxZQUFZLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFD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QUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLHFEQUFxRDtRQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFDLDJDQUEyQyxFQUFFO1lBQ3ZELFFBQVE7WUFDUixLQUFLLEVBQUcsS0FBZSxDQUFDLE9BQU87U0FDaEMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLFVBQVUsRUFBRSxDQUFDO1lBQ2IsV0FBVyxFQUFFLENBQUM7WUFDZCxhQUFhLEVBQUUsQ0FBQztZQUNoQixXQUFXLEVBQUUsQ0FBQztZQUNkLGNBQWMsRUFBRSxDQUFDO1lBQ2pCLFNBQVMsRUFBRSxFQUFFO1lBQ2IsWUFBWSxFQUFFLENBQUM7WUFDZixRQUFRLEVBQUUsQ0FBQztZQUNYLGVBQWUsRUFBRSxDQUFDO1lBQ2xCLGFBQWEsRUFBRSxJQUFJO1lBQ25CLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLFVBQVUsRUFBRSxJQUFJO1NBQ2pCLENBQUM7SUFDSixDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBBUElHYXRld2F5UHJveHlSZXN1bHQgfSBmcm9tICdhd3MtbGFtYmRhJztcbmltcG9ydCB7IER5bmFtb0RCQ2xpZW50IH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJztcbmltcG9ydCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFF1ZXJ5Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2xpYi1keW5hbW9kYic7XG5pbXBvcnQgeyBcbiAgU3RydWN0dXJlZExvZ2dlciwgXG4gIEdhbWVFbmdpbmVFcnJvcixcbiAgd2l0aEVycm9ySGFuZGxpbmdcbn0gZnJvbSAnLi4vLi4vbGliL3NoYXJlZC1tb2Nrcyc7XG5pbXBvcnQgeyB6IH0gZnJvbSAnem9kJztcbmltcG9ydCB7IFxuICBCYXNlU3VtbWFyeSwgXG4gIEVucmljaGVkUGxheWVyQmFzZVxufSBmcm9tICcuLi90eXBlcy9nYW1lLWJhc2UtdHlwZXMnO1xuXG5jb25zdCBkeW5hbW9DbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xuY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGR5bmFtb0NsaWVudCk7XG5jb25zdCBsb2dnZXIgPSBuZXcgU3RydWN0dXJlZExvZ2dlcignTGlzdEJhc2VzSGFuZGxlcicpO1xuXG5jb25zdCBQTEFZRVJfQkFTRVNfVEFCTEUgPSBwcm9jZXNzLmVudi5QTEFZRVJfQkFTRVNfVEFCTEUgPz8gJyc7XG5cbmNvbnN0IExpc3RCYXNlc1JlcXVlc3RTY2hlbWEgPSB6Lm9iamVjdCh7XG4gIHBsYXllcklkOiB6LnN0cmluZygpLm1pbigxKS5tYXgoNTApLFxuICBzdGF0dXM6IHouZW51bShbJ2FjdGl2ZScsICdidWlsZGluZycsICdtb3ZpbmcnLCAnZGVzdHJveWVkJywgJ2FsbCddKS5vcHRpb25hbCgpLmRlZmF1bHQoJ2FsbCcpLFxuICBsaW1pdDogei5udW1iZXIoKS5taW4oMSkubWF4KDEwMCkub3B0aW9uYWwoKS5kZWZhdWx0KDIwKSxcbiAgbGFzdEV2YWx1YXRlZEtleTogei5zdHJpbmcoKS5vcHRpb25hbCgpLFxuICBpbmNsdWRlU3RhdHM6IHouYm9vbGVhbigpLm9wdGlvbmFsKCkuZGVmYXVsdCh0cnVlKVxufSk7XG5cbnR5cGUgTGlzdEJhc2VzUmVxdWVzdElucHV0ID0gei5pbmZlcjx0eXBlb2YgTGlzdEJhc2VzUmVxdWVzdFNjaGVtYT47XG5cbi8qKlxuICogTGlzdCBCYXNlcyBIYW5kbGVyXG4gKiBcbiAqIEltcGxlbWVudHMgYmFzZSBsaXN0aW5nIHdpdGggZWZmaWNpZW50IHBhZ2luYXRpb24gZm9sbG93aW5nIFNPTElEIHByaW5jaXBsZXM6XG4gKiAtIFNpbmdsZSBSZXNwb25zaWJpbGl0eTogT25seSBoYW5kbGVzIGJhc2UgbGlzdGluZyBvcGVyYXRpb25zXG4gKiAtIE9wZW4vQ2xvc2VkOiBFeHRlbnNpYmxlIGZvciBhZGRpdGlvbmFsIGZpbHRlcmluZyBvcHRpb25zXG4gKiAtIExpc2tvdiBTdWJzdGl0dXRpb246IENvbnNpc3RlbnQgcXVlcnkgaW50ZXJmYWNlIGFjcm9zcyBhbGwgZmlsdGVyc1xuICogLSBJbnRlcmZhY2UgU2VncmVnYXRpb246IENsZWFyIHNlcGFyYXRpb24gb2YgcXVlcnkgY29uY2VybnNcbiAqIC0gRGVwZW5kZW5jeSBJbnZlcnNpb246IERlcGVuZHMgb24gc2hhcmVkIHF1ZXJ5IGFic3RyYWN0aW9uc1xuICogXG4gKiBGZWF0dXJlczpcbiAqIC0gUGFnaW5hdGVkIHJlc3VsdHMgZm9yIHBlcmZvcm1hbmNlXG4gKiAtIFN0YXR1cy1iYXNlZCBmaWx0ZXJpbmcgKGFjdGl2ZSwgYnVpbGRpbmcsIG1vdmluZywgZXRjLilcbiAqIC0gT3B0aW9uYWwgZGV0YWlsZWQgc3RhdHMgaW5jbHVzaW9uXG4gKiAtIEVmZmljaWVudCBEeW5hbW9EQiBxdWVyeWluZyB3aXRoIHByb3BlciBpbmRleGluZ1xuICogLSBTdW1tYXJ5IHN0YXRpc3RpY3MgKHRvdGFsIGJhc2VzLCBieSBzdGF0dXMpXG4gKi9cbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKFxuICBldmVudDogQVBJR2F0ZXdheVByb3h5RXZlbnRcbik6IFByb21pc2U8QVBJR2F0ZXdheVByb3h5UmVzdWx0PiA9PiB7XG4gIHJldHVybiB3aXRoRXJyb3JIYW5kbGluZyhhc3luYyAoKSA9PiB7XG4gICAgbG9nZ2VyLmluZm8oJ1Byb2Nlc3NpbmcgbGlzdCBiYXNlcyByZXF1ZXN0JywgeyBcbiAgICAgIHJlcXVlc3RJZDogZXZlbnQucmVxdWVzdENvbnRleHQ/LnJlcXVlc3RJZCBcbiAgICB9KTtcblxuICAgIC8vIEV4dHJhY3QgcmVxdWVzdCBmcm9tIHF1ZXJ5IHBhcmFtZXRlcnMgZm9yIEdFVCByZXF1ZXN0XG4gICAgY29uc3QgcmVxdWVzdCA9IGV4dHJhY3RMaXN0QmFzZXNSZXF1ZXN0KGV2ZW50KTtcbiAgICBcbiAgICAvLyBWYWxpZGF0ZSB0aGUgZXh0cmFjdGVkIHJlcXVlc3RcbiAgICBjb25zdCB2YWxpZGF0ZWRSZXF1ZXN0ID0gTGlzdEJhc2VzUmVxdWVzdFNjaGVtYS5wYXJzZShyZXF1ZXN0KTtcbiAgICBcbiAgICAvLyBHZXQgcGxheWVyIGJhc2VzIHdpdGggcGFnaW5hdGlvblxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldFBsYXllckJhc2VzKHZhbGlkYXRlZFJlcXVlc3QpO1xuICAgIFxuICAgIC8vIENhbGN1bGF0ZSBzdW1tYXJ5IHN0YXRpc3RpY3NcbiAgICBjb25zdCBzdW1tYXJ5ID0gYXdhaXQgY2FsY3VsYXRlQmFzZVN1bW1hcnkodmFsaWRhdGVkUmVxdWVzdC5wbGF5ZXJJZCk7XG5cbiAgICBsb2dnZXIuaW5mbygnQmFzZXMgbGlzdGVkIHN1Y2Nlc3NmdWxseScsIHtcbiAgICAgIHBsYXllcklkOiB2YWxpZGF0ZWRSZXF1ZXN0LnBsYXllcklkLFxuICAgICAgYmFzZUNvdW50OiByZXN1bHQuYmFzZXMubGVuZ3RoLFxuICAgICAgaGFzTW9yZTogISFyZXN1bHQubGFzdEV2YWx1YXRlZEtleVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJ1xuICAgICAgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGJhc2VzOiByZXN1bHQuYmFzZXMsXG4gICAgICAgICAgc3VtbWFyeTogc3VtbWFyeSxcbiAgICAgICAgICBwYWdpbmF0aW9uOiB7XG4gICAgICAgICAgICBsaW1pdDogdmFsaWRhdGVkUmVxdWVzdC5saW1pdCxcbiAgICAgICAgICAgIGxhc3RFdmFsdWF0ZWRLZXk6IHJlc3VsdC5sYXN0RXZhbHVhdGVkS2V5LFxuICAgICAgICAgICAgaGFzTW9yZTogISFyZXN1bHQubGFzdEV2YWx1YXRlZEtleVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9O1xuICB9LCBsb2dnZXIpO1xufTtcblxuZnVuY3Rpb24gZXh0cmFjdExpc3RCYXNlc1JlcXVlc3QoZXZlbnQ6IEFQSUdhdGV3YXlQcm94eUV2ZW50KTogTGlzdEJhc2VzUmVxdWVzdElucHV0IHtcbiAgY29uc3QgcXVlcnlQYXJhbXMgPSBldmVudC5xdWVyeVN0cmluZ1BhcmFtZXRlcnMgPz8ge307XG4gIGNvbnN0IHBhdGhQYXJhbXMgPSBldmVudC5wYXRoUGFyYW1ldGVycyA/PyB7fTtcbiAgXG4gIHJldHVybiB7XG4gICAgcGxheWVySWQ6IChwYXRoUGFyYW1zLnBsYXllcklkID8/IHF1ZXJ5UGFyYW1zLnBsYXllcklkKSA/PyAnJyxcbiAgICBzdGF0dXM6IChxdWVyeVBhcmFtcy5zdGF0dXMgYXMgJ2FjdGl2ZScgfCAnYnVpbGRpbmcnIHwgJ21vdmluZycgfCAnZGVzdHJveWVkJyB8ICdhbGwnKSA/PyAnYWxsJyxcbiAgICBsaW1pdDogcXVlcnlQYXJhbXMubGltaXQgPyBwYXJzZUludChxdWVyeVBhcmFtcy5saW1pdCkgOiAyMCxcbiAgICBsYXN0RXZhbHVhdGVkS2V5OiBxdWVyeVBhcmFtcy5sYXN0RXZhbHVhdGVkS2V5LFxuICAgIGluY2x1ZGVTdGF0czogcXVlcnlQYXJhbXMuaW5jbHVkZVN0YXRzICE9PSAnZmFsc2UnXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFBsYXllckJhc2VzKHJlcXVlc3Q6IExpc3RCYXNlc1JlcXVlc3RJbnB1dCk6IFByb21pc2U8e1xuICBiYXNlczogRW5yaWNoZWRQbGF5ZXJCYXNlW107XG4gIGxhc3RFdmFsdWF0ZWRLZXk/OiBzdHJpbmc7XG59PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qga2V5Q29uZGl0aW9uRXhwcmVzc2lvbiA9ICdwbGF5ZXJJZCA9IDpwbGF5ZXJJZCc7XG4gICAgbGV0IGZpbHRlckV4cHJlc3Npb246IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBcbiAgICBjb25zdCBleHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgICc6cGxheWVySWQnOiByZXF1ZXN0LnBsYXllcklkXG4gICAgfTtcblxuICAgIC8vIEFkZCBzdGF0dXMgZmlsdGVyaW5nIGlmIG5vdCAnYWxsJ1xuICAgIGlmIChyZXF1ZXN0LnN0YXR1cyAhPT0gJ2FsbCcpIHtcbiAgICAgIGZpbHRlckV4cHJlc3Npb24gPSAnI3N0YXR1cyA9IDpzdGF0dXMnO1xuICAgICAgZXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlc1snOnN0YXR1cyddID0gcmVxdWVzdC5zdGF0dXM7XG4gICAgfVxuXG4gICAgLy8gUHJlcGFyZSBwcm9qZWN0aW9uIGV4cHJlc3Npb24gYmFzZWQgb24gaW5jbHVkZVN0YXRzXG4gICAgbGV0IHByb2plY3Rpb25FeHByZXNzaW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgaWYgKCFyZXF1ZXN0LmluY2x1ZGVTdGF0cykge1xuICAgICAgcHJvamVjdGlvbkV4cHJlc3Npb24gPSAncGxheWVySWQsIGJhc2VJZCwgYmFzZU5hbWUsIGJhc2VUeXBlLCAjbGV2ZWwsIGNvb3JkaW5hdGVzLCAjc3RhdHVzLCBjcmVhdGVkQXQsIGxhc3RBY3RpdmVBdCc7XG4gICAgfVxuXG4gICAgY29uc3QgY29tbWFuZCA9IG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgVGFibGVOYW1lOiBQTEFZRVJfQkFTRVNfVEFCTEUsXG4gICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiBrZXlDb25kaXRpb25FeHByZXNzaW9uLFxuICAgICAgRmlsdGVyRXhwcmVzc2lvbjogZmlsdGVyRXhwcmVzc2lvbixcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAnI2xldmVsJzogJ2xldmVsJ1xuICAgICAgfSxcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IGV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXMsXG4gICAgICBQcm9qZWN0aW9uRXhwcmVzc2lvbjogcHJvamVjdGlvbkV4cHJlc3Npb24sXG4gICAgICBMaW1pdDogcmVxdWVzdC5saW1pdCxcbiAgICAgIEV4Y2x1c2l2ZVN0YXJ0S2V5OiByZXF1ZXN0Lmxhc3RFdmFsdWF0ZWRLZXkgPyBKU09OLnBhcnNlKFxuICAgICAgICBCdWZmZXIuZnJvbShyZXF1ZXN0Lmxhc3RFdmFsdWF0ZWRLZXksICdiYXNlNjQnKS50b1N0cmluZygpXG4gICAgICApIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+IDogdW5kZWZpbmVkLFxuICAgICAgU2NhbkluZGV4Rm9yd2FyZDogZmFsc2UgLy8gTW9zdCByZWNlbnQgYmFzZXMgZmlyc3RcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgXG4gICAgLy8gUHJvY2VzcyBhbmQgZW5yaWNoIHRoZSBiYXNlIGRhdGFcbiAgICBjb25zdCBiYXNlcyA9IChyZXNwb25zZS5JdGVtcyA/PyBbXSkubWFwKGl0ZW0gPT4ge1xuICAgICAgLy8gVHlwZSBhc3NlcnRpb24gdG8gZW5zdXJlIHdlIGhhdmUgdGhlIGV4cGVjdGVkIHN0cnVjdHVyZVxuICAgICAgY29uc3QgYmFzZSA9IGl0ZW0gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4gJiB7XG4gICAgICAgIGNvb3JkaW5hdGVzOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG4gICAgICAgIHN0YXR1czogc3RyaW5nO1xuICAgICAgICBidWlsZENvbXBsZXRpb25UaW1lPzogbnVtYmVyO1xuICAgICAgICBhcnJpdmFsVGltZT86IG51bWJlcjtcbiAgICAgICAgbGFzdE1vdmVkQXQ/OiBudW1iZXI7XG4gICAgICAgIGNyZWF0ZWRBdDogbnVtYmVyO1xuICAgICAgfTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4uYmFzZSxcbiAgICAgICAgLy8gQWRkIGNvbXB1dGVkIGZpZWxkc1xuICAgICAgICBpc0FjdGl2ZTogYmFzZS5zdGF0dXMgPT09ICdhY3RpdmUnLFxuICAgICAgICBpc1VwZ3JhZGluZzogQm9vbGVhbihiYXNlLmJ1aWxkQ29tcGxldGlvblRpbWUgJiYgYmFzZS5idWlsZENvbXBsZXRpb25UaW1lID4gRGF0ZS5ub3coKSksXG4gICAgICAgIGNhbk1vdmU6IGJhc2Uuc3RhdHVzID09PSAnYWN0aXZlJyAmJiAoIWJhc2UubGFzdE1vdmVkQXQgfHwgXG4gICAgICAgICAgKERhdGUubm93KCkgLSBiYXNlLmxhc3RNb3ZlZEF0KSA+PSAoNjAgKiA2MCAqIDEwMDApKSwgLy8gNjAgbWludXRlIGNvb2xkb3duXG4gICAgICAgIFxuICAgICAgICAvLyBGb3JtYXQgY29vcmRpbmF0ZXMgZm9yIGRpc3BsYXlcbiAgICAgICAgbG9jYXRpb246IGAke2Jhc2UuY29vcmRpbmF0ZXMueH0sICR7YmFzZS5jb29yZGluYXRlcy55fWAsXG4gICAgICAgIFxuICAgICAgICAvLyBDYWxjdWxhdGUgYWdlXG4gICAgICAgIGFnZUluRGF5czogTWF0aC5mbG9vcigoRGF0ZS5ub3coKSAtIGJhc2UuY3JlYXRlZEF0KSAvICgyNCAqIDYwICogNjAgKiAxMDAwKSksXG4gICAgICAgIFxuICAgICAgICAvLyBTdGF0dXMtc3BlY2lmaWMgaW5mb3JtYXRpb25cbiAgICAgICAgLi4uKGJhc2Uuc3RhdHVzID09PSAnYnVpbGRpbmcnICYmIGJhc2UuYnVpbGRDb21wbGV0aW9uVGltZSAmJiB7XG4gICAgICAgICAgY29tcGxldGlvbkluOiBNYXRoLm1heCgwLCBiYXNlLmJ1aWxkQ29tcGxldGlvblRpbWUgLSBEYXRlLm5vdygpKVxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKGJhc2Uuc3RhdHVzID09PSAnbW92aW5nJyAmJiBiYXNlLmFycml2YWxUaW1lICYmIHtcbiAgICAgICAgICBhcnJpdmFsSW46IE1hdGgubWF4KDAsIGJhc2UuYXJyaXZhbFRpbWUgLSBEYXRlLm5vdygpKVxuICAgICAgICB9KVxuICAgICAgfSBhcyBFbnJpY2hlZFBsYXllckJhc2U7XG4gICAgfSk7XG5cbiAgICAvLyBFbmNvZGUgcGFnaW5hdGlvbiBrZXlcbiAgICBjb25zdCBsYXN0RXZhbHVhdGVkS2V5ID0gcmVzcG9uc2UuTGFzdEV2YWx1YXRlZEtleSA/IFxuICAgICAgQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UuTGFzdEV2YWx1YXRlZEtleSkpLnRvU3RyaW5nKCdiYXNlNjQnKSA6IFxuICAgICAgdW5kZWZpbmVkO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGJhc2VzOiBiYXNlcyxcbiAgICAgIGxhc3RFdmFsdWF0ZWRLZXk6IGxhc3RFdmFsdWF0ZWRLZXlcbiAgICB9O1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgdGhyb3cgbmV3IEdhbWVFbmdpbmVFcnJvcihcbiAgICAgICdGYWlsZWQgdG8gcmV0cmlldmUgcGxheWVyIGJhc2VzJyxcbiAgICAgICdCQVNFX1FVRVJZX0VSUk9SJyxcbiAgICAgIHsgcGxheWVySWQ6IHJlcXVlc3QucGxheWVySWQsIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgfVxuICAgICk7XG4gIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2FsY3VsYXRlQmFzZVN1bW1hcnkocGxheWVySWQ6IHN0cmluZyk6IFByb21pc2U8QmFzZVN1bW1hcnk+IHtcbiAgdHJ5IHtcbiAgICAvLyBHZXQgYWxsIGJhc2VzIGZvciBzdW1tYXJ5IHN0YXRpc3RpY3NcbiAgICBjb25zdCBjb21tYW5kID0gbmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICBUYWJsZU5hbWU6IFBMQVlFUl9CQVNFU19UQUJMRSxcbiAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICdwbGF5ZXJJZCA9IDpwbGF5ZXJJZCcsXG4gICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICc6cGxheWVySWQnOiBwbGF5ZXJJZFxuICAgICAgfSxcbiAgICAgIFByb2plY3Rpb25FeHByZXNzaW9uOiAnI3N0YXR1cywgYmFzZVR5cGUsICNsZXZlbCwgY3JlYXRlZEF0JyxcbiAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAnI3N0YXR1cyc6ICdzdGF0dXMnLFxuICAgICAgICAnI2xldmVsJzogJ2xldmVsJ1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChjb21tYW5kKTtcbiAgICBjb25zdCBiYXNlcyA9IChyZXNwb25zZS5JdGVtcyA/PyBbXSkubWFwKGl0ZW0gPT4gaXRlbSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiAmIHtcbiAgICAgIHN0YXR1czogc3RyaW5nO1xuICAgICAgYmFzZVR5cGU6IHN0cmluZztcbiAgICAgIGxldmVsPzogbnVtYmVyO1xuICAgICAgY3JlYXRlZEF0OiBudW1iZXI7XG4gICAgfSk7XG5cbiAgICAvLyBDYWxjdWxhdGUgc3RhdGlzdGljc1xuICAgIGNvbnN0IHN1bW1hcnk6IEJhc2VTdW1tYXJ5ID0ge1xuICAgICAgdG90YWxCYXNlczogYmFzZXMubGVuZ3RoLFxuICAgICAgYWN0aXZlQmFzZXM6IGJhc2VzLmZpbHRlcihiID0+IGIuc3RhdHVzID09PSAnYWN0aXZlJykubGVuZ3RoLFxuICAgICAgYnVpbGRpbmdCYXNlczogYmFzZXMuZmlsdGVyKGIgPT4gYi5zdGF0dXMgPT09ICdidWlsZGluZycpLmxlbmd0aCxcbiAgICAgIG1vdmluZ0Jhc2VzOiBiYXNlcy5maWx0ZXIoYiA9PiBiLnN0YXR1cyA9PT0gJ21vdmluZycpLmxlbmd0aCxcbiAgICAgIGRlc3Ryb3llZEJhc2VzOiBiYXNlcy5maWx0ZXIoYiA9PiBiLnN0YXR1cyA9PT0gJ2Rlc3Ryb3llZCcpLmxlbmd0aCxcbiAgICAgIFxuICAgICAgLy8gQmFzZSB0eXBlIGRpc3RyaWJ1dGlvblxuICAgICAgYmFzZVR5cGVzOiBiYXNlcy5yZWR1Y2UoKGFjYywgYmFzZSkgPT4ge1xuICAgICAgICBhY2NbYmFzZS5iYXNlVHlwZV0gPSAoYWNjW2Jhc2UuYmFzZVR5cGVdID8/IDApICsgMTtcbiAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgIH0sIHt9IGFzIFJlY29yZDxzdHJpbmcsIG51bWJlcj4pLFxuICAgICAgXG4gICAgICAvLyBMZXZlbCBkaXN0cmlidXRpb25cbiAgICAgIGF2ZXJhZ2VMZXZlbDogYmFzZXMubGVuZ3RoID4gMCA/IFxuICAgICAgICBNYXRoLnJvdW5kKGJhc2VzLnJlZHVjZSgoc3VtLCBiYXNlKSA9PiBzdW0gKyAoYmFzZS5sZXZlbCA/PyAxKSwgMCkgLyBiYXNlcy5sZW5ndGggKiAxMCkgLyAxMCA6IDAsXG4gICAgICBtYXhMZXZlbDogYmFzZXMubGVuZ3RoID4gMCA/IE1hdGgubWF4KC4uLmJhc2VzLm1hcChiYXNlID0+IGJhc2UubGV2ZWwgPz8gMSkpIDogMCxcbiAgICAgIFxuICAgICAgLy8gVE9ETzogQWRkIHN1YnNjcmlwdGlvbiBpbmZvIChtYXggYmFzZXMgYWxsb3dlZClcbiAgICAgIG1heEJhc2VzQWxsb3dlZDogNSwgLy8gRGVmYXVsdCBmb3IgZnJlZSBwbGF5ZXJzXG4gICAgICBjYW5DcmVhdGVNb3JlOiBiYXNlcy5maWx0ZXIoYiA9PiBiLnN0YXR1cyAhPT0gJ2Rlc3Ryb3llZCcpLmxlbmd0aCA8IDUsXG4gICAgICBcbiAgICAgIC8vIE9sZGVzdCBhbmQgbmV3ZXN0IGJhc2VcbiAgICAgIG9sZGVzdEJhc2U6IGJhc2VzLmxlbmd0aCA+IDAgPyBNYXRoLm1pbiguLi5iYXNlcy5tYXAoYmFzZSA9PiBiYXNlLmNyZWF0ZWRBdCkpIDogbnVsbCxcbiAgICAgIG5ld2VzdEJhc2U6IGJhc2VzLmxlbmd0aCA+IDAgPyBNYXRoLm1heCguLi5iYXNlcy5tYXAoYmFzZSA9PiBiYXNlLmNyZWF0ZWRBdCkpIDogbnVsbFxuICAgIH07XG5cbiAgICByZXR1cm4gc3VtbWFyeTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIFJldHVybiBiYXNpYyBzdW1tYXJ5IGlmIGRldGFpbGVkIGNhbGN1bGF0aW9uIGZhaWxzXG4gICAgbG9nZ2VyLndhcm4oJ0ZhaWxlZCB0byBjYWxjdWxhdGUgZGV0YWlsZWQgYmFzZSBzdW1tYXJ5JywgeyBcbiAgICAgIHBsYXllcklkLCBcbiAgICAgIGVycm9yOiAoZXJyb3IgYXMgRXJyb3IpLm1lc3NhZ2UgXG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsQmFzZXM6IDAsXG4gICAgICBhY3RpdmVCYXNlczogMCxcbiAgICAgIGJ1aWxkaW5nQmFzZXM6IDAsXG4gICAgICBtb3ZpbmdCYXNlczogMCxcbiAgICAgIGRlc3Ryb3llZEJhc2VzOiAwLFxuICAgICAgYmFzZVR5cGVzOiB7fSxcbiAgICAgIGF2ZXJhZ2VMZXZlbDogMCxcbiAgICAgIG1heExldmVsOiAwLFxuICAgICAgbWF4QmFzZXNBbGxvd2VkOiA1LFxuICAgICAgY2FuQ3JlYXRlTW9yZTogdHJ1ZSxcbiAgICAgIG9sZGVzdEJhc2U6IG51bGwsXG4gICAgICBuZXdlc3RCYXNlOiBudWxsXG4gICAgfTtcbiAgfVxufSJdfQ==
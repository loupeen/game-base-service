import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
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
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

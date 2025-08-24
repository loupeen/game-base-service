import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
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
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * Create Base Handler
 *
 * Implements base creation following SOLID principles:
 * - Single Responsibility: Only handles base creation logic
 * - Open/Closed: Extensible for new base types via templates
 * - Liskov Substitution: All base types follow same creation pattern
 * - Interface Segregation: Clear separation of creation concerns
 * - Dependency Inversion: Depends on shared utilities and abstractions
 *
 * Game Logic:
 * - Validates player can create new base (subscription limits)
 * - Finds optimal spawn location if not provided
 * - Creates base from template with proper stats
 * - Handles coordinate validation and map sectioning
 * - Implements building time mechanics
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

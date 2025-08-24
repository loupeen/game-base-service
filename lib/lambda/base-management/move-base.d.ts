import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * Move Base Handler
 *
 * Implements base movement system following SOLID principles:
 * - Single Responsibility: Only handles base relocation
 * - Open/Closed: Extensible for different movement types
 * - Liskov Substitution: All movement types follow same pattern
 * - Interface Segregation: Clear movement operation interface
 * - Dependency Inversion: Depends on shared game utilities
 *
 * Game Mechanics:
 * - Validates movement cooldown (60 minutes default)
 * - Supports instant teleportation for gold cost
 * - Prevents movement to occupied coordinates
 * - Calculates travel time based on distance
 * - Updates map sectioning for efficient queries
 * - Implements movement restrictions near enemy bases
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

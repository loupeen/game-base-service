import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
/**
 * Upgrade Base Handler
 *
 * Implements base upgrade system following SOLID principles:
 * - Single Responsibility: Only handles base upgrades
 * - Open/Closed: Extensible for new upgrade types
 * - Liskov Substitution: All upgrade types follow same pattern
 * - Interface Segregation: Clear upgrade operation interfaces
 * - Dependency Inversion: Depends on shared abstractions
 *
 * Game Mechanics:
 * - Validates upgrade requirements (resources, level, time)
 * - Supports instant upgrades for premium players (gold cost)
 * - Tracks upgrade progress with completion times
 * - Updates base stats upon completion
 * - Implements upgrade queue system
 */
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

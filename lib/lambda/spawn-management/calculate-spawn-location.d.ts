import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
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
export declare const handler: (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

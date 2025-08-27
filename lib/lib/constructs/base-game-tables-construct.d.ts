import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { GameBaseServiceConfig } from '../config/environment-config';
export interface BaseGameTablesConstructProps {
    environment: string;
    config: GameBaseServiceConfig;
}
/**
 * Base Game Tables Construct
 *
 * Implements DynamoDB tables for the base building domain following SOLID principles:
 * - Single Responsibility: Only manages base-related data storage
 * - Open/Closed: Easy to extend with new table types
 * - Interface Segregation: Each table serves a specific purpose
 * - Dependency Inversion: Depends on configuration abstraction
 *
 * Tables Created:
 * - PlayerBases: Individual player base instances
 * - BaseTemplates: Base building templates and upgrade paths
 * - SpawnLocations: New player spawn location management
 * - BaseUpgrades: Base upgrade progression and requirements
 */
export declare class BaseGameTablesConstruct extends Construct {
    readonly playerBasesTable: dynamodb.Table;
    readonly baseTemplatesTable: dynamodb.Table;
    readonly spawnLocationsTable: dynamodb.Table;
    readonly baseUpgradesTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props: BaseGameTablesConstructProps);
    private createPlayerBasesTable;
    private createBaseTemplatesTable;
    private createSpawnLocationsTable;
    private createBaseUpgradesTable;
    /**
     * Create seeder for base templates table using shared construct
     */
    private createBaseTemplatesSeeder;
}

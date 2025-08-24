import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GameBaseServiceConfig } from './config/environment-config';
import { BaseGameTablesConstruct } from './constructs/base-game-tables-construct';
import { BaseGameLambdasConstruct } from './constructs/base-game-lambdas-construct';
import { BaseGameApisConstruct } from './constructs/base-game-apis-construct';
import { BaseGameMonitoringConstruct } from './constructs/base-game-monitoring-construct';
export interface GameBaseServiceStackProps extends cdk.StackProps {
    environment: string;
}
/**
 * Game Base Service Stack
 *
 * Implements the base building and management domain for Loupeen RTS Platform.
 * Follows SOLID principles with clear separation of concerns:
 * - Single Responsibility: Only handles base-related functionality
 * - Open/Closed: Extensible for new base types without modification
 * - Liskov Substitution: All base operations implement common interfaces
 * - Interface Segregation: Separate interfaces for different base operations
 * - Dependency Inversion: Depends on shared abstractions
 *
 * Domain Responsibilities:
 * - Player base creation and management
 * - Base building and upgrades
 * - Base movement and relocation
 * - Spawn location calculation
 * - Territory-based base effects
 */
export declare class GameBaseServiceStack extends cdk.Stack {
    readonly config: GameBaseServiceConfig;
    readonly tablesConstruct: BaseGameTablesConstruct;
    readonly lambdasConstruct: BaseGameLambdasConstruct;
    readonly apisConstruct: BaseGameApisConstruct;
    readonly monitoringConstruct: BaseGameMonitoringConstruct;
    constructor(scope: Construct, id: string, props: GameBaseServiceStackProps);
    private createOutputs;
}

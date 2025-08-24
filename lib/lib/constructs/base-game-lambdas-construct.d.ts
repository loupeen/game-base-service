import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { GameBaseServiceConfig } from '../config/environment-config';
export interface BaseGameLambdasConstructProps {
    environment: string;
    config: GameBaseServiceConfig;
    tables: {
        playerBases: dynamodb.Table;
        baseTemplates: dynamodb.Table;
        spawnLocations: dynamodb.Table;
        baseUpgrades: dynamodb.Table;
    };
}
/**
 * Base Game Lambdas Construct
 *
 * Implements Lambda functions for base building domain following SOLID principles:
 * - Single Responsibility: Each Lambda has one specific base-related function
 * - Open/Closed: Easy to add new base operations without modifying existing ones
 * - Liskov Substitution: All base operations follow common patterns
 * - Interface Segregation: Separate functions for different base operations
 * - Dependency Inversion: Functions depend on shared utilities and abstractions
 *
 * Lambda Functions:
 * - createBase: Create new player base
 * - upgradeBase: Upgrade existing base
 * - moveBase: Relocate base to new location
 * - listBases: List player's bases
 * - getBaseDetails: Get detailed base information
 * - calculateSpawnLocation: Find optimal spawn location for new players
 */
export declare class BaseGameLambdasConstruct extends Construct {
    readonly createBaseFunction: NodejsFunction;
    readonly upgradeBaseFunction: NodejsFunction;
    readonly moveBaseFunction: NodejsFunction;
    readonly listBasesFunction: NodejsFunction;
    readonly getBaseDetailsFunction: NodejsFunction;
    readonly calculateSpawnLocationFunction: NodejsFunction;
    constructor(scope: Construct, id: string, props: BaseGameLambdasConstructProps);
    private grantTablePermissions;
}

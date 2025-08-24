import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { getGameBaseServiceConfig, GameBaseServiceConfig } from './config/environment-config';
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
export class GameBaseServiceStack extends cdk.Stack {
  public readonly config: GameBaseServiceConfig;
  public readonly tablesConstruct: BaseGameTablesConstruct;
  public readonly lambdasConstruct: BaseGameLambdasConstruct;
  public readonly apisConstruct: BaseGameApisConstruct;
  public readonly monitoringConstruct: BaseGameMonitoringConstruct;

  constructor(scope: Construct, id: string, props: GameBaseServiceStackProps) {
    super(scope, id, props);

    // Load environment-specific configuration
    this.config = getGameBaseServiceConfig(props.environment);

    // Create domain tables following Single Responsibility
    this.tablesConstruct = new BaseGameTablesConstruct(this, 'Tables', {
      environment: props.environment,
      config: this.config
    });

    // Create domain lambdas following Interface Segregation
    this.lambdasConstruct = new BaseGameLambdasConstruct(this, 'Lambdas', {
      environment: props.environment,
      config: this.config,
      tables: {
        playerBases: this.tablesConstruct.playerBasesTable,
        baseTemplates: this.tablesConstruct.baseTemplatesTable,
        spawnLocations: this.tablesConstruct.spawnLocationsTable,
        baseUpgrades: this.tablesConstruct.baseUpgradesTable
      }
    });

    // Create domain APIs following Open/Closed principle
    this.apisConstruct = new BaseGameApisConstruct(this, 'Apis', {
      environment: props.environment,
      config: this.config,
      lambdas: {
        createBase: this.lambdasConstruct.createBaseFunction,
        upgradeBase: this.lambdasConstruct.upgradeBaseFunction,
        moveBase: this.lambdasConstruct.moveBaseFunction,
        listBases: this.lambdasConstruct.listBasesFunction,
        getBaseDetails: this.lambdasConstruct.getBaseDetailsFunction,
        calculateSpawnLocation: this.lambdasConstruct.calculateSpawnLocationFunction
      }
    });

    // Create monitoring following Dependency Inversion
    this.monitoringConstruct = new BaseGameMonitoringConstruct(this, 'Monitoring', {
      environment: props.environment,
      config: this.config,
      lambdas: [
        this.lambdasConstruct.createBaseFunction,
        this.lambdasConstruct.upgradeBaseFunction,
        this.lambdasConstruct.moveBaseFunction,
        this.lambdasConstruct.listBasesFunction,
        this.lambdasConstruct.getBaseDetailsFunction,
        this.lambdasConstruct.calculateSpawnLocationFunction
      ],
      api: this.apisConstruct.api
    });

    // Output important values for integration
    this.createOutputs();
  }

  private createOutputs(): void {
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.apisConstruct.api.url,
      description: 'Game Base Service API endpoint',
      exportName: `GameBaseService-${this.config.environment}-ApiEndpoint`
    });

    new cdk.CfnOutput(this, 'PlayerBasesTableName', {
      value: this.tablesConstruct.playerBasesTable.tableName,
      description: 'Player Bases DynamoDB table name',
      exportName: `GameBaseService-${this.config.environment}-PlayerBasesTable`
    });

    new cdk.CfnOutput(this, 'BaseTemplatesTableName', {
      value: this.tablesConstruct.baseTemplatesTable.tableName,
      description: 'Base Templates DynamoDB table name',
      exportName: `GameBaseService-${this.config.environment}-BaseTemplatesTable`
    });

    new cdk.CfnOutput(this, 'SpawnLocationsTableName', {
      value: this.tablesConstruct.spawnLocationsTable.tableName,
      description: 'Spawn Locations DynamoDB table name',
      exportName: `GameBaseService-${this.config.environment}-SpawnLocationsTable`
    });
  }
}
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
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
export class BaseGameLambdasConstruct extends Construct {
  public readonly createBaseFunction: NodejsFunction;
  public readonly upgradeBaseFunction: NodejsFunction;
  public readonly moveBaseFunction: NodejsFunction;
  public readonly listBasesFunction: NodejsFunction;
  public readonly getBaseDetailsFunction: NodejsFunction;
  public readonly calculateSpawnLocationFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: BaseGameLambdasConstructProps) {
    super(scope, id);

    const { environment, config, tables } = props;

    // Common Lambda configuration following cost optimization patterns
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64, // 20% cost savings
      timeout: cdk.Duration.seconds(config.lambda.timeout),
      memorySize: config.lambda.memorySize,
      environment: {
        ENVIRONMENT: environment,
        PLAYER_BASES_TABLE: tables.playerBases.tableName,
        BASE_TEMPLATES_TABLE: tables.baseTemplates.tableName,
        SPAWN_LOCATIONS_TABLE: tables.spawnLocations.tableName,
        BASE_UPGRADES_TABLE: tables.baseUpgrades.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1' // Performance optimization
      },
      bundling: {
        minify: true,
        target: 'es2020',
        keepNames: true,
        externalModules: ['aws-sdk'] // Use Lambda runtime version
      },
      tracing: config.monitoring.enableXRayTracing ? lambda.Tracing.ACTIVE : lambda.Tracing.DISABLED,
      logRetention: logs.RetentionDays.ONE_WEEK
    };

    // Create Base Function - Handle new base creation
    this.createBaseFunction = new NodejsFunction(this, 'CreateBaseFunction', {
      ...commonLambdaProps,
      entry: 'lambda/base-management/create-base.ts',
      handler: 'handler',
      description: 'Creates new player base with spawn location calculation and resource allocation',
      functionName: `game-base-create-${environment}`
    });

    // Upgrade Base Function - Handle base upgrades and improvements
    this.upgradeBaseFunction = new NodejsFunction(this, 'UpgradeBaseFunction', {
      ...commonLambdaProps,
      entry: 'lambda/base-management/upgrade-base.ts',
      handler: 'handler',
      description: 'Processes base upgrades, validates requirements, and updates base statistics',
      functionName: `game-base-upgrade-${environment}`
    });

    // Move Base Function - Handle base relocation
    this.moveBaseFunction = new NodejsFunction(this, 'MoveBaseFunction', {
      ...commonLambdaProps,
      entry: 'lambda/base-management/move-base.ts',
      handler: 'handler',
      description: 'Relocates player base with cooldown and teleport cost validation',
      functionName: `game-base-move-${environment}`
    });

    // List Bases Function - Retrieve player's bases
    this.listBasesFunction = new NodejsFunction(this, 'ListBasesFunction', {
      ...commonLambdaProps,
      entry: 'lambda/base-queries/list-bases.ts',
      handler: 'handler',
      description: 'Returns paginated list of player bases with summary information',
      functionName: `game-base-list-${environment}`
    });

    // Get Base Details Function - Detailed base information
    this.getBaseDetailsFunction = new NodejsFunction(this, 'GetBaseDetailsFunction', {
      ...commonLambdaProps,
      entry: 'lambda/base-queries/get-base-details.ts',
      handler: 'handler',
      description: 'Returns detailed information about specific player base',
      functionName: `game-base-details-${environment}`
    });

    // Calculate Spawn Location Function - New player spawn logic
    this.calculateSpawnLocationFunction = new NodejsFunction(this, 'CalculateSpawnLocationFunction', {
      ...commonLambdaProps,
      entry: 'lambda/spawn-management/calculate-spawn-location.ts',
      handler: 'handler',
      description: 'Calculates optimal spawn location for new players based on population density',
      functionName: `game-base-spawn-${environment}`
    });

    // Grant DynamoDB permissions following principle of least privilege
    this.grantTablePermissions(tables);
  }

  private grantTablePermissions(tables: {
    playerBases: dynamodb.Table;
    baseTemplates: dynamodb.Table;
    spawnLocations: dynamodb.Table;
    baseUpgrades: dynamodb.Table;
  }): void {
    const lambdaFunctions = [
      this.createBaseFunction,
      this.upgradeBaseFunction,
      this.moveBaseFunction,
      this.listBasesFunction,
      this.getBaseDetailsFunction,
      this.calculateSpawnLocationFunction
    ];

    // Grant table access to all functions
    lambdaFunctions.forEach(func => {
      // Player Bases table - full access for base management
      tables.playerBases.grantReadWriteData(func);
      
      // Base Templates table - read-only for template data
      tables.baseTemplates.grantReadData(func);
      
      // Spawn Locations table - read/write for spawn management
      tables.spawnLocations.grantReadWriteData(func);
      
      // Base Upgrades table - read/write for upgrade tracking
      tables.baseUpgrades.grantReadWriteData(func);
    });

    // Grant additional permissions for Cedar authorization integration
    lambdaFunctions.forEach(func => {
      func.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        resources: ['*']
      }));

      // XRay permissions if tracing is enabled
      if (this.node.tryGetContext('enableXRayTracing') !== false) {
        func.addToRolePolicy(new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'xray:PutTraceSegments',
            'xray:PutTelemetryRecords'
          ],
          resources: ['*']
        }));
      }
    });
  }
}
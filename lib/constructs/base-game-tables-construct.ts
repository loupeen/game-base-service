import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as path from 'path';
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
export class BaseGameTablesConstruct extends Construct {
  public readonly playerBasesTable: dynamodb.Table;
  public readonly baseTemplatesTable: dynamodb.Table;
  public readonly spawnLocationsTable: dynamodb.Table;
  public readonly baseUpgradesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: BaseGameTablesConstructProps) {
    super(scope, id);

    const { environment, config } = props;

    // Player Bases Table - Core player base data
    this.playerBasesTable = this.createPlayerBasesTable(environment, config);

    // Base Templates Table - Base building templates and configurations
    this.baseTemplatesTable = this.createBaseTemplatesTable(environment, config);

    // Spawn Locations Table - New player spawn location management
    this.spawnLocationsTable = this.createSpawnLocationsTable(environment, config);

    // Base Upgrades Table - Base upgrade progression tracking
    this.baseUpgradesTable = this.createBaseUpgradesTable(environment, config);

    // Seed base templates table with initial data
    this.createBaseTemplatesSeeder(environment, config);
  }

  private createPlayerBasesTable(environment: string, config: GameBaseServiceConfig): dynamodb.Table {
    const table = new dynamodb.Table(this, 'PlayerBasesTable', {
      tableName: `game-base-player-bases-${environment}`,
      partitionKey: {
        name: 'playerId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'baseId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: config.dynamodb.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.dynamodb.pointInTimeRecovery,
      deletionProtection: config.dynamodb.deletionProtection,
      removalPolicy: environment === 'production' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // Add Global Secondary Indexes
    table.addGlobalSecondaryIndex({
      indexName: 'LocationIndex',
      partitionKey: {
        name: 'mapSectionId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'coordinateHash',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    table.addGlobalSecondaryIndex({
      indexName: 'AllianceIndex',
      partitionKey: {
        name: 'allianceId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    table.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'lastActiveAt',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY
    });

    return table;
  }

  private createBaseTemplatesTable(environment: string, config: GameBaseServiceConfig): dynamodb.Table {
    const table = new dynamodb.Table(this, 'BaseTemplatesTable', {
      tableName: `game-base-templates-${environment}`,
      partitionKey: {
        name: 'templateId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: config.dynamodb.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.dynamodb.pointInTimeRecovery,
      deletionProtection: config.dynamodb.deletionProtection,
      removalPolicy: environment === 'production' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY
    });

    // Add GSI for querying by base type and level
    table.addGlobalSecondaryIndex({
      indexName: 'TypeLevelIndex',
      partitionKey: {
        name: 'baseType',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'level',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    return table;
  }

  private createSpawnLocationsTable(environment: string, config: GameBaseServiceConfig): dynamodb.Table {
    const table = new dynamodb.Table(this, 'SpawnLocationsTable', {
      tableName: `game-base-spawn-locations-${environment}`,
      partitionKey: {
        name: 'spawnRegionId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'spawnLocationId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: config.dynamodb.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.dynamodb.pointInTimeRecovery,
      deletionProtection: config.dynamodb.deletionProtection,
      removalPolicy: environment === 'production' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,

      // TTL for temporary spawn reservations
      timeToLiveAttribute: 'ttl'
    });

    // Add GSI for querying available spawn locations
    table.addGlobalSecondaryIndex({
      indexName: 'AvailabilityIndex',
      partitionKey: {
        name: 'isAvailable',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'lastUsedAt',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    return table;
  }

  private createBaseUpgradesTable(environment: string, config: GameBaseServiceConfig): dynamodb.Table {
    const table = new dynamodb.Table(this, 'BaseUpgradesTable', {
      tableName: `game-base-upgrades-${environment}`,
      partitionKey: {
        name: 'playerId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'upgradeId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: config.dynamodb.billingMode === 'PAY_PER_REQUEST' 
        ? dynamodb.BillingMode.PAY_PER_REQUEST 
        : dynamodb.BillingMode.PROVISIONED,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: config.dynamodb.pointInTimeRecovery,
      deletionProtection: config.dynamodb.deletionProtection,
      removalPolicy: environment === 'production' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,

      // TTL for completed upgrades cleanup
      timeToLiveAttribute: 'ttl'
    });

    // Add GSI for querying active upgrades
    table.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'completionTime',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    table.addGlobalSecondaryIndex({
      indexName: 'BaseIndex',
      partitionKey: {
        name: 'baseId',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'startedAt',
        type: dynamodb.AttributeType.NUMBER
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    return table;
  }

  /**
   * Create custom resource to seed base templates table with initial data
   */
  private createBaseTemplatesSeeder(environment: string, config: GameBaseServiceConfig): void {
    // Create Lambda function for seeding base templates
    const seedFunction = new lambda.Function(this, 'BaseTemplatesSeederFunction', {
      functionName: `game-base-seed-templates-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64, // Consistent with other Lambda functions
      handler: 'seed-base-templates.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/seed-data')),
      timeout: cdk.Duration.minutes(5),
      environment: {
        BASE_TEMPLATES_TABLE: this.baseTemplatesTable.tableName,
        NODE_OPTIONS: '--enable-source-maps'
      }
    });

    // Grant the Lambda function permissions to read/write the base templates table
    this.baseTemplatesTable.grantReadWriteData(seedFunction);

    // Create the custom resource
    const seedProvider = new cr.Provider(this, 'BaseTemplatesSeederProvider', {
      onEventHandler: seedFunction,
      logRetention: 30, // 30 days log retention
      providerFunctionName: `game-base-seed-provider-${environment}`
    });

    // Create custom resource that triggers the seeding
    const seedResource = new cdk.CustomResource(this, 'BaseTemplatesSeederResource', {
      serviceToken: seedProvider.serviceToken,
      properties: {
        // Change this value to trigger re-seeding during updates
        SeedVersion: '1.0.0',
        Environment: environment,
        TableName: this.baseTemplatesTable.tableName
      }
    });

    // Ensure seeding happens after table is ready
    seedResource.node.addDependency(this.baseTemplatesTable);
  }
}
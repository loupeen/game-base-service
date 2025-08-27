"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseGameTablesConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const cr = __importStar(require("aws-cdk-lib/custom-resources"));
const path = __importStar(require("path"));
const constructs_1 = require("constructs");
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
class BaseGameTablesConstruct extends constructs_1.Construct {
    playerBasesTable;
    baseTemplatesTable;
    spawnLocationsTable;
    baseUpgradesTable;
    constructor(scope, id, props) {
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
    createPlayerBasesTable(environment, config) {
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
    createBaseTemplatesTable(environment, config) {
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
    createSpawnLocationsTable(environment, config) {
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
    createBaseUpgradesTable(environment, config) {
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
    createBaseTemplatesSeeder(environment, config) {
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
exports.BaseGameTablesConstruct = BaseGameTablesConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1nYW1lLXRhYmxlcy1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9jb25zdHJ1Y3RzL2Jhc2UtZ2FtZS10YWJsZXMtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBRWpELGlFQUFtRDtBQUNuRCwyQ0FBNkI7QUFDN0IsMkNBQXVDO0FBUXZDOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0gsTUFBYSx1QkFBd0IsU0FBUSxzQkFBUztJQUNwQyxnQkFBZ0IsQ0FBaUI7SUFDakMsa0JBQWtCLENBQWlCO0lBQ25DLG1CQUFtQixDQUFpQjtJQUNwQyxpQkFBaUIsQ0FBaUI7SUFFbEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFtQztRQUMzRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXRDLDZDQUE2QztRQUM3QyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUV6RSxvRUFBb0U7UUFDcEUsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFN0UsK0RBQStEO1FBQy9ELElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUMseUJBQXlCLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRS9FLDBEQUEwRDtRQUMxRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUzRSw4Q0FBOEM7UUFDOUMsSUFBSSxD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Q0FBQyxrQkFBa0IsQ0FBQyxTQUFTO2dCQUN2RCxZQUFZLEVBQUUsc0JBQXNCO2FBQ3JDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsK0VBQStFO1FBQy9FLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUV6RCw2QkFBNkI7UUFDN0IsTUFBTSxZQUFZLEdBQUcsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUN4RSxjQUFjLEVBQUUsWUFBWTtZQUM1QixZQUFZLEVBQUUsRUFBRSxFQUFFLHdCQUF3QjtZQUMxQyxvQkFBb0IsRUFBRSwyQkFBMkIsV0FBVyxFQUFFO1NBQy9ELENBQUMsQ0FBQztRQUVILG1EQUFtRDtRQUNuRCxNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLDZCQUE2QixFQUFFO1lBQy9FLFlBQVksRUFBRSxZQUFZLENBQUMsWUFBWTtZQUN2QyxVQUFVLEVBQUU7Z0JBQ1YseURBQXlEO2dCQUN6RCxXQUFXLEVBQUUsT0FBTztnQkFDcEIsV0FBVyxFQUFFLFdBQVc7Z0JBQ3hCLFNBQVMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsU0FBUzthQUM3QztTQUNGLENBQUMsQ0FBQztRQUVILDhDQUE4QztRQUM5QyxZQUFZLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQUMzRCxDQUFDO0NBQ0Y7QUExUUQsMERBMFFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBjciBmcm9tICdhd3MtY2RrLWxpYi9jdXN0b20tcmVzb3VyY2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IEdhbWVCYXNlU2VydmljZUNvbmZpZyB9IGZyb20gJy4uL2NvbmZpZy9lbnZpcm9ubWVudC1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJhc2VHYW1lVGFibGVzQ29uc3RydWN0UHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZztcbn1cblxuLyoqXG4gKiBCYXNlIEdhbWUgVGFibGVzIENvbnN0cnVjdFxuICogXG4gKiBJbXBsZW1lbnRzIER5bmFtb0RCIHRhYmxlcyBmb3IgdGhlIGJhc2UgYnVpbGRpbmcgZG9tYWluIGZvbGxvd2luZyBTT0xJRCBwcmluY2lwbGVzOlxuICogLSBTaW5nbGUgUmVzcG9uc2liaWxpdHk6IE9ubHkgbWFuYWdlcyBiYXNlLXJlbGF0ZWQgZGF0YSBzdG9yYWdlXG4gKiAtIE9wZW4vQ2xvc2VkOiBFYXN5IHRvIGV4dGVuZCB3aXRoIG5ldyB0YWJsZSB0eXBlc1xuICogLSBJbnRlcmZhY2UgU2VncmVnYXRpb246IEVhY2ggdGFibGUgc2VydmVzIGEgc3BlY2lmaWMgcHVycG9zZVxuICogLSBEZXBlbmRlbmN5IEludmVyc2lvbjogRGVwZW5kcyBvbiBjb25maWd1cmF0aW9uIGFic3RyYWN0aW9uXG4gKiBcbiAqIFRhYmxlcyBDcmVhdGVkOlxuICogLSBQbGF5ZXJCYXNlczogSW5kaXZpZHVhbCBwbGF5ZXIgYmFzZSBpbnN0YW5jZXNcbiAqIC0gQmFzZVRlbXBsYXRlczogQmFzZSBidWlsZGluZyB0ZW1wbGF0ZXMgYW5kIHVwZ3JhZGUgcGF0aHNcbiAqIC0gU3Bhd25Mb2NhdGlvbnM6IE5ldyBwbGF5ZXIgc3Bhd24gbG9jYXRpb24gbWFuYWdlbWVudFxuICogLSBCYXNlVXBncmFkZXM6IEJhc2UgdXBncmFkZSBwcm9ncmVzc2lvbiBhbmQgcmVxdWlyZW1lbnRzXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXNlR2FtZVRhYmxlc0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBwbGF5ZXJCYXNlc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGJhc2VUZW1wbGF0ZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBzcGF3bkxvY2F0aW9uc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IGJhc2VVcGdyYWRlc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmFzZUdhbWVUYWJsZXNDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB7IGVudmlyb25tZW50LCBjb25maWcgfSA9IHByb3BzO1xuXG4gICAgLy8gUGxheWVyIEJhc2VzIFRhYmxlIC0gQ29yZSBwbGF5ZXIgYmFzZSBkYXRhXG4gICAgdGhpcy5wbGF5ZXJCYXNlc1RhYmxlID0gdGhpcy5jcmVhdGVQbGF5ZXJCYXNlc1RhYmxlKGVudmlyb25tZW50LCBjb25maWcpO1xuXG4gICAgLy8gQmFzZSBUZW1wbGF0ZXMgVGFibGUgLSBCYXNlIGJ1aWxkaW5nIHRlbXBsYXRlcyBhbmQgY29uZmlndXJhdGlvbnNcbiAgICB0aGlzLmJhc2VUZW1wbGF0ZXNUYWJsZSA9IHRoaXMuY3JlYXRlQmFzZVRlbXBsYXRlc1RhYmxlKGVudmlyb25tZW50LCBjb25maWcpO1xuXG4gICAgLy8gU3Bhd24gTG9jYXRpb25zIFRhYmxlIC0gTmV3IHBsYXllciBzcGF3biBsb2NhdGlvbiBtYW5hZ2VtZW50XG4gICAgdGhpcy5zcGF3bkxvY2F0aW9uc1RhYmxlID0gdGhpcy5jcmVhdGVTcGF3bkxvY2F0aW9uc1RhYmxlKGVudmlyb25tZW50LCBjb25maWcpO1xuXG4gICAgLy8gQmFzZSBVcGdyYWRlcyBUYWJsZSAtIEJhc2UgdXBncmFkZSBwcm9ncmVzc2lvbiB0cmFja2luZ1xuICAgIHRoaXMuYmFzZVVwZ3JhZGVzVGFibGUgPSB0aGlzLmNyZWF0ZUJhc2VVcGdyYWRlc1RhYmxlKGVudmlyb25tZW50LCBjb25maWcpO1xuXG4gICAgLy8gU2VlZCBiYXNlIHRlbXBsYXRlcyB0YWJsZSB3aXRoIGluaXRpYWwgZGF0YVxuICAgIHRoaXMuY3JlYXRlQmFzZVRlbXBsYXRlc1NlZWRlcihlbnZpcm9ubWVudCwgY29uZmlnKTtcbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlUGxheWVyQmFzZXNUYWJsZShlbnZpcm9ubWVudDogc3RyaW5nLCBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZyk6IGR5bmFtb2RiLlRhYmxlIHtcbiAgICBjb25zdCB0YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUGxheWVyQmFzZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGdhbWUtYmFzZS1wbGF5ZXItYmFzZXMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdwbGF5ZXJJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnYmFzZUlkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogY29uZmlnLmR5bmFtb2RiLmJpbGxpbmdNb2RlID09PSAnUEFZX1BFUl9SRVFVRVNUJyBcbiAgICAgICAgPyBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QgXG4gICAgICAgIDogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBjb25maWcuZHluYW1vZGIucG9pbnRJblRpbWVSZWNvdmVyeSxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogY29uZmlnLmR5bmFtb2RiLmRlbGV0aW9uUHJvdGVjdGlvbixcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHbG9iYWwgU2Vjb25kYXJ5IEluZGV4ZXNcbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdMb2NhdGlvbkluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnbWFwU2VjdGlvbklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjb29yZGluYXRlSGFzaCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnQWxsaWFuY2VJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2FsbGlhbmNlSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2NyZWF0ZWRBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnU3RhdHVzSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdzdGF0dXMnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2xhc3RBY3RpdmVBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLktFWVNfT05MWVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRhYmxlO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVCYXNlVGVtcGxhdGVzVGFibGUoZW52aXJvbm1lbnQ6IHN0cmluZywgY29uZmlnOiBHYW1lQmFzZVNlcnZpY2VDb25maWcpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgY29uc3QgdGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0Jhc2VUZW1wbGF0ZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGdhbWUtYmFzZS10ZW1wbGF0ZXMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd0ZW1wbGF0ZUlkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogY29uZmlnLmR5bmFtb2RiLmJpbGxpbmdNb2RlID09PSAnUEFZX1BFUl9SRVFVRVNUJyBcbiAgICAgICAgPyBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QgXG4gICAgICAgIDogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBjb25maWcuZHluYW1vZGIucG9pbnRJblRpbWVSZWNvdmVyeSxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogY29uZmlnLmR5bmFtb2RiLmRlbGV0aW9uUHJvdGVjdGlvbixcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1lcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGJ5IGJhc2UgdHlwZSBhbmQgbGV2ZWxcbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdUeXBlTGV2ZWxJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2Jhc2VUeXBlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdsZXZlbCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRhYmxlO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTcGF3bkxvY2F0aW9uc1RhYmxlKGVudmlyb25tZW50OiBzdHJpbmcsIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogZHluYW1vZGIuVGFibGUge1xuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTcGF3bkxvY2F0aW9uc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgZ2FtZS1iYXNlLXNwYXduLWxvY2F0aW9ucy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3NwYXduUmVnaW9uSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ3NwYXduTG9jYXRpb25JZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgYmlsbGluZ01vZGU6IGNvbmZpZy5keW5hbW9kYi5iaWxsaW5nTW9kZSA9PT0gJ1BBWV9QRVJfUkVRVUVTVCcgXG4gICAgICAgID8gZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNUIFxuICAgICAgICA6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBST1ZJU0lPTkVELFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogY29uZmlnLmR5bmFtb2RiLnBvaW50SW5UaW1lUmVjb3ZlcnksXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGNvbmZpZy5keW5hbW9kYi5kZWxldGlvblByb3RlY3Rpb24sXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nIFxuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiBcbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuXG4gICAgICAvLyBUVEwgZm9yIHRlbXBvcmFyeSBzcGF3biByZXNlcnZhdGlvbnNcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBxdWVyeWluZyBhdmFpbGFibGUgc3Bhd24gbG9jYXRpb25zXG4gICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnQXZhaWxhYmlsaXR5SW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdpc0F2YWlsYWJsZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnbGFzdFVzZWRBdCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRhYmxlO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVCYXNlVXBncmFkZXNUYWJsZShlbnZpcm9ubWVudDogc3RyaW5nLCBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZyk6IGR5bmFtb2RiLlRhYmxlIHtcbiAgICBjb25zdCB0YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQmFzZVVwZ3JhZGVzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGBnYW1lLWJhc2UtdXBncmFkZXMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdwbGF5ZXJJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAndXBncmFkZUlkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogY29uZmlnLmR5bmFtb2RiLmJpbGxpbmdNb2RlID09PSAnUEFZX1BFUl9SRVFVRVNUJyBcbiAgICAgICAgPyBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QgXG4gICAgICAgIDogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBjb25maWcuZHluYW1vZGIucG9pbnRJblRpbWVSZWNvdmVyeSxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogY29uZmlnLmR5bmFtb2RiLmRlbGV0aW9uUHJvdGVjdGlvbixcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG5cbiAgICAgIC8vIFRUTCBmb3IgY29tcGxldGVkIHVwZ3JhZGVzIGNsZWFudXBcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBxdWVyeWluZyBhY3RpdmUgdXBncmFkZXNcbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTdGF0dXNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3N0YXR1cycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY29tcGxldGlvblRpbWUnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0Jhc2VJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2Jhc2VJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnc3RhcnRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGFibGU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGN1c3RvbSByZXNvdXJjZSB0byBzZWVkIGJhc2UgdGVtcGxhdGVzIHRhYmxlIHdpdGggaW5pdGlhbCBkYXRhXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJhc2VUZW1wbGF0ZXNTZWVkZXIoZW52aXJvbm1lbnQ6IHN0cmluZywgY29uZmlnOiBHYW1lQmFzZVNlcnZpY2VDb25maWcpOiB2b2lkIHtcbiAgICAvLyBDcmVhdGUgTGFtYmRhIGZ1bmN0aW9uIGZvciBzZWVkaW5nIGJhc2UgdGVtcGxhdGVzXG4gICAgY29uc3Qgc2VlZEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQmFzZVRlbXBsYXRlc1NlZWRlckZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiBgZ2FtZS1iYXNlLXNlZWQtdGVtcGxhdGVzLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18yMF9YLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLlg4Nl82NCwgLy8gQ29uc2lzdGVudCB3aXRoIG90aGVyIExhbWJkYSBmdW5jdGlvbnNcbiAgICAgIGhhbmRsZXI6ICdzZWVkLWJhc2UtdGVtcGxhdGVzLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9sYW1iZGEvc2VlZC1kYXRhJykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBCQVNFX1RFTVBMQVRFU19UQUJMRTogdGhpcy5iYXNlVGVtcGxhdGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBOT0RFX09QVElPTlM6ICctLWVuYWJsZS1zb3VyY2UtbWFwcydcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHRoZSBMYW1iZGEgZnVuY3Rpb24gcGVybWlzc2lvbnMgdG8gcmVhZC93cml0ZSB0aGUgYmFzZSB0ZW1wbGF0ZXMgdGFibGVcbiAgICB0aGlzLmJhc2VUZW1wbGF0ZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoc2VlZEZ1bmN0aW9uKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgY3VzdG9tIHJlc291cmNlXG4gICAgY29uc3Qgc2VlZFByb3ZpZGVyID0gbmV3IGNyLlByb3ZpZGVyKHRoaXMsICdCYXNlVGVtcGxhdGVzU2VlZGVyUHJvdmlkZXInLCB7XG4gICAgICBvbkV2ZW50SGFuZGxlcjogc2VlZEZ1bmN0aW9uLFxuICAgICAgbG9nUmV0ZW50aW9uOiAzMCwgLy8gMzAgZGF5cyBsb2cgcmV0ZW50aW9uXG4gICAgICBwcm92aWRlckZ1bmN0aW9uTmFtZTogYGdhbWUtYmFzZS1zZWVkLXByb3ZpZGVyLSR7ZW52aXJvbm1lbnR9YFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSByZXNvdXJjZSB0aGF0IHRyaWdnZXJzIHRoZSBzZWVkaW5nXG4gICAgY29uc3Qgc2VlZFJlc291cmNlID0gbmV3IGNkay5DdXN0b21SZXNvdXJjZSh0aGlzLCAnQmFzZVRlbXBsYXRlc1NlZWRlclJlc291cmNlJywge1xuICAgICAgc2VydmljZVRva2VuOiBzZWVkUHJvdmlkZXIuc2VydmljZVRva2VuLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAvLyBDaGFuZ2UgdGhpcyB2YWx1ZSB0byB0cmlnZ2VyIHJlLXNlZWRpbmcgZHVyaW5nIHVwZGF0ZXNcbiAgICAgICAgU2VlZFZlcnNpb246ICcxLjAuMCcsXG4gICAgICAgIEVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICAgICAgVGFibGVOYW1lOiB0aGlzLmJhc2VUZW1wbGF0ZXNUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEVuc3VyZSBzZWVkaW5nIGhhcHBlbnMgYWZ0ZXIgdGFibGUgaXMgcmVhZHlcbiAgICBzZWVkUmVzb3VyY2Uubm9kZS5hZGREZXBlbmRlbmN5KHRoaXMuYmFzZVRlbXBsYXRlc1RhYmxlKTtcbiAgfVxufSJdfQ==
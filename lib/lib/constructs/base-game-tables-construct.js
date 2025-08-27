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
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
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
        // Create Lambda function for seeding base templates using NodejsFunction for proper TypeScript bundling
        const seedFunction = new aws_lambda_nodejs_1.NodejsFunction(this, 'BaseTemplatesSeederFunction', {
            functionName: `game-base-seed-templates-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            architecture: lambda.Architecture.X86_64, // Consistent with other Lambda functions
            entry: 'lambda/seed-data/seed-base-templates.ts',
            timeout: cdk.Duration.minutes(5),
            environment: {
                BASE_TEMPLATES_TABLE: this.baseTemplatesTable.tableName,
                NODE_OPTIONS: '--enable-source-maps'
            },
            bundling: {
                minify: true,
                target: 'es2020',
                keepNames: true,
                externalModules: ['@aws-sdk/*'] // Use Lambda runtime version
            },
            logRetention: logs.RetentionDays.ONE_MONTH
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1nYW1lLXRhYmxlcy1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9jb25zdHJ1Y3RzL2Jhc2UtZ2FtZS10YWJsZXMtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQsK0RBQWlEO0FBRWpELGlFQUFtRDtBQUNuRCwyREFBNkM7QUFDN0MsMkNBQXVDO0FBQ3ZDLHFFQUErRDtBQVEvRDs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNILE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDcEMsZ0JBQWdCLENBQWlCO0lBQ2pDLGtCQUFrQixDQUFpQjtJQUNuQyxtQkFBbUIsQ0FBaUI7SUFDcEMsaUJBQWlCLENBQWlCO0lBRWxELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBbUM7UUFDM0UsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0Qyw2Q0FBNkM7UUFDN0MsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFekUsb0VBQW9FO1FBQ3BFLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTdFLCtEQUErRDtRQUMvRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUvRSwwREFBMEQ7UUFDMUQsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFM0UsOENBQThDO1FBQzlDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUVPLHNCQUFzQixDQUFDLFdBQW1CLEVBQUUsTUFBNkI7UUFDL0UsTUFBTSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUN6RCxTQUFTLEVBQUUsMEJBQTBCLFdBQVcsRUFBRTtZQUNsRCxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFVBQVU7Z0JBQ2hCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLFdBQVcsS0FBSyxpQkFBaUI7Z0JBQzVELENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7Z0JBQ3RDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVc7WUFDcEMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLG1CQUFtQjtZQUN4RCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLGtCQUFrQjtZQUN0RCxhQUFhLEVBQUUsV0FBVyxLQUFLLFlBQVk7Z0JBQ3pDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87U0FDOUIsQ0FBQyxDQUFDO1FBRUgsK0JBQStCO1FBQy9CLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUM1QixTQUFTLEVBQUUsZUFBZTtZQUMxQixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLGNBQWM7Z0JBQ3BCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLGdCQUFnQjtnQkFDdEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELGNBQWMsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUc7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLHVCQUF1QixDQUFDO1lBQzVCLFNBQVMsRUFBRSxlQUFlO1lBQzFCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELGNBQWMsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUc7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLHVCQUF1QixDQUFDO1lBQzVCLFNBQVMsRUFBRSxhQUFhO1lBQ3hCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTtnQkFDZCxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxjQUFjO2dCQUNwQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUztTQUNsRCxDQUFDLENBQUM7UUFFSCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxXQUFtQixFQUFFLE1BQTZCO1FBQ2pGLE1BQU0sS0FBSyxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDM0QsU0FBUyxFQUFFLHVCQUF1QixXQUFXLEVBQUU7WUFDL0MsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxZQUFZO2dCQUNsQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsV0FBVyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsV0FBVyxLQUFLLGlCQUFpQjtnQkFDNUQsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtnQkFDdEMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsV0FBVztZQUNwQyxVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1lBQ2hELG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsbUJBQW1CO1lBQ3hELGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsa0JBQWtCO1lBQ3RELGFBQWEsRUFBRSxXQUFXLEtBQUssWUFBWTtnQkFDekMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtnQkFDMUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUM5QixDQUFDLENBQUM7UUFFSCw4Q0FBOEM7UUFDOUMsS0FBSyxDQUFDLHVCQUF1QixDQUFDO1lBQzVCLFNBQVMsRUFBRSxnQkFBZ0I7WUFDM0IsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxVQUFVO2dCQUNoQixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksRUFBRSxPQUFPO2dCQUNiLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHO1NBQzVDLENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVPLHlCQUF5QixDQUFDLFdBQW1CLEVBQUUsTUFBNkI7UUFDbEYsTUFBTSxLQUFLLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM1RCxTQUFTLEVBQUUsNkJBQTZCLFdBQVcsRUFBRTtZQUNyRCxZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLGVBQWU7Z0JBQ3JCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLGlCQUFpQjtnQkFDdkIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLFdBQVcsS0FBSyxpQkFBaUI7Z0JBQzVELENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7Z0JBQ3RDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVc7WUFDcEMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLG1CQUFtQjtZQUN4RCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLGtCQUFrQjtZQUN0RCxhQUFhLEVBQUUsV0FBVyxLQUFLLFlBQVk7Z0JBQ3pDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFFN0IsdUNBQXVDO1lBQ3ZDLG1CQUFtQixFQUFFLEtBQUs7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUM1QixTQUFTLEVBQUUsbUJBQW1CO1lBQzlCLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsYUFBYTtnQkFDbkIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsWUFBWTtnQkFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELGNBQWMsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUc7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRU8sdUJBQXVCLENBQUMsV0FBbUIsRUFBRSxNQUE2QjtRQUNoRixNQUFNLEtBQUssR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQzFELFNBQVMsRUFBRSxzQkFBc0IsV0FBVyxFQUFFO1lBQzlDLFlBQVksRUFBRTtnQkFDWixJQUFJLEVBQUUsVUFBVTtnQkFDaEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELFdBQVcsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLFdBQVcsS0FBSyxpQkFBaUI7Z0JBQzVELENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLGVBQWU7Z0JBQ3RDLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVc7WUFDcEMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUNoRCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLG1CQUFtQjtZQUN4RCxrQkFBa0IsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLGtCQUFrQjtZQUN0RCxhQUFhLEVBQUUsV0FBVyxLQUFLLFlBQVk7Z0JBQ3pDLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFFN0IscUNBQXFDO1lBQ3JDLG1CQUFtQixFQUFFLEtBQUs7U0FDM0IsQ0FBQyxDQUFDO1FBRUgsdUNBQXVDO1FBQ3ZDLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUM1QixTQUFTLEVBQUUsYUFBYTtZQUN4QixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsZ0JBQWdCO2dCQUN0QixJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNO2FBQ3BDO1lBQ0QsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRztTQUM1QyxDQUFDLENBQUM7UUFFSCxLQUFLLENBQUMsdUJBQXVCLENBQUM7WUFDNUIsU0FBUyxFQUFFLFdBQVc7WUFDdEIsWUFBWSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHO1NBQzVDLENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0sseUJBQXlCLENBQUMsV0FBbUIsRUFBRSxNQUE2QjtRQUNsRix3R0FBd0c7UUFDeEcsTUFBTSxZQUFZLEdBQUcsSUFBSSxrQ0FBYyxDQUFDLElBQUksRUFBRSw2QkFBNkIsRUFBRTtZQUMzRSxZQUFZLEVBQUUsNEJBQTRCLFdBQVcsRUFBRTtZQUN2RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSx5Q0FBeUM7WUFDbkYsS0FBSyxFQUFFLHlDQUF5QztZQUNoRCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLFdBQVcsRUFBRTtnQkFDWCxvQkFBb0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsU0FBUztnQkFDdkQsWUFBWSxFQUFFLHNCQUFzQjthQUNyQztZQUNELFFBQVEsRUFBRTtnQkFDUixNQUFNLEVBQUUsSUFBSTtnQkFDWixNQUFNLEVBQUUsUUFBUTtnQkFDaEIsU0FBUyxFQUFFLElBQUk7Z0JBQ2YsZUFBZSxFQUFFLENBQUMsWUFBWSxDQUFDLENBQUMsNkJBQTZCO2FBQzlEO1lBQ0QsWUFBWSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUztTQUMzQyxDQUFDLENBQUM7UUFFSCwrRUFBK0U7UUFDL0UsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRXpELDZCQUE2QjtRQUM3QixNQUFNLFlBQVksR0FBRyxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLDZCQUE2QixFQUFFO1lBQ3hFLGNBQWMsRUFBRSxZQUFZO1lBQzVCLFlBQVksRUFBRSxFQUFFLEVBQUUsd0JBQXdCO1lBQzFDLG9CQUFvQixFQUFFLDJCQUEyQixXQUFXLEVBQUU7U0FDL0QsQ0FBQyxDQUFDO1FBRUgsbURBQW1EO1FBQ25ELE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsNkJBQTZCLEVBQUU7WUFDL0UsWUFBWSxFQUFFLFlBQVksQ0FBQyxZQUFZO1lBQ3ZDLFVBQVUsRUFBRTtnQkFDVix5REFBeUQ7Z0JBQ3pELFdBQVcsRUFBRSxPQUFPO2dCQUNwQixXQUFXLEVBQUUsV0FBVztnQkFDeEIsU0FBUyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTO2FBQzdDO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsOENBQThDO1FBQzlDLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQzNELENBQUM7Q0FDRjtBQWhSRCwwREFnUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGNyIGZyb20gJ2F3cy1jZGstbGliL2N1c3RvbS1yZXNvdXJjZXMnO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0IHsgR2FtZUJhc2VTZXJ2aWNlQ29uZmlnIH0gZnJvbSAnLi4vY29uZmlnL2Vudmlyb25tZW50LWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmFzZUdhbWVUYWJsZXNDb25zdHJ1Y3RQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnO1xufVxuXG4vKipcbiAqIEJhc2UgR2FtZSBUYWJsZXMgQ29uc3RydWN0XG4gKiBcbiAqIEltcGxlbWVudHMgRHluYW1vREIgdGFibGVzIGZvciB0aGUgYmFzZSBidWlsZGluZyBkb21haW4gZm9sbG93aW5nIFNPTElEIHByaW5jaXBsZXM6XG4gKiAtIFNpbmdsZSBSZXNwb25zaWJpbGl0eTogT25seSBtYW5hZ2VzIGJhc2UtcmVsYXRlZCBkYXRhIHN0b3JhZ2VcbiAqIC0gT3Blbi9DbG9zZWQ6IEVhc3kgdG8gZXh0ZW5kIHdpdGggbmV3IHRhYmxlIHR5cGVzXG4gKiAtIEludGVyZmFjZSBTZWdyZWdhdGlvbjogRWFjaCB0YWJsZSBzZXJ2ZXMgYSBzcGVjaWZpYyBwdXJwb3NlXG4gKiAtIERlcGVuZGVuY3kgSW52ZXJzaW9uOiBEZXBlbmRzIG9uIGNvbmZpZ3VyYXRpb24gYWJzdHJhY3Rpb25cbiAqIFxuICogVGFibGVzIENyZWF0ZWQ6XG4gKiAtIFBsYXllckJhc2VzOiBJbmRpdmlkdWFsIHBsYXllciBiYXNlIGluc3RhbmNlc1xuICogLSBCYXNlVGVtcGxhdGVzOiBCYXNlIGJ1aWxkaW5nIHRlbXBsYXRlcyBhbmQgdXBncmFkZSBwYXRoc1xuICogLSBTcGF3bkxvY2F0aW9uczogTmV3IHBsYXllciBzcGF3biBsb2NhdGlvbiBtYW5hZ2VtZW50XG4gKiAtIEJhc2VVcGdyYWRlczogQmFzZSB1cGdyYWRlIHByb2dyZXNzaW9uIGFuZCByZXF1aXJlbWVudHNcbiAqL1xuZXhwb3J0IGNsYXNzIEJhc2VHYW1lVGFibGVzQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IHBsYXllckJhc2VzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgYmFzZVRlbXBsYXRlc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHVibGljIHJlYWRvbmx5IHNwYXduTG9jYXRpb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgYmFzZVVwZ3JhZGVzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCYXNlR2FtZVRhYmxlc0NvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IHsgZW52aXJvbm1lbnQsIGNvbmZpZyB9ID0gcHJvcHM7XG5cbiAgICAvLyBQbGF5ZXIgQmFzZXMgVGFibGUgLSBDb3JlIHBsYXllciBiYXNlIGRhdGFcbiAgICB0aGlzLnBsYXllckJhc2VzVGFibGUgPSB0aGlzLmNyZWF0ZVBsYXllckJhc2VzVGFibGUoZW52aXJvbm1lbnQsIGNvbmZpZyk7XG5cbiAgICAvLyBCYXNlIFRlbXBsYXRlcyBUYWJsZSAtIEJhc2UgYnVpbGRpbmcgdGVtcGxhdGVzIGFuZCBjb25maWd1cmF0aW9uc1xuICAgIHRoaXMuYmFzZVRlbXBsYXRlc1RhYmxlID0gdGhpcy5jcmVhdGVCYXNlVGVtcGxhdGVzVGFibGUoZW52aXJvbm1lbnQsIGNvbmZpZyk7XG5cbiAgICAvLyBTcGF3biBMb2NhdGlvbnMgVGFibGUgLSBOZXcgcGxheWVyIHNwYXduIGxvY2F0aW9uIG1hbmFnZW1lbnRcbiAgICB0aGlzLnNwYXduTG9jYXRpb25zVGFibGUgPSB0aGlzLmNyZWF0ZVNwYXduTG9jYXRpb25zVGFibGUoZW52aXJvbm1lbnQsIGNvbmZpZyk7XG5cbiAgICAvLyBCYXNlIFVwZ3JhZGVzIFRhYmxlIC0gQmFzZSB1cGdyYWRlIHByb2dyZXNzaW9uIHRyYWNraW5nXG4gICAgdGhpcy5iYXNlVXBncmFkZXNUYWJsZSA9IHRoaXMuY3JlYXRlQmFzZVVwZ3JhZGVzVGFibGUoZW52aXJvbm1lbnQsIGNvbmZpZyk7XG5cbiAgICAvLyBTZWVkIGJhc2UgdGVtcGxhdGVzIHRhYmxlIHdpdGggaW5pdGlhbCBkYXRhXG4gICAgdGhpcy5jcmVhdGVCYXNlVGVtcGxhdGVzU2VlZGVyKGVudmlyb25tZW50LCBjb25maWcpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVQbGF5ZXJCYXNlc1RhYmxlKGVudmlyb25tZW50OiBzdHJpbmcsIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogZHluYW1vZGIuVGFibGUge1xuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQbGF5ZXJCYXNlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgZ2FtZS1iYXNlLXBsYXllci1iYXNlcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3BsYXllcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdiYXNlSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBjb25maWcuZHluYW1vZGIuYmlsbGluZ01vZGUgPT09ICdQQVlfUEVSX1JFUVVFU1QnIFxuICAgICAgICA/IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCBcbiAgICAgICAgOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGNvbmZpZy5keW5hbW9kYi5wb2ludEluVGltZVJlY292ZXJ5LFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBjb25maWcuZHluYW1vZGIuZGVsZXRpb25Qcm90ZWN0aW9uLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdsb2JhbCBTZWNvbmRhcnkgSW5kZXhlc1xuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0xvY2F0aW9uSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdtYXBTZWN0aW9uSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2Nvb3JkaW5hdGVIYXNoJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdBbGxpYW5jZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnYWxsaWFuY2VJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTdGF0dXNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3N0YXR1cycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnbGFzdEFjdGl2ZUF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuS0VZU19PTkxZXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGFibGU7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJhc2VUZW1wbGF0ZXNUYWJsZShlbnZpcm9ubWVudDogc3RyaW5nLCBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZyk6IGR5bmFtb2RiLlRhYmxlIHtcbiAgICBjb25zdCB0YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQmFzZVRlbXBsYXRlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgZ2FtZS1iYXNlLXRlbXBsYXRlcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3RlbXBsYXRlSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBjb25maWcuZHluYW1vZGIuYmlsbGluZ01vZGUgPT09ICdQQVlfUEVSX1JFUVVFU1QnIFxuICAgICAgICA/IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCBcbiAgICAgICAgOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGNvbmZpZy5keW5hbW9kYi5wb2ludEluVGltZVJlY292ZXJ5LFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBjb25maWcuZHluYW1vZGIuZGVsZXRpb25Qcm90ZWN0aW9uLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgYnkgYmFzZSB0eXBlIGFuZCBsZXZlbFxuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1R5cGVMZXZlbEluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnYmFzZVR5cGUnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2xldmVsJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGFibGU7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVNwYXduTG9jYXRpb25zVGFibGUoZW52aXJvbm1lbnQ6IHN0cmluZywgY29uZmlnOiBHYW1lQmFzZVNlcnZpY2VDb25maWcpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgY29uc3QgdGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1NwYXduTG9jYXRpb25zVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGBnYW1lLWJhc2Utc3Bhd24tbG9jYXRpb25zLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc3Bhd25SZWdpb25JZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnc3Bhd25Mb2NhdGlvbklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogY29uZmlnLmR5bmFtb2RiLmJpbGxpbmdNb2RlID09PSAnUEFZX1BFUl9SRVFVRVNUJyBcbiAgICAgICAgPyBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QgXG4gICAgICAgIDogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBjb25maWcuZHluYW1vZGIucG9pbnRJblRpbWVSZWNvdmVyeSxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogY29uZmlnLmR5bmFtb2RiLmRlbGV0aW9uUHJvdGVjdGlvbixcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG5cbiAgICAgIC8vIFRUTCBmb3IgdGVtcG9yYXJ5IHNwYXduIHJlc2VydmF0aW9uc1xuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCdcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGF2YWlsYWJsZSBzcGF3biBsb2NhdGlvbnNcbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdBdmFpbGFiaWxpdHlJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2lzQXZhaWxhYmxlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdsYXN0VXNlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGFibGU7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJhc2VVcGdyYWRlc1RhYmxlKGVudmlyb25tZW50OiBzdHJpbmcsIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogZHluYW1vZGIuVGFibGUge1xuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdCYXNlVXBncmFkZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGdhbWUtYmFzZS11cGdyYWRlcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3BsYXllcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd1cGdyYWRlSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBjb25maWcuZHluYW1vZGIuYmlsbGluZ01vZGUgPT09ICdQQVlfUEVSX1JFUVVFU1QnIFxuICAgICAgICA/IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCBcbiAgICAgICAgOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGNvbmZpZy5keW5hbW9kYi5wb2ludEluVGltZVJlY292ZXJ5LFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBjb25maWcuZHluYW1vZGIuZGVsZXRpb25Qcm90ZWN0aW9uLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcblxuICAgICAgLy8gVFRMIGZvciBjb21wbGV0ZWQgdXBncmFkZXMgY2xlYW51cFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCdcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGFjdGl2ZSB1cGdyYWRlc1xuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1N0YXR1c0luZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc3RhdHVzJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjb21wbGV0aW9uVGltZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnQmFzZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnYmFzZUlkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdzdGFydGVkQXQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIHJldHVybiB0YWJsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgY3VzdG9tIHJlc291cmNlIHRvIHNlZWQgYmFzZSB0ZW1wbGF0ZXMgdGFibGUgd2l0aCBpbml0aWFsIGRhdGFcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQmFzZVRlbXBsYXRlc1NlZWRlcihlbnZpcm9ubWVudDogc3RyaW5nLCBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZyk6IHZvaWQge1xuICAgIC8vIENyZWF0ZSBMYW1iZGEgZnVuY3Rpb24gZm9yIHNlZWRpbmcgYmFzZSB0ZW1wbGF0ZXMgdXNpbmcgTm9kZWpzRnVuY3Rpb24gZm9yIHByb3BlciBUeXBlU2NyaXB0IGJ1bmRsaW5nXG4gICAgY29uc3Qgc2VlZEZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsICdCYXNlVGVtcGxhdGVzU2VlZGVyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBnYW1lLWJhc2Utc2VlZC10ZW1wbGF0ZXMtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuWDg2XzY0LCAvLyBDb25zaXN0ZW50IHdpdGggb3RoZXIgTGFtYmRhIGZ1bmN0aW9uc1xuICAgICAgZW50cnk6ICdsYW1iZGEvc2VlZC1kYXRhL3NlZWQtYmFzZS10ZW1wbGF0ZXMudHMnLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBCQVNFX1RFTVBMQVRFU19UQUJMRTogdGhpcy5iYXNlVGVtcGxhdGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBOT0RFX09QVElPTlM6ICctLWVuYWJsZS1zb3VyY2UtbWFwcydcbiAgICAgIH0sXG4gICAgICBidW5kbGluZzoge1xuICAgICAgICBtaW5pZnk6IHRydWUsXG4gICAgICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgICAgIGtlZXBOYW1lczogdHJ1ZSxcbiAgICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbJ0Bhd3Mtc2RrLyonXSAvLyBVc2UgTGFtYmRhIHJ1bnRpbWUgdmVyc2lvblxuICAgICAgfSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgdGhlIExhbWJkYSBmdW5jdGlvbiBwZXJtaXNzaW9ucyB0byByZWFkL3dyaXRlIHRoZSBiYXNlIHRlbXBsYXRlcyB0YWJsZVxuICAgIHRoaXMuYmFzZVRlbXBsYXRlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShzZWVkRnVuY3Rpb24pO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBjdXN0b20gcmVzb3VyY2VcbiAgICBjb25zdCBzZWVkUHJvdmlkZXIgPSBuZXcgY3IuUHJvdmlkZXIodGhpcywgJ0Jhc2VUZW1wbGF0ZXNTZWVkZXJQcm92aWRlcicsIHtcbiAgICAgIG9uRXZlbnRIYW5kbGVyOiBzZWVkRnVuY3Rpb24sXG4gICAgICBsb2dSZXRlbnRpb246IDMwLCAvLyAzMCBkYXlzIGxvZyByZXRlbnRpb25cbiAgICAgIHByb3ZpZGVyRnVuY3Rpb25OYW1lOiBgZ2FtZS1iYXNlLXNlZWQtcHJvdmlkZXItJHtlbnZpcm9ubWVudH1gXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgY3VzdG9tIHJlc291cmNlIHRoYXQgdHJpZ2dlcnMgdGhlIHNlZWRpbmdcbiAgICBjb25zdCBzZWVkUmVzb3VyY2UgPSBuZXcgY2RrLkN1c3RvbVJlc291cmNlKHRoaXMsICdCYXNlVGVtcGxhdGVzU2VlZGVyUmVzb3VyY2UnLCB7XG4gICAgICBzZXJ2aWNlVG9rZW46IHNlZWRQcm92aWRlci5zZXJ2aWNlVG9rZW4sXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIC8vIENoYW5nZSB0aGlzIHZhbHVlIHRvIHRyaWdnZXIgcmUtc2VlZGluZyBkdXJpbmcgdXBkYXRlc1xuICAgICAgICBTZWVkVmVyc2lvbjogJzEuMC4wJyxcbiAgICAgICAgRW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgICAgICBUYWJsZU5hbWU6IHRoaXMuYmFzZVRlbXBsYXRlc1RhYmxlLnRhYmxlTmFtZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gRW5zdXJlIHNlZWRpbmcgaGFwcGVucyBhZnRlciB0YWJsZSBpcyByZWFkeVxuICAgIHNlZWRSZXNvdXJjZS5ub2RlLmFkZERlcGVuZGVuY3kodGhpcy5iYXNlVGVtcGxhdGVzVGFibGUpO1xuICB9XG59Il19
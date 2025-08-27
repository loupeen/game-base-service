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
const constructs_1 = require("constructs");
const shared_cdk_constructs_1 = require("@loupeen/shared-cdk-constructs");
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
        this.createBaseTemplatesSeeder(environment);
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
     * Create seeder for base templates table using shared construct
     */
    createBaseTemplatesSeeder(environment) {
        new shared_cdk_constructs_1.DynamoDBTableSeeder(this, 'BaseTemplatesSeeder', {
            table: this.baseTemplatesTable,
            seedDataPath: 'lambda/seed-data/seed-base-templates.ts',
            seedVersion: '1.0.0',
            environment,
            seedFunctionName: `game-base-seed-templates-${environment}`
        });
    }
}
exports.BaseGameTablesConstruct = BaseGameTablesConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1nYW1lLXRhYmxlcy1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9jb25zdHJ1Y3RzL2Jhc2UtZ2FtZS10YWJsZXMtY29uc3RydWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyxtRUFBcUQ7QUFDckQsMkNBQXVDO0FBQ3ZDLDBFQUFxRTtBQVFyRTs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNILE1BQWEsdUJBQXdCLFNBQVEsc0JBQVM7SUFDcEMsZ0JBQWdCLENBQWlCO0lBQ2pDLGtCQUFrQixDQUFpQjtJQUNuQyxtQkFBbUIsQ0FBaUI7SUFDcEMsaUJBQWlCLENBQWlCO0lBRWxELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBbUM7UUFDM0UsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV0Qyw2Q0FBNkM7UUFDN0MsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFekUsb0VBQW9FO1FBQ3BFLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBRTdFLCtEQUErRDtRQUMvRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUUvRSwwREFBMEQ7UUFDMUQsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFM0UsOENBQThDO1FBQzlDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLENBQUMs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LElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU07YUFDcEM7WUFDRCxjQUFjLEVBQUUsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHO1NBQzVDLENBQUMsQ0FBQztRQUVILEtBQUssQ0FBQyx1QkFBdUIsQ0FBQztZQUM1QixTQUFTLEVBQUUsV0FBVztZQUN0QixZQUFZLEVBQUU7Z0JBQ1osSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLEVBQUUsV0FBVztnQkFDakIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTTthQUNwQztZQUNELGNBQWMsRUFBRSxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUc7U0FDNUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBRUQ7O09BRUc7SUFDSyx5QkFBeUIsQ0FBQyxXQUFtQjtRQUNuRCxJQUFJLDJDQUFtQixDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNuRCxLQUFLLEVBQUUsSUFBSSxDQUFDLGtCQUFrQjtZQUM5QixZQUFZLEVBQUUseUNBQXlDO1lBQ3ZELFdBQVcsRUFBRSxPQUFPO1lBQ3BCLFdBQVc7WUFDWCxnQkFBZ0IsRUFBRSw0QkFBNEIsV0FBVyxFQUFFO1NBQzVELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTVPRCwwREE0T0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgRHluYW1vREJUYWJsZVNlZWRlciB9IGZyb20gJ0Bsb3VwZWVuL3NoYXJlZC1jZGstY29uc3RydWN0cyc7XG5pbXBvcnQgeyBHYW1lQmFzZVNlcnZpY2VDb25maWcgfSBmcm9tICcuLi9jb25maWcvZW52aXJvbm1lbnQtY29uZmlnJztcblxuZXhwb3J0IGludGVyZmFjZSBCYXNlR2FtZVRhYmxlc0NvbnN0cnVjdFByb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgY29uZmlnOiBHYW1lQmFzZVNlcnZpY2VDb25maWc7XG59XG5cbi8qKlxuICogQmFzZSBHYW1lIFRhYmxlcyBDb25zdHJ1Y3RcbiAqIFxuICogSW1wbGVtZW50cyBEeW5hbW9EQiB0YWJsZXMgZm9yIHRoZSBiYXNlIGJ1aWxkaW5nIGRvbWFpbiBmb2xsb3dpbmcgU09MSUQgcHJpbmNpcGxlczpcbiAqIC0gU2luZ2xlIFJlc3BvbnNpYmlsaXR5OiBPbmx5IG1hbmFnZXMgYmFzZS1yZWxhdGVkIGRhdGEgc3RvcmFnZVxuICogLSBPcGVuL0Nsb3NlZDogRWFzeSB0byBleHRlbmQgd2l0aCBuZXcgdGFibGUgdHlwZXNcbiAqIC0gSW50ZXJmYWNlIFNlZ3JlZ2F0aW9uOiBFYWNoIHRhYmxlIHNlcnZlcyBhIHNwZWNpZmljIHB1cnBvc2VcbiAqIC0gRGVwZW5kZW5jeSBJbnZlcnNpb246IERlcGVuZHMgb24gY29uZmlndXJhdGlvbiBhYnN0cmFjdGlvblxuICogXG4gKiBUYWJsZXMgQ3JlYXRlZDpcbiAqIC0gUGxheWVyQmFzZXM6IEluZGl2aWR1YWwgcGxheWVyIGJhc2UgaW5zdGFuY2VzXG4gKiAtIEJhc2VUZW1wbGF0ZXM6IEJhc2UgYnVpbGRpbmcgdGVtcGxhdGVzIGFuZCB1cGdyYWRlIHBhdGhzXG4gKiAtIFNwYXduTG9jYXRpb25zOiBOZXcgcGxheWVyIHNwYXduIGxvY2F0aW9uIG1hbmFnZW1lbnRcbiAqIC0gQmFzZVVwZ3JhZGVzOiBCYXNlIHVwZ3JhZGUgcHJvZ3Jlc3Npb24gYW5kIHJlcXVpcmVtZW50c1xuICovXG5leHBvcnQgY2xhc3MgQmFzZUdhbWVUYWJsZXNDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgcGxheWVyQmFzZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBiYXNlVGVtcGxhdGVzVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBwdWJsaWMgcmVhZG9ubHkgc3Bhd25Mb2NhdGlvbnNUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHB1YmxpYyByZWFkb25seSBiYXNlVXBncmFkZXNUYWJsZTogZHluYW1vZGIuVGFibGU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEJhc2VHYW1lVGFibGVzQ29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgY29uc3QgeyBlbnZpcm9ubWVudCwgY29uZmlnIH0gPSBwcm9wcztcblxuICAgIC8vIFBsYXllciBCYXNlcyBUYWJsZSAtIENvcmUgcGxheWVyIGJhc2UgZGF0YVxuICAgIHRoaXMucGxheWVyQmFzZXNUYWJsZSA9IHRoaXMuY3JlYXRlUGxheWVyQmFzZXNUYWJsZShlbnZpcm9ubWVudCwgY29uZmlnKTtcblxuICAgIC8vIEJhc2UgVGVtcGxhdGVzIFRhYmxlIC0gQmFzZSBidWlsZGluZyB0ZW1wbGF0ZXMgYW5kIGNvbmZpZ3VyYXRpb25zXG4gICAgdGhpcy5iYXNlVGVtcGxhdGVzVGFibGUgPSB0aGlzLmNyZWF0ZUJhc2VUZW1wbGF0ZXNUYWJsZShlbnZpcm9ubWVudCwgY29uZmlnKTtcblxuICAgIC8vIFNwYXduIExvY2F0aW9ucyBUYWJsZSAtIE5ldyBwbGF5ZXIgc3Bhd24gbG9jYXRpb24gbWFuYWdlbWVudFxuICAgIHRoaXMuc3Bhd25Mb2NhdGlvbnNUYWJsZSA9IHRoaXMuY3JlYXRlU3Bhd25Mb2NhdGlvbnNUYWJsZShlbnZpcm9ubWVudCwgY29uZmlnKTtcblxuICAgIC8vIEJhc2UgVXBncmFkZXMgVGFibGUgLSBCYXNlIHVwZ3JhZGUgcHJvZ3Jlc3Npb24gdHJhY2tpbmdcbiAgICB0aGlzLmJhc2VVcGdyYWRlc1RhYmxlID0gdGhpcy5jcmVhdGVCYXNlVXBncmFkZXNUYWJsZShlbnZpcm9ubWVudCwgY29uZmlnKTtcblxuICAgIC8vIFNlZWQgYmFzZSB0ZW1wbGF0ZXMgdGFibGUgd2l0aCBpbml0aWFsIGRhdGFcbiAgICB0aGlzLmNyZWF0ZUJhc2VUZW1wbGF0ZXNTZWVkZXIoZW52aXJvbm1lbnQpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVQbGF5ZXJCYXNlc1RhYmxlKGVudmlyb25tZW50OiBzdHJpbmcsIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogZHluYW1vZGIuVGFibGUge1xuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQbGF5ZXJCYXNlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgZ2FtZS1iYXNlLXBsYXllci1iYXNlcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3BsYXllcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdiYXNlSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBjb25maWcuZHluYW1vZGIuYmlsbGluZ01vZGUgPT09ICdQQVlfUEVSX1JFUVVFU1QnIFxuICAgICAgICA/IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCBcbiAgICAgICAgOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGNvbmZpZy5keW5hbW9kYi5wb2ludEluVGltZVJlY292ZXJ5LFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBjb25maWcuZHluYW1vZGIuZGVsZXRpb25Qcm90ZWN0aW9uLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdsb2JhbCBTZWNvbmRhcnkgSW5kZXhlc1xuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ0xvY2F0aW9uSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICdtYXBTZWN0aW9uSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2Nvb3JkaW5hdGVIYXNoJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdBbGxpYW5jZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnYWxsaWFuY2VJZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnY3JlYXRlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTdGF0dXNJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3N0YXR1cycsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnbGFzdEFjdGl2ZUF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuS0VZU19PTkxZXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGFibGU7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJhc2VUZW1wbGF0ZXNUYWJsZShlbnZpcm9ubWVudDogc3RyaW5nLCBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZyk6IGR5bmFtb2RiLlRhYmxlIHtcbiAgICBjb25zdCB0YWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQmFzZVRlbXBsYXRlc1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiBgZ2FtZS1iYXNlLXRlbXBsYXRlcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3RlbXBsYXRlSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBjb25maWcuZHluYW1vZGIuYmlsbGluZ01vZGUgPT09ICdQQVlfUEVSX1JFUVVFU1QnIFxuICAgICAgICA/IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCBcbiAgICAgICAgOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGNvbmZpZy5keW5hbW9kYi5wb2ludEluVGltZVJlY292ZXJ5LFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBjb25maWcuZHluYW1vZGIuZGVsZXRpb25Qcm90ZWN0aW9uLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcXVlcnlpbmcgYnkgYmFzZSB0eXBlIGFuZCBsZXZlbFxuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1R5cGVMZXZlbEluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnYmFzZVR5cGUnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIHNvcnRLZXk6IHtcbiAgICAgICAgbmFtZTogJ2xldmVsJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGFibGU7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVNwYXduTG9jYXRpb25zVGFibGUoZW52aXJvbm1lbnQ6IHN0cmluZywgY29uZmlnOiBHYW1lQmFzZVNlcnZpY2VDb25maWcpOiBkeW5hbW9kYi5UYWJsZSB7XG4gICAgY29uc3QgdGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1NwYXduTG9jYXRpb25zVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGBnYW1lLWJhc2Utc3Bhd24tbG9jYXRpb25zLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc3Bhd25SZWdpb25JZCcsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HXG4gICAgICB9LFxuICAgICAgc29ydEtleToge1xuICAgICAgICBuYW1lOiAnc3Bhd25Mb2NhdGlvbklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBiaWxsaW5nTW9kZTogY29uZmlnLmR5bmFtb2RiLmJpbGxpbmdNb2RlID09PSAnUEFZX1BFUl9SRVFVRVNUJyBcbiAgICAgICAgPyBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QgXG4gICAgICAgIDogZHluYW1vZGIuQmlsbGluZ01vZGUuUFJPVklTSU9ORUQsXG4gICAgICBlbmNyeXB0aW9uOiBkeW5hbW9kYi5UYWJsZUVuY3J5cHRpb24uQVdTX01BTkFHRUQsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiBjb25maWcuZHluYW1vZGIucG9pbnRJblRpbWVSZWNvdmVyeSxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogY29uZmlnLmR5bmFtb2RiLmRlbGV0aW9uUHJvdGVjdGlvbixcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIFxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG5cbiAgICAgIC8vIFRUTCBmb3IgdGVtcG9yYXJ5IHNwYXduIHJlc2VydmF0aW9uc1xuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCdcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGF2YWlsYWJsZSBzcGF3biBsb2NhdGlvbnNcbiAgICB0YWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdBdmFpbGFiaWxpdHlJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ2lzQXZhaWxhYmxlJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdsYXN0VXNlZEF0JyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5OVU1CRVJcbiAgICAgIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMXG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGFibGU7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJhc2VVcGdyYWRlc1RhYmxlKGVudmlyb25tZW50OiBzdHJpbmcsIGNvbmZpZzogR2FtZUJhc2VTZXJ2aWNlQ29uZmlnKTogZHluYW1vZGIuVGFibGUge1xuICAgIGNvbnN0IHRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdCYXNlVXBncmFkZXNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGdhbWUtYmFzZS11cGdyYWRlcy0ke2Vudmlyb25tZW50fWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgbmFtZTogJ3BsYXllcklkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICd1cGdyYWRlSWQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklOR1xuICAgICAgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBjb25maWcuZHluYW1vZGIuYmlsbGluZ01vZGUgPT09ICdQQVlfUEVSX1JFUVVFU1QnIFxuICAgICAgICA/IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCBcbiAgICAgICAgOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QUk9WSVNJT05FRCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IGNvbmZpZy5keW5hbW9kYi5wb2ludEluVGltZVJlY292ZXJ5LFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBjb25maWcuZHluYW1vZGIuZGVsZXRpb25Qcm90ZWN0aW9uLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kdWN0aW9uJyBcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcblxuICAgICAgLy8gVFRMIGZvciBjb21wbGV0ZWQgdXBncmFkZXMgY2xlYW51cFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCdcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHF1ZXJ5aW5nIGFjdGl2ZSB1cGdyYWRlc1xuICAgIHRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1N0YXR1c0luZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnc3RhdHVzJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdjb21wbGV0aW9uVGltZScsXG4gICAgICAgIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuTlVNQkVSXG4gICAgICB9LFxuICAgICAgcHJvamVjdGlvblR5cGU6IGR5bmFtb2RiLlByb2plY3Rpb25UeXBlLkFMTFxuICAgIH0pO1xuXG4gICAgdGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnQmFzZUluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleToge1xuICAgICAgICBuYW1lOiAnYmFzZUlkJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzb3J0S2V5OiB7XG4gICAgICAgIG5hbWU6ICdzdGFydGVkQXQnLFxuICAgICAgICB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLk5VTUJFUlxuICAgICAgfSxcbiAgICAgIHByb2plY3Rpb25UeXBlOiBkeW5hbW9kYi5Qcm9qZWN0aW9uVHlwZS5BTExcbiAgICB9KTtcblxuICAgIHJldHVybiB0YWJsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgc2VlZGVyIGZvciBiYXNlIHRlbXBsYXRlcyB0YWJsZSB1c2luZyBzaGFyZWQgY29uc3RydWN0XG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUJhc2VUZW1wbGF0ZXNTZWVkZXIoZW52aXJvbm1lbnQ6IHN0cmluZyk6IHZvaWQge1xuICAgIG5ldyBEeW5hbW9EQlRhYmxlU2VlZGVyKHRoaXMsICdCYXNlVGVtcGxhdGVzU2VlZGVyJywge1xuICAgICAgdGFibGU6IHRoaXMuYmFzZVRlbXBsYXRlc1RhYmxlLFxuICAgICAgc2VlZERhdGFQYXRoOiAnbGFtYmRhL3NlZWQtZGF0YS9zZWVkLWJhc2UtdGVtcGxhdGVzLnRzJyxcbiAgICAgIHNlZWRWZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICBzZWVkRnVuY3Rpb25OYW1lOiBgZ2FtZS1iYXNlLXNlZWQtdGVtcGxhdGVzLSR7ZW52aXJvbm1lbnR9YFxuICAgIH0pO1xuICB9XG59Il19
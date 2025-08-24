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
exports.GameBaseServiceStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const environment_config_1 = require("./config/environment-config");
const base_game_tables_construct_1 = require("./constructs/base-game-tables-construct");
const base_game_lambdas_construct_1 = require("./constructs/base-game-lambdas-construct");
const base_game_apis_construct_1 = require("./constructs/base-game-apis-construct");
const base_game_monitoring_construct_1 = require("./constructs/base-game-monitoring-construct");
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
class GameBaseServiceStack extends cdk.Stack {
    config;
    tablesConstruct;
    lambdasConstruct;
    apisConstruct;
    monitoringConstruct;
    constructor(scope, id, props) {
        super(scope, id, props);
        // Load environment-specific configuration
        this.config = (0, environment_config_1.getGameBaseServiceConfig)(props.environment);
        // Create domain tables following Single Responsibility
        this.tablesConstruct = new base_game_tables_construct_1.BaseGameTablesConstruct(this, 'Tables', {
            environment: props.environment,
            config: this.config
        });
        // Create domain lambdas following Interface Segregation
        this.lambdasConstruct = new base_game_lambdas_construct_1.BaseGameLambdasConstruct(this, 'Lambdas', {
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
        this.apisConstruct = new base_game_apis_construct_1.BaseGameApisConstruct(this, 'Apis', {
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
        this.monitoringConstruct = new base_game_monitoring_construct_1.BaseGameMonitoringConstruct(this, 'Monitoring', {
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
    createOutputs() {
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
exports.GameBaseServiceStack = GameBaseServiceStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1iYXNlLXNlcnZpY2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9nYW1lLWJhc2Utc2VydmljZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFTbkMsb0VBQThGO0FBQzlGLHdGQUFrRjtBQUNsRiwwRkFBb0Y7QUFDcEYsb0ZBQThFO0FBQzlFLGdHQUEwRjtBQU0xRjs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FpQkc7QUFDSCxNQUFhLG9CQUFxQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ2pDLE1BQU0sQ0FBd0I7SUFDOUIsZUFBZSxDQUEwQjtJQUN6QyxnQkFBZ0IsQ0FBMkI7SUFDM0MsYUFBYSxDQUF3QjtJQUNyQyxtQkFBbUIsQ0FBOEI7SUFFakUsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFnQztRQUN4RSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwwQ0FBMEM7UUFDMUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFBLDZDQUF3QixFQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUUxRCx1REFBdUQ7UUFDdkQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLG9EQUF1QixDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDakUsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO1lBQzlCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtTQUNwQixDQUFDLENBQUM7UUFFSCx3REFBd0Q7UUFDeEQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksc0RBQXdCLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUNwRSxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVc7WUFDOUIsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1lBQ25CLE1BQU0sRUFBRTtnQkFDTixXQUFXLEVBQUUsSUFBSSxD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LG1CQUFtQixDQUFDLFNBQVM7WUFDekQsV0FBVyxFQUFFLHFDQUFxQztZQUNsRCxVQUFVLEVBQUUsbUJBQW1CLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxzQkFBc0I7U0FDN0UsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBekZELG9EQXlGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCB7IGdldEdhbWVCYXNlU2VydmljZUNvbmZpZywgR2FtZUJhc2VTZXJ2aWNlQ29uZmlnIH0gZnJvbSAnLi9jb25maWcvZW52aXJvbm1lbnQtY29uZmlnJztcbmltcG9ydCB7IEJhc2VHYW1lVGFibGVzQ29uc3RydWN0IH0gZnJvbSAnLi9jb25zdHJ1Y3RzL2Jhc2UtZ2FtZS10YWJsZXMtY29uc3RydWN0JztcbmltcG9ydCB7IEJhc2VHYW1lTGFtYmRhc0NvbnN0cnVjdCB9IGZyb20gJy4vY29uc3RydWN0cy9iYXNlLWdhbWUtbGFtYmRhcy1jb25zdHJ1Y3QnO1xuaW1wb3J0IHsgQmFzZUdhbWVBcGlzQ29uc3RydWN0IH0gZnJvbSAnLi9jb25zdHJ1Y3RzL2Jhc2UtZ2FtZS1hcGlzLWNvbnN0cnVjdCc7XG5pbXBvcnQgeyBCYXNlR2FtZU1vbml0b3JpbmdDb25zdHJ1Y3QgfSBmcm9tICcuL2NvbnN0cnVjdHMvYmFzZS1nYW1lLW1vbml0b3JpbmctY29uc3RydWN0JztcblxuZXhwb3J0IGludGVyZmFjZSBHYW1lQmFzZVNlcnZpY2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xufVxuXG4vKipcbiAqIEdhbWUgQmFzZSBTZXJ2aWNlIFN0YWNrXG4gKiBcbiAqIEltcGxlbWVudHMgdGhlIGJhc2UgYnVpbGRpbmcgYW5kIG1hbmFnZW1lbnQgZG9tYWluIGZvciBMb3VwZWVuIFJUUyBQbGF0Zm9ybS5cbiAqIEZvbGxvd3MgU09MSUQgcHJpbmNpcGxlcyB3aXRoIGNsZWFyIHNlcGFyYXRpb24gb2YgY29uY2VybnM6XG4gKiAtIFNpbmdsZSBSZXNwb25zaWJpbGl0eTogT25seSBoYW5kbGVzIGJhc2UtcmVsYXRlZCBmdW5jdGlvbmFsaXR5XG4gKiAtIE9wZW4vQ2xvc2VkOiBFeHRlbnNpYmxlIGZvciBuZXcgYmFzZSB0eXBlcyB3aXRob3V0IG1vZGlmaWNhdGlvblxuICogLSBMaXNrb3YgU3Vic3RpdHV0aW9uOiBBbGwgYmFzZSBvcGVyYXRpb25zIGltcGxlbWVudCBjb21tb24gaW50ZXJmYWNlc1xuICogLSBJbnRlcmZhY2UgU2VncmVnYXRpb246IFNlcGFyYXRlIGludGVyZmFjZXMgZm9yIGRpZmZlcmVudCBiYXNlIG9wZXJhdGlvbnNcbiAqIC0gRGVwZW5kZW5jeSBJbnZlcnNpb246IERlcGVuZHMgb24gc2hhcmVkIGFic3RyYWN0aW9uc1xuICogXG4gKiBEb21haW4gUmVzcG9uc2liaWxpdGllczpcbiAqIC0gUGxheWVyIGJhc2UgY3JlYXRpb24gYW5kIG1hbmFnZW1lbnRcbiAqIC0gQmFzZSBidWlsZGluZyBhbmQgdXBncmFkZXNcbiAqIC0gQmFzZSBtb3ZlbWVudCBhbmQgcmVsb2NhdGlvblxuICogLSBTcGF3biBsb2NhdGlvbiBjYWxjdWxhdGlvblxuICogLSBUZXJyaXRvcnktYmFzZWQgYmFzZSBlZmZlY3RzXG4gKi9cbmV4cG9ydCBjbGFzcyBHYW1lQmFzZVNlcnZpY2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZztcbiAgcHVibGljIHJlYWRvbmx5IHRhYmxlc0NvbnN0cnVjdDogQmFzZUdhbWVUYWJsZXNDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSBsYW1iZGFzQ29uc3RydWN0OiBCYXNlR2FtZUxhbWJkYXNDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSBhcGlzQ29uc3RydWN0OiBCYXNlR2FtZUFwaXNDb25zdHJ1Y3Q7XG4gIHB1YmxpYyByZWFkb25seSBtb25pdG9yaW5nQ29uc3RydWN0OiBCYXNlR2FtZU1vbml0b3JpbmdDb25zdHJ1Y3Q7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEdhbWVCYXNlU2VydmljZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIExvYWQgZW52aXJvbm1lbnQtc3BlY2lmaWMgY29uZmlndXJhdGlvblxuICAgIHRoaXMuY29uZmlnID0gZ2V0R2FtZUJhc2VTZXJ2aWNlQ29uZmlnKHByb3BzLmVudmlyb25tZW50KTtcblxuICAgIC8vIENyZWF0ZSBkb21haW4gdGFibGVzIGZvbGxvd2luZyBTaW5nbGUgUmVzcG9uc2liaWxpdHlcbiAgICB0aGlzLnRhYmxlc0NvbnN0cnVjdCA9IG5ldyBCYXNlR2FtZVRhYmxlc0NvbnN0cnVjdCh0aGlzLCAnVGFibGVzJywge1xuICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgY29uZmlnOiB0aGlzLmNvbmZpZ1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGRvbWFpbiBsYW1iZGFzIGZvbGxvd2luZyBJbnRlcmZhY2UgU2VncmVnYXRpb25cbiAgICB0aGlzLmxhbWJkYXNDb25zdHJ1Y3QgPSBuZXcgQmFzZUdhbWVMYW1iZGFzQ29uc3RydWN0KHRoaXMsICdMYW1iZGFzJywge1xuICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgY29uZmlnOiB0aGlzLmNvbmZpZyxcbiAgICAgIHRhYmxlczoge1xuICAgICAgICBwbGF5ZXJCYXNlczogdGhpcy50YWJsZXNDb25zdHJ1Y3QucGxheWVyQmFzZXNUYWJsZSxcbiAgICAgICAgYmFzZVRlbXBsYXRlczogdGhpcy50YWJsZXNDb25zdHJ1Y3QuYmFzZVRlbXBsYXRlc1RhYmxlLFxuICAgICAgICBzcGF3bkxvY2F0aW9uczogdGhpcy50YWJsZXNDb25zdHJ1Y3Quc3Bhd25Mb2NhdGlvbnNUYWJsZSxcbiAgICAgICAgYmFzZVVwZ3JhZGVzOiB0aGlzLnRhYmxlc0NvbnN0cnVjdC5iYXNlVXBncmFkZXNUYWJsZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGRvbWFpbiBBUElzIGZvbGxvd2luZyBPcGVuL0Nsb3NlZCBwcmluY2lwbGVcbiAgICB0aGlzLmFwaXNDb25zdHJ1Y3QgPSBuZXcgQmFzZUdhbWVBcGlzQ29uc3RydWN0KHRoaXMsICdBcGlzJywge1xuICAgICAgZW52aXJvbm1lbnQ6IHByb3BzLmVudmlyb25tZW50LFxuICAgICAgY29uZmlnOiB0aGlzLmNvbmZpZyxcbiAgICAgIGxhbWJkYXM6IHtcbiAgICAgICAgY3JlYXRlQmFzZTogdGhpcy5sYW1iZGFzQ29uc3RydWN0LmNyZWF0ZUJhc2VGdW5jdGlvbixcbiAgICAgICAgdXBncmFkZUJhc2U6IHRoaXMubGFtYmRhc0NvbnN0cnVjdC51cGdyYWRlQmFzZUZ1bmN0aW9uLFxuICAgICAgICBtb3ZlQmFzZTogdGhpcy5sYW1iZGFzQ29uc3RydWN0Lm1vdmVCYXNlRnVuY3Rpb24sXG4gICAgICAgIGxpc3RCYXNlczogdGhpcy5sYW1iZGFzQ29uc3RydWN0Lmxpc3RCYXNlc0Z1bmN0aW9uLFxuICAgICAgICBnZXRCYXNlRGV0YWlsczogdGhpcy5sYW1iZGFzQ29uc3RydWN0LmdldEJhc2VEZXRhaWxzRnVuY3Rpb24sXG4gICAgICAgIGNhbGN1bGF0ZVNwYXduTG9jYXRpb246IHRoaXMubGFtYmRhc0NvbnN0cnVjdC5jYWxjdWxhdGVTcGF3bkxvY2F0aW9uRnVuY3Rpb25cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBtb25pdG9yaW5nIGZvbGxvd2luZyBEZXBlbmRlbmN5IEludmVyc2lvblxuICAgIHRoaXMubW9uaXRvcmluZ0NvbnN0cnVjdCA9IG5ldyBCYXNlR2FtZU1vbml0b3JpbmdDb25zdHJ1Y3QodGhpcywgJ01vbml0b3JpbmcnLCB7XG4gICAgICBlbnZpcm9ubWVudDogcHJvcHMuZW52aXJvbm1lbnQsXG4gICAgICBjb25maWc6IHRoaXMuY29uZmlnLFxuICAgICAgbGFtYmRhczogW1xuICAgICAgICB0aGlzLmxhbWJkYXNDb25zdHJ1Y3QuY3JlYXRlQmFzZUZ1bmN0aW9uLFxuICAgICAgICB0aGlzLmxhbWJkYXNDb25zdHJ1Y3QudXBncmFkZUJhc2VGdW5jdGlvbixcbiAgICAgICAgdGhpcy5sYW1iZGFzQ29uc3RydWN0Lm1vdmVCYXNlRnVuY3Rpb24sXG4gICAgICAgIHRoaXMubGFtYmRhc0NvbnN0cnVjdC5saXN0QmFzZXNGdW5jdGlvbixcbiAgICAgICAgdGhpcy5sYW1iZGFzQ29uc3RydWN0LmdldEJhc2VEZXRhaWxzRnVuY3Rpb24sXG4gICAgICAgIHRoaXMubGFtYmRhc0NvbnN0cnVjdC5jYWxjdWxhdGVTcGF3bkxvY2F0aW9uRnVuY3Rpb25cbiAgICAgIF0sXG4gICAgICBhcGk6IHRoaXMuYXBpc0NvbnN0cnVjdC5hcGlcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dCBpbXBvcnRhbnQgdmFsdWVzIGZvciBpbnRlZ3JhdGlvblxuICAgIHRoaXMuY3JlYXRlT3V0cHV0cygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVPdXRwdXRzKCk6IHZvaWQge1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaXNDb25zdHJ1Y3QuYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2FtZSBCYXNlIFNlcnZpY2UgQVBJIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGBHYW1lQmFzZVNlcnZpY2UtJHt0aGlzLmNvbmZpZy5lbnZpcm9ubWVudH0tQXBpRW5kcG9pbnRgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGxheWVyQmFzZXNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy50YWJsZXNDb25zdHJ1Y3QucGxheWVyQmFzZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BsYXllciBCYXNlcyBEeW5hbW9EQiB0YWJsZSBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBHYW1lQmFzZVNlcnZpY2UtJHt0aGlzLmNvbmZpZy5lbnZpcm9ubWVudH0tUGxheWVyQmFzZXNUYWJsZWBcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdCYXNlVGVtcGxhdGVzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMudGFibGVzQ29uc3RydWN0LmJhc2VUZW1wbGF0ZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Jhc2UgVGVtcGxhdGVzIER5bmFtb0RCIHRhYmxlIG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYEdhbWVCYXNlU2VydmljZS0ke3RoaXMuY29uZmlnLmVudmlyb25tZW50fS1CYXNlVGVtcGxhdGVzVGFibGVgXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3Bhd25Mb2NhdGlvbnNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy50YWJsZXNDb25zdHJ1Y3Quc3Bhd25Mb2NhdGlvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NwYXduIExvY2F0aW9ucyBEeW5hbW9EQiB0YWJsZSBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBHYW1lQmFzZVNlcnZpY2UtJHt0aGlzLmNvbmZpZy5lbnZpcm9ubWVudH0tU3Bhd25Mb2NhdGlvbnNUYWJsZWBcbiAgICB9KTtcbiAgfVxufSJdfQ==
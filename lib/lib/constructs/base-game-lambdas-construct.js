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
exports.BaseGameLambdasConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
const aws_lambda_nodejs_1 = require("aws-cdk-lib/aws-lambda-nodejs");
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
class BaseGameLambdasConstruct extends constructs_1.Construct {
    createBaseFunction;
    upgradeBaseFunction;
    moveBaseFunction;
    listBasesFunction;
    getBaseDetailsFunction;
    calculateSpawnLocationFunction;
    constructor(scope, id, props) {
        super(scope, id);
        const { environment, config, tables } = props;
        // Common Lambda configuration following cost optimization patterns
        const commonLambdaProps = {
            runtime: lambda.Runtime.NODEJS_18_X,
            architecture: lambda.Architecture.X86_64, // Temporary: ARM64 causing Docker platform issues in CI
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
        this.createBaseFunction = new aws_lambda_nodejs_1.NodejsFunction(this, 'CreateBaseFunction', {
            ...commonLambdaProps,
            entry: 'lambda/base-management/create-base.ts',
            handler: 'handler',
            description: 'Creates new player base with spawn location calculation and resource allocation',
            functionName: `game-base-create-${environment}`
        });
        // Upgrade Base Function - Handle base upgrades and improvements
        this.upgradeBaseFunction = new aws_lambda_nodejs_1.NodejsFunction(this, 'UpgradeBaseFunction', {
            ...commonLambdaProps,
            entry: 'lambda/base-management/upgrade-base.ts',
            handler: 'handler',
            description: 'Processes base upgrades, validates requirements, and updates base statistics',
            functionName: `game-base-upgrade-${environment}`
        });
        // Move Base Function - Handle base relocation
        this.moveBaseFunction = new aws_lambda_nodejs_1.NodejsFunction(this, 'MoveBaseFunction', {
            ...commonLambdaProps,
            entry: 'lambda/base-management/move-base.ts',
            handler: 'handler',
            description: 'Relocates player base with cooldown and teleport cost validation',
            functionName: `game-base-move-${environment}`
        });
        // List Bases Function - Retrieve player's bases
        this.listBasesFunction = new aws_lambda_nodejs_1.NodejsFunction(this, 'ListBasesFunction', {
            ...commonLambdaProps,
            entry: 'lambda/base-queries/list-bases.ts',
            handler: 'handler',
            description: 'Returns paginated list of player bases with summary information',
            functionName: `game-base-list-${environment}`
        });
        // Get Base Details Function - Detailed base information
        this.getBaseDetailsFunction = new aws_lambda_nodejs_1.NodejsFunction(this, 'GetBaseDetailsFunction', {
            ...commonLambdaProps,
            entry: 'lambda/base-queries/get-base-details.ts',
            handler: 'handler',
            description: 'Returns detailed information about specific player base',
            functionName: `game-base-details-${environment}`
        });
        // Calculate Spawn Location Function - New player spawn logic
        this.calculateSpawnLocationFunction = new aws_lambda_nodejs_1.NodejsFunction(this, 'CalculateSpawnLocationFunction', {
            ...commonLambdaProps,
            entry: 'lambda/spawn-management/calculate-spawn-location.ts',
            handler: 'handler',
            description: 'Calculates optimal spawn location for new players based on population density',
            functionName: `game-base-spawn-${environment}`
        });
        // Grant DynamoDB permissions following principle of least privilege
        this.grantTablePermissions(tables);
    }
    grantTablePermissions(tables) {
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
exports.BaseGameLambdasConstruct = BaseGameLambdasConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1nYW1lLWxhbWJkYXMtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vY29uc3RydWN0cy9iYXNlLWdhbWUtbGFtYmRhcy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLDJDQUF1QztBQUN2QyxxRUFBK0Q7QUFjL0Q7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUJHO0FBQ0gsTUFBYSx3QkFBeUIsU0FBUSxzQkFBUztJQUNyQyxrQkFBa0IsQ0FBaUI7SUFDbkMsbUJBQW1CLENBQWlCO0lBQ3BDLGdCQUFnQixDQUFpQjtJQUNqQyxpQkFBaUIsQ0FBaUI7SUFDbEMsc0JBQXNCLENBQWlCO0lBQ3ZDLDhCQUE4QixDQUFpQjtJQUUvRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW9DO1FBQzVFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRTlDLG1FQUFtRTtRQUNuRSxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLHdEQUF3RDtZQUNsRyxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDcEQsVUFBVSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVTtZQUNwQyxXQUFXLEVBQUU7Z0JBQ1gsV0FBVyxFQUFFLFdBQVc7Z0JBQ3hCLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMs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RCxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztvQkFDM0MsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztvQkFDeEIsT0FBTyxFQUFFO3dCQUNQLHVCQUF1Qjt3QkFDdkIsMEJBQTBCO3FCQUMzQjtvQkFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7aUJBQ2pCLENBQUMsQ0FBQyxDQUFDO1lBQ04sQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdEpELDREQXNKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0IHsgR2FtZUJhc2VTZXJ2aWNlQ29uZmlnIH0gZnJvbSAnLi4vY29uZmlnL2Vudmlyb25tZW50LWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmFzZUdhbWVMYW1iZGFzQ29uc3RydWN0UHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZztcbiAgdGFibGVzOiB7XG4gICAgcGxheWVyQmFzZXM6IGR5bmFtb2RiLlRhYmxlO1xuICAgIGJhc2VUZW1wbGF0ZXM6IGR5bmFtb2RiLlRhYmxlO1xuICAgIHNwYXduTG9jYXRpb25zOiBkeW5hbW9kYi5UYWJsZTtcbiAgICBiYXNlVXBncmFkZXM6IGR5bmFtb2RiLlRhYmxlO1xuICB9O1xufVxuXG4vKipcbiAqIEJhc2UgR2FtZSBMYW1iZGFzIENvbnN0cnVjdFxuICogXG4gKiBJbXBsZW1lbnRzIExhbWJkYSBmdW5jdGlvbnMgZm9yIGJhc2UgYnVpbGRpbmcgZG9tYWluIGZvbGxvd2luZyBTT0xJRCBwcmluY2lwbGVzOlxuICogLSBTaW5nbGUgUmVzcG9uc2liaWxpdHk6IEVhY2ggTGFtYmRhIGhhcyBvbmUgc3BlY2lmaWMgYmFzZS1yZWxhdGVkIGZ1bmN0aW9uXG4gKiAtIE9wZW4vQ2xvc2VkOiBFYXN5IHRvIGFkZCBuZXcgYmFzZSBvcGVyYXRpb25zIHdpdGhvdXQgbW9kaWZ5aW5nIGV4aXN0aW5nIG9uZXNcbiAqIC0gTGlza292IFN1YnN0aXR1dGlvbjogQWxsIGJhc2Ugb3BlcmF0aW9ucyBmb2xsb3cgY29tbW9uIHBhdHRlcm5zXG4gKiAtIEludGVyZmFjZSBTZWdyZWdhdGlvbjogU2VwYXJhdGUgZnVuY3Rpb25zIGZvciBkaWZmZXJlbnQgYmFzZSBvcGVyYXRpb25zXG4gKiAtIERlcGVuZGVuY3kgSW52ZXJzaW9uOiBGdW5jdGlvbnMgZGVwZW5kIG9uIHNoYXJlZCB1dGlsaXRpZXMgYW5kIGFic3RyYWN0aW9uc1xuICogXG4gKiBMYW1iZGEgRnVuY3Rpb25zOlxuICogLSBjcmVhdGVCYXNlOiBDcmVhdGUgbmV3IHBsYXllciBiYXNlXG4gKiAtIHVwZ3JhZGVCYXNlOiBVcGdyYWRlIGV4aXN0aW5nIGJhc2VcbiAqIC0gbW92ZUJhc2U6IFJlbG9jYXRlIGJhc2UgdG8gbmV3IGxvY2F0aW9uXG4gKiAtIGxpc3RCYXNlczogTGlzdCBwbGF5ZXIncyBiYXNlc1xuICogLSBnZXRCYXNlRGV0YWlsczogR2V0IGRldGFpbGVkIGJhc2UgaW5mb3JtYXRpb25cbiAqIC0gY2FsY3VsYXRlU3Bhd25Mb2NhdGlvbjogRmluZCBvcHRpbWFsIHNwYXduIGxvY2F0aW9uIGZvciBuZXcgcGxheWVyc1xuICovXG5leHBvcnQgY2xhc3MgQmFzZUdhbWVMYW1iZGFzQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGNyZWF0ZUJhc2VGdW5jdGlvbjogTm9kZWpzRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSB1cGdyYWRlQmFzZUZ1bmN0aW9uOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IG1vdmVCYXNlRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgbGlzdEJhc2VzRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0QmFzZURldGFpbHNGdW5jdGlvbjogTm9kZWpzRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBjYWxjdWxhdGVTcGF3bkxvY2F0aW9uRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCYXNlR2FtZUxhbWJkYXNDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB7IGVudmlyb25tZW50LCBjb25maWcsIHRhYmxlcyB9ID0gcHJvcHM7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb24gZm9sbG93aW5nIGNvc3Qgb3B0aW1pemF0aW9uIHBhdHRlcm5zXG4gICAgY29uc3QgY29tbW9uTGFtYmRhUHJvcHMgPSB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjQsIC8vIFRlbXBvcmFyeTogQVJNNjQgY2F1c2luZyBEb2NrZXIgcGxhdGZvcm0gaXNzdWVzIGluIENJXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyhjb25maWcubGFtYmRhLnRpbWVvdXQpLFxuICAgICAgbWVtb3J5U2l6ZTogY29uZmlnLmxhbWJkYS5tZW1vcnlTaXplLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBQTEFZRVJfQkFTRVNfVEFCTEU6IHRhYmxlcy5wbGF5ZXJCYXNlcy50YWJsZU5hbWUsXG4gICAgICAgIEJBU0VfVEVNUExBVEVTX1RBQkxFOiB0YWJsZXMuYmFzZVRlbXBsYXRlcy50YWJsZU5hbWUsXG4gICAgICAgIFNQQVdOX0xPQ0FUSU9OU19UQUJMRTogdGFibGVzLnNwYXduTG9jYXRpb25zLnRhYmxlTmFtZSxcbiAgICAgICAgQkFTRV9VUEdSQURFU19UQUJMRTogdGFibGVzLmJhc2VVcGdyYWRlcy50YWJsZU5hbWUsXG4gICAgICAgIEFXU19OT0RFSlNfQ09OTkVDVElPTl9SRVVTRV9FTkFCTEVEOiAnMScgLy8gUGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uXG4gICAgICB9LFxuICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgbWluaWZ5OiB0cnVlLFxuICAgICAgICB0YXJnZXQ6ICdlczIwMjAnLFxuICAgICAgICBrZWVwTmFtZXM6IHRydWUsXG4gICAgICAgIGV4dGVybmFsTW9kdWxlczogWydhd3Mtc2RrJ10gLy8gVXNlIExhbWJkYSBydW50aW1lIHZlcnNpb25cbiAgICAgIH0sXG4gICAgICB0cmFjaW5nOiBjb25maWcubW9uaXRvcmluZy5lbmFibGVYUmF5VHJhY2luZyA/IGxhbWJkYS5UcmFjaW5nLkFDVElWRSA6IGxhbWJkYS5UcmFjaW5nLkRJU0FCTEVELFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUtcbiAgICB9O1xuXG4gICAgLy8gQ3JlYXRlIEJhc2UgRnVuY3Rpb24gLSBIYW5kbGUgbmV3IGJhc2UgY3JlYXRpb25cbiAgICB0aGlzLmNyZWF0ZUJhc2VGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCAnQ3JlYXRlQmFzZUZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBlbnRyeTogJ2xhbWJkYS9iYXNlLW1hbmFnZW1lbnQvY3JlYXRlLWJhc2UudHMnLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdDcmVhdGVzIG5ldyBwbGF5ZXIgYmFzZSB3aXRoIHNwYXduIGxvY2F0aW9uIGNhbGN1bGF0aW9uIGFuZCByZXNvdXJjZSBhbGxvY2F0aW9uJyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGdhbWUtYmFzZS1jcmVhdGUtJHtlbnZpcm9ubWVudH1gXG4gICAgfSk7XG5cbiAgICAvLyBVcGdyYWRlIEJhc2UgRnVuY3Rpb24gLSBIYW5kbGUgYmFzZSB1cGdyYWRlcyBhbmQgaW1wcm92ZW1lbnRzXG4gICAgdGhpcy51cGdyYWRlQmFzZUZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsICdVcGdyYWRlQmFzZUZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBlbnRyeTogJ2xhbWJkYS9iYXNlLW1hbmFnZW1lbnQvdXBncmFkZS1iYXNlLnRzJyxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJvY2Vzc2VzIGJhc2UgdXBncmFkZXMsIHZhbGlkYXRlcyByZXF1aXJlbWVudHMsIGFuZCB1cGRhdGVzIGJhc2Ugc3RhdGlzdGljcycsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBnYW1lLWJhc2UtdXBncmFkZS0ke2Vudmlyb25tZW50fWBcbiAgICB9KTtcblxuICAgIC8vIE1vdmUgQmFzZSBGdW5jdGlvbiAtIEhhbmRsZSBiYXNlIHJlbG9jYXRpb25cbiAgICB0aGlzLm1vdmVCYXNlRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgJ01vdmVCYXNlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGVudHJ5OiAnbGFtYmRhL2Jhc2UtbWFuYWdlbWVudC9tb3ZlLWJhc2UudHMnLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdSZWxvY2F0ZXMgcGxheWVyIGJhc2Ugd2l0aCBjb29sZG93biBhbmQgdGVsZXBvcnQgY29zdCB2YWxpZGF0aW9uJyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGdhbWUtYmFzZS1tb3ZlLSR7ZW52aXJvbm1lbnR9YFxuICAgIH0pO1xuXG4gICAgLy8gTGlzdCBCYXNlcyBGdW5jdGlvbiAtIFJldHJpZXZlIHBsYXllcidzIGJhc2VzXG4gICAgdGhpcy5saXN0QmFzZXNGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCAnTGlzdEJhc2VzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGVudHJ5OiAnbGFtYmRhL2Jhc2UtcXVlcmllcy9saXN0LWJhc2VzLnRzJyxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmV0dXJucyBwYWdpbmF0ZWQgbGlzdCBvZiBwbGF5ZXIgYmFzZXMgd2l0aCBzdW1tYXJ5IGluZm9ybWF0aW9uJyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGdhbWUtYmFzZS1saXN0LSR7ZW52aXJvbm1lbnR9YFxuICAgIH0pO1xuXG4gICAgLy8gR2V0IEJhc2UgRGV0YWlscyBGdW5jdGlvbiAtIERldGFpbGVkIGJhc2UgaW5mb3JtYXRpb25cbiAgICB0aGlzLmdldEJhc2VEZXRhaWxzRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgJ0dldEJhc2VEZXRhaWxzRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGVudHJ5OiAnbGFtYmRhL2Jhc2UtcXVlcmllcy9nZXQtYmFzZS1kZXRhaWxzLnRzJyxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmV0dXJucyBkZXRhaWxlZCBpbmZvcm1hdGlvbiBhYm91dCBzcGVjaWZpYyBwbGF5ZXIgYmFzZScsXG4gICAgICBmdW5jdGlvbk5hbWU6IGBnYW1lLWJhc2UtZGV0YWlscy0ke2Vudmlyb25tZW50fWBcbiAgICB9KTtcblxuICAgIC8vIENhbGN1bGF0ZSBTcGF3biBMb2NhdGlvbiBGdW5jdGlvbiAtIE5ldyBwbGF5ZXIgc3Bhd24gbG9naWNcbiAgICB0aGlzLmNhbGN1bGF0ZVNwYXduTG9jYXRpb25GdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCAnQ2FsY3VsYXRlU3Bhd25Mb2NhdGlvbkZ1bmN0aW9uJywge1xuICAgICAgLi4uY29tbW9uTGFtYmRhUHJvcHMsXG4gICAgICBlbnRyeTogJ2xhbWJkYS9zcGF3bi1tYW5hZ2VtZW50L2NhbGN1bGF0ZS1zcGF3bi1sb2NhdGlvbi50cycsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NhbGN1bGF0ZXMgb3B0aW1hbCBzcGF3biBsb2NhdGlvbiBmb3IgbmV3IHBsYXllcnMgYmFzZWQgb24gcG9wdWxhdGlvbiBkZW5zaXR5JyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGdhbWUtYmFzZS1zcGF3bi0ke2Vudmlyb25tZW50fWBcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIGZvbGxvd2luZyBwcmluY2lwbGUgb2YgbGVhc3QgcHJpdmlsZWdlXG4gICAgdGhpcy5ncmFudFRhYmxlUGVybWlzc2lvbnModGFibGVzKTtcbiAgfVxuXG4gIHByaXZhdGUgZ3JhbnRUYWJsZVBlcm1pc3Npb25zKHRhYmxlczoge1xuICAgIHBsYXllckJhc2VzOiBkeW5hbW9kYi5UYWJsZTtcbiAgICBiYXNlVGVtcGxhdGVzOiBkeW5hbW9kYi5UYWJsZTtcbiAgICBzcGF3bkxvY2F0aW9uczogZHluYW1vZGIuVGFibGU7XG4gICAgYmFzZVVwZ3JhZGVzOiBkeW5hbW9kYi5UYWJsZTtcbiAgfSk6IHZvaWQge1xuICAgIGNvbnN0IGxhbWJkYUZ1bmN0aW9ucyA9IFtcbiAgICAgIHRoaXMuY3JlYXRlQmFzZUZ1bmN0aW9uLFxuICAgICAgdGhpcy51cGdyYWRlQmFzZUZ1bmN0aW9uLFxuICAgICAgdGhpcy5tb3ZlQmFzZUZ1bmN0aW9uLFxuICAgICAgdGhpcy5saXN0QmFzZXNGdW5jdGlvbixcbiAgICAgIHRoaXMuZ2V0QmFzZURldGFpbHNGdW5jdGlvbixcbiAgICAgIHRoaXMuY2FsY3VsYXRlU3Bhd25Mb2NhdGlvbkZ1bmN0aW9uXG4gICAgXTtcblxuICAgIC8vIEdyYW50IHRhYmxlIGFjY2VzcyB0byBhbGwgZnVuY3Rpb25zXG4gICAgbGFtYmRhRnVuY3Rpb25zLmZvckVhY2goZnVuYyA9PiB7XG4gICAgICAvLyBQbGF5ZXIgQmFzZXMgdGFibGUgLSBmdWxsIGFjY2VzcyBmb3IgYmFzZSBtYW5hZ2VtZW50XG4gICAgICB0YWJsZXMucGxheWVyQmFzZXMuZ3JhbnRSZWFkV3JpdGVEYXRhKGZ1bmMpO1xuICAgICAgXG4gICAgICAvLyBCYXNlIFRlbXBsYXRlcyB0YWJsZSAtIHJlYWQtb25seSBmb3IgdGVtcGxhdGUgZGF0YVxuICAgICAgdGFibGVzLmJhc2VUZW1wbGF0ZXMuZ3JhbnRSZWFkRGF0YShmdW5jKTtcbiAgICAgIFxuICAgICAgLy8gU3Bhd24gTG9jYXRpb25zIHRhYmxlIC0gcmVhZC93cml0ZSBmb3Igc3Bhd24gbWFuYWdlbWVudFxuICAgICAgdGFibGVzLnNwYXduTG9jYXRpb25zLmdyYW50UmVhZFdyaXRlRGF0YShmdW5jKTtcbiAgICAgIFxuICAgICAgLy8gQmFzZSBVcGdyYWRlcyB0YWJsZSAtIHJlYWQvd3JpdGUgZm9yIHVwZ3JhZGUgdHJhY2tpbmdcbiAgICAgIHRhYmxlcy5iYXNlVXBncmFkZXMuZ3JhbnRSZWFkV3JpdGVEYXRhKGZ1bmMpO1xuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgYWRkaXRpb25hbCBwZXJtaXNzaW9ucyBmb3IgQ2VkYXIgYXV0aG9yaXphdGlvbiBpbnRlZ3JhdGlvblxuICAgIGxhbWJkYUZ1bmN0aW9ucy5mb3JFYWNoKGZ1bmMgPT4ge1xuICAgICAgZnVuYy5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnbG9nczpDcmVhdGVMb2dHcm91cCcsXG4gICAgICAgICAgJ2xvZ3M6Q3JlYXRlTG9nU3RyZWFtJyxcbiAgICAgICAgICAnbG9nczpQdXRMb2dFdmVudHMnXG4gICAgICAgIF0sXG4gICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgIH0pKTtcblxuICAgICAgLy8gWFJheSBwZXJtaXNzaW9ucyBpZiB0cmFjaW5nIGlzIGVuYWJsZWRcbiAgICAgIGlmICh0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgnZW5hYmxlWFJheVRyYWNpbmcnKSAhPT0gZmFsc2UpIHtcbiAgICAgICAgZnVuYy5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAneHJheTpQdXRUcmFjZVNlZ21lbnRzJyxcbiAgICAgICAgICAgICd4cmF5OlB1dFRlbGVtZXRyeVJlY29yZHMnXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFsnKiddXG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSJdfQ==
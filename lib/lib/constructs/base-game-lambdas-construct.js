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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1nYW1lLWxhbWJkYXMtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vY29uc3RydWN0cy9iYXNlLWdhbWUtbGFtYmRhcy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkRBQTZDO0FBQzdDLDJDQUF1QztBQUN2QyxxRUFBK0Q7QUFjL0Q7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBaUJHO0FBQ0gsTUFBYSx3QkFBeUIsU0FBUSxzQkFBUztJQUNyQyxrQkFBa0IsQ0FBaUI7SUFDbkMsbUJBQW1CLENBQWlCO0lBQ3BDLGdCQUFnQixDQUFpQjtJQUNqQyxpQkFBaUIsQ0FBaUI7SUFDbEMsc0JBQXNCLENBQWlCO0lBQ3ZDLDhCQUE4QixDQUFpQjtJQUUvRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW9DO1FBQzVFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRTlDLG1FQUFtRTtRQUNuRSxNQUFNLGlCQUFpQixHQUFHO1lBQ3hCLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLG1CQUFtQjtZQUM3RCxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDcEQsVUFBVSxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVTtZQUNwQyxXQUFXLEVBQUU7Z0JBQ1gsV0FBVyxFQUFFLFdBQVc7Z0JBQ3hCLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxXQUFXLENBQUMs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RCxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztvQkFDM0MsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztvQkFDeEIsT0FBTyxFQUFFO3dCQUNQLHVCQUF1Qjt3QkFDdkIsMEJBQTBCO3FCQUMzQjtvQkFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7aUJBQ2pCLENBQUMsQ0FBQyxDQUFDO1lBQ04sQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdEpELDREQXNKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IE5vZGVqc0Z1bmN0aW9uIH0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0IHsgR2FtZUJhc2VTZXJ2aWNlQ29uZmlnIH0gZnJvbSAnLi4vY29uZmlnL2Vudmlyb25tZW50LWNvbmZpZyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmFzZUdhbWVMYW1iZGFzQ29uc3RydWN0UHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBjb25maWc6IEdhbWVCYXNlU2VydmljZUNvbmZpZztcbiAgdGFibGVzOiB7XG4gICAgcGxheWVyQmFzZXM6IGR5bmFtb2RiLlRhYmxlO1xuICAgIGJhc2VUZW1wbGF0ZXM6IGR5bmFtb2RiLlRhYmxlO1xuICAgIHNwYXduTG9jYXRpb25zOiBkeW5hbW9kYi5UYWJsZTtcbiAgICBiYXNlVXBncmFkZXM6IGR5bmFtb2RiLlRhYmxlO1xuICB9O1xufVxuXG4vKipcbiAqIEJhc2UgR2FtZSBMYW1iZGFzIENvbnN0cnVjdFxuICogXG4gKiBJbXBsZW1lbnRzIExhbWJkYSBmdW5jdGlvbnMgZm9yIGJhc2UgYnVpbGRpbmcgZG9tYWluIGZvbGxvd2luZyBTT0xJRCBwcmluY2lwbGVzOlxuICogLSBTaW5nbGUgUmVzcG9uc2liaWxpdHk6IEVhY2ggTGFtYmRhIGhhcyBvbmUgc3BlY2lmaWMgYmFzZS1yZWxhdGVkIGZ1bmN0aW9uXG4gKiAtIE9wZW4vQ2xvc2VkOiBFYXN5IHRvIGFkZCBuZXcgYmFzZSBvcGVyYXRpb25zIHdpdGhvdXQgbW9kaWZ5aW5nIGV4aXN0aW5nIG9uZXNcbiAqIC0gTGlza292IFN1YnN0aXR1dGlvbjogQWxsIGJhc2Ugb3BlcmF0aW9ucyBmb2xsb3cgY29tbW9uIHBhdHRlcm5zXG4gKiAtIEludGVyZmFjZSBTZWdyZWdhdGlvbjogU2VwYXJhdGUgZnVuY3Rpb25zIGZvciBkaWZmZXJlbnQgYmFzZSBvcGVyYXRpb25zXG4gKiAtIERlcGVuZGVuY3kgSW52ZXJzaW9uOiBGdW5jdGlvbnMgZGVwZW5kIG9uIHNoYXJlZCB1dGlsaXRpZXMgYW5kIGFic3RyYWN0aW9uc1xuICogXG4gKiBMYW1iZGEgRnVuY3Rpb25zOlxuICogLSBjcmVhdGVCYXNlOiBDcmVhdGUgbmV3IHBsYXllciBiYXNlXG4gKiAtIHVwZ3JhZGVCYXNlOiBVcGdyYWRlIGV4aXN0aW5nIGJhc2VcbiAqIC0gbW92ZUJhc2U6IFJlbG9jYXRlIGJhc2UgdG8gbmV3IGxvY2F0aW9uXG4gKiAtIGxpc3RCYXNlczogTGlzdCBwbGF5ZXIncyBiYXNlc1xuICogLSBnZXRCYXNlRGV0YWlsczogR2V0IGRldGFpbGVkIGJhc2UgaW5mb3JtYXRpb25cbiAqIC0gY2FsY3VsYXRlU3Bhd25Mb2NhdGlvbjogRmluZCBvcHRpbWFsIHNwYXduIGxvY2F0aW9uIGZvciBuZXcgcGxheWVyc1xuICovXG5leHBvcnQgY2xhc3MgQmFzZUdhbWVMYW1iZGFzQ29uc3RydWN0IGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGNyZWF0ZUJhc2VGdW5jdGlvbjogTm9kZWpzRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSB1cGdyYWRlQmFzZUZ1bmN0aW9uOiBOb2RlanNGdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IG1vdmVCYXNlRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgbGlzdEJhc2VzRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgZ2V0QmFzZURldGFpbHNGdW5jdGlvbjogTm9kZWpzRnVuY3Rpb247XG4gIHB1YmxpYyByZWFkb25seSBjYWxjdWxhdGVTcGF3bkxvY2F0aW9uRnVuY3Rpb246IE5vZGVqc0Z1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCYXNlR2FtZUxhbWJkYXNDb25zdHJ1Y3RQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCB7IGVudmlyb25tZW50LCBjb25maWcsIHRhYmxlcyB9ID0gcHJvcHM7XG5cbiAgICAvLyBDb21tb24gTGFtYmRhIGNvbmZpZ3VyYXRpb24gZm9sbG93aW5nIGNvc3Qgb3B0aW1pemF0aW9uIHBhdHRlcm5zXG4gICAgY29uc3QgY29tbW9uTGFtYmRhUHJvcHMgPSB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsIC8vIDIwJSBjb3N0IHNhdmluZ3NcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKGNvbmZpZy5sYW1iZGEudGltZW91dCksXG4gICAgICBtZW1vcnlTaXplOiBjb25maWcubGFtYmRhLm1lbW9yeVNpemUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIFBMQVlFUl9CQVNFU19UQUJMRTogdGFibGVzLnBsYXllckJhc2VzLnRhYmxlTmFtZSxcbiAgICAgICAgQkFTRV9URU1QTEFURVNfVEFCTEU6IHRhYmxlcy5iYXNlVGVtcGxhdGVzLnRhYmxlTmFtZSxcbiAgICAgICAgU1BBV05fTE9DQVRJT05TX1RBQkxFOiB0YWJsZXMuc3Bhd25Mb2NhdGlvbnMudGFibGVOYW1lLFxuICAgICAgICBCQVNFX1VQR1JBREVTX1RBQkxFOiB0YWJsZXMuYmFzZVVwZ3JhZGVzLnRhYmxlTmFtZSxcbiAgICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyAvLyBQZXJmb3JtYW5jZSBvcHRpbWl6YXRpb25cbiAgICAgIH0sXG4gICAgICBidW5kbGluZzoge1xuICAgICAgICBtaW5pZnk6IHRydWUsXG4gICAgICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgICAgIGtlZXBOYW1lczogdHJ1ZSxcbiAgICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbJ2F3cy1zZGsnXSAvLyBVc2UgTGFtYmRhIHJ1bnRpbWUgdmVyc2lvblxuICAgICAgfSxcbiAgICAgIHRyYWNpbmc6IGNvbmZpZy5tb25pdG9yaW5nLmVuYWJsZVhSYXlUcmFjaW5nID8gbGFtYmRhLlRyYWNpbmcuQUNUSVZFIDogbGFtYmRhLlRyYWNpbmcuRElTQUJMRUQsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFS1xuICAgIH07XG5cbiAgICAvLyBDcmVhdGUgQmFzZSBGdW5jdGlvbiAtIEhhbmRsZSBuZXcgYmFzZSBjcmVhdGlvblxuICAgIHRoaXMuY3JlYXRlQmFzZUZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsICdDcmVhdGVCYXNlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGVudHJ5OiAnbGFtYmRhL2Jhc2UtbWFuYWdlbWVudC9jcmVhdGUtYmFzZS50cycsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NyZWF0ZXMgbmV3IHBsYXllciBiYXNlIHdpdGggc3Bhd24gbG9jYXRpb24gY2FsY3VsYXRpb24gYW5kIHJlc291cmNlIGFsbG9jYXRpb24nLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZ2FtZS1iYXNlLWNyZWF0ZS0ke2Vudmlyb25tZW50fWBcbiAgICB9KTtcblxuICAgIC8vIFVwZ3JhZGUgQmFzZSBGdW5jdGlvbiAtIEhhbmRsZSBiYXNlIHVwZ3JhZGVzIGFuZCBpbXByb3ZlbWVudHNcbiAgICB0aGlzLnVwZ3JhZGVCYXNlRnVuY3Rpb24gPSBuZXcgTm9kZWpzRnVuY3Rpb24odGhpcywgJ1VwZ3JhZGVCYXNlRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGVudHJ5OiAnbGFtYmRhL2Jhc2UtbWFuYWdlbWVudC91cGdyYWRlLWJhc2UudHMnLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdQcm9jZXNzZXMgYmFzZSB1cGdyYWRlcywgdmFsaWRhdGVzIHJlcXVpcmVtZW50cywgYW5kIHVwZGF0ZXMgYmFzZSBzdGF0aXN0aWNzJyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGdhbWUtYmFzZS11cGdyYWRlLSR7ZW52aXJvbm1lbnR9YFxuICAgIH0pO1xuXG4gICAgLy8gTW92ZSBCYXNlIEZ1bmN0aW9uIC0gSGFuZGxlIGJhc2UgcmVsb2NhdGlvblxuICAgIHRoaXMubW92ZUJhc2VGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCAnTW92ZUJhc2VGdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZW50cnk6ICdsYW1iZGEvYmFzZS1tYW5hZ2VtZW50L21vdmUtYmFzZS50cycsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JlbG9jYXRlcyBwbGF5ZXIgYmFzZSB3aXRoIGNvb2xkb3duIGFuZCB0ZWxlcG9ydCBjb3N0IHZhbGlkYXRpb24nLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZ2FtZS1iYXNlLW1vdmUtJHtlbnZpcm9ubWVudH1gXG4gICAgfSk7XG5cbiAgICAvLyBMaXN0IEJhc2VzIEZ1bmN0aW9uIC0gUmV0cmlldmUgcGxheWVyJ3MgYmFzZXNcbiAgICB0aGlzLmxpc3RCYXNlc0Z1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsICdMaXN0QmFzZXNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZW50cnk6ICdsYW1iZGEvYmFzZS1xdWVyaWVzL2xpc3QtYmFzZXMudHMnLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdSZXR1cm5zIHBhZ2luYXRlZCBsaXN0IG9mIHBsYXllciBiYXNlcyB3aXRoIHN1bW1hcnkgaW5mb3JtYXRpb24nLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZ2FtZS1iYXNlLWxpc3QtJHtlbnZpcm9ubWVudH1gXG4gICAgfSk7XG5cbiAgICAvLyBHZXQgQmFzZSBEZXRhaWxzIEZ1bmN0aW9uIC0gRGV0YWlsZWQgYmFzZSBpbmZvcm1hdGlvblxuICAgIHRoaXMuZ2V0QmFzZURldGFpbHNGdW5jdGlvbiA9IG5ldyBOb2RlanNGdW5jdGlvbih0aGlzLCAnR2V0QmFzZURldGFpbHNGdW5jdGlvbicsIHtcbiAgICAgIC4uLmNvbW1vbkxhbWJkYVByb3BzLFxuICAgICAgZW50cnk6ICdsYW1iZGEvYmFzZS1xdWVyaWVzL2dldC1iYXNlLWRldGFpbHMudHMnLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXInLFxuICAgICAgZGVzY3JpcHRpb246ICdSZXR1cm5zIGRldGFpbGVkIGluZm9ybWF0aW9uIGFib3V0IHNwZWNpZmljIHBsYXllciBiYXNlJyxcbiAgICAgIGZ1bmN0aW9uTmFtZTogYGdhbWUtYmFzZS1kZXRhaWxzLSR7ZW52aXJvbm1lbnR9YFxuICAgIH0pO1xuXG4gICAgLy8gQ2FsY3VsYXRlIFNwYXduIExvY2F0aW9uIEZ1bmN0aW9uIC0gTmV3IHBsYXllciBzcGF3biBsb2dpY1xuICAgIHRoaXMuY2FsY3VsYXRlU3Bhd25Mb2NhdGlvbkZ1bmN0aW9uID0gbmV3IE5vZGVqc0Z1bmN0aW9uKHRoaXMsICdDYWxjdWxhdGVTcGF3bkxvY2F0aW9uRnVuY3Rpb24nLCB7XG4gICAgICAuLi5jb21tb25MYW1iZGFQcm9wcyxcbiAgICAgIGVudHJ5OiAnbGFtYmRhL3NwYXduLW1hbmFnZW1lbnQvY2FsY3VsYXRlLXNwYXduLWxvY2F0aW9uLnRzJyxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2FsY3VsYXRlcyBvcHRpbWFsIHNwYXduIGxvY2F0aW9uIGZvciBuZXcgcGxheWVycyBiYXNlZCBvbiBwb3B1bGF0aW9uIGRlbnNpdHknLFxuICAgICAgZnVuY3Rpb25OYW1lOiBgZ2FtZS1iYXNlLXNwYXduLSR7ZW52aXJvbm1lbnR9YFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRHluYW1vREIgcGVybWlzc2lvbnMgZm9sbG93aW5nIHByaW5jaXBsZSBvZiBsZWFzdCBwcml2aWxlZ2VcbiAgICB0aGlzLmdyYW50VGFibGVQZXJtaXNzaW9ucyh0YWJsZXMpO1xuICB9XG5cbiAgcHJpdmF0ZSBncmFudFRhYmxlUGVybWlzc2lvbnModGFibGVzOiB7XG4gICAgcGxheWVyQmFzZXM6IGR5bmFtb2RiLlRhYmxlO1xuICAgIGJhc2VUZW1wbGF0ZXM6IGR5bmFtb2RiLlRhYmxlO1xuICAgIHNwYXduTG9jYXRpb25zOiBkeW5hbW9kYi5UYWJsZTtcbiAgICBiYXNlVXBncmFkZXM6IGR5bmFtb2RiLlRhYmxlO1xuICB9KTogdm9pZCB7XG4gICAgY29uc3QgbGFtYmRhRnVuY3Rpb25zID0gW1xuICAgICAgdGhpcy5jcmVhdGVCYXNlRnVuY3Rpb24sXG4gICAgICB0aGlzLnVwZ3JhZGVCYXNlRnVuY3Rpb24sXG4gICAgICB0aGlzLm1vdmVCYXNlRnVuY3Rpb24sXG4gICAgICB0aGlzLmxpc3RCYXNlc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5nZXRCYXNlRGV0YWlsc0Z1bmN0aW9uLFxuICAgICAgdGhpcy5jYWxjdWxhdGVTcGF3bkxvY2F0aW9uRnVuY3Rpb25cbiAgICBdO1xuXG4gICAgLy8gR3JhbnQgdGFibGUgYWNjZXNzIHRvIGFsbCBmdW5jdGlvbnNcbiAgICBsYW1iZGFGdW5jdGlvbnMuZm9yRWFjaChmdW5jID0+IHtcbiAgICAgIC8vIFBsYXllciBCYXNlcyB0YWJsZSAtIGZ1bGwgYWNjZXNzIGZvciBiYXNlIG1hbmFnZW1lbnRcbiAgICAgIHRhYmxlcy5wbGF5ZXJCYXNlcy5ncmFudFJlYWRXcml0ZURhdGEoZnVuYyk7XG4gICAgICBcbiAgICAgIC8vIEJhc2UgVGVtcGxhdGVzIHRhYmxlIC0gcmVhZC1vbmx5IGZvciB0ZW1wbGF0ZSBkYXRhXG4gICAgICB0YWJsZXMuYmFzZVRlbXBsYXRlcy5ncmFudFJlYWREYXRhKGZ1bmMpO1xuICAgICAgXG4gICAgICAvLyBTcGF3biBMb2NhdGlvbnMgdGFibGUgLSByZWFkL3dyaXRlIGZvciBzcGF3biBtYW5hZ2VtZW50XG4gICAgICB0YWJsZXMuc3Bhd25Mb2NhdGlvbnMuZ3JhbnRSZWFkV3JpdGVEYXRhKGZ1bmMpO1xuICAgICAgXG4gICAgICAvLyBCYXNlIFVwZ3JhZGVzIHRhYmxlIC0gcmVhZC93cml0ZSBmb3IgdXBncmFkZSB0cmFja2luZ1xuICAgICAgdGFibGVzLmJhc2VVcGdyYWRlcy5ncmFudFJlYWRXcml0ZURhdGEoZnVuYyk7XG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBhZGRpdGlvbmFsIHBlcm1pc3Npb25zIGZvciBDZWRhciBhdXRob3JpemF0aW9uIGludGVncmF0aW9uXG4gICAgbGFtYmRhRnVuY3Rpb25zLmZvckVhY2goZnVuYyA9PiB7XG4gICAgICBmdW5jLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdsb2dzOkNyZWF0ZUxvZ0dyb3VwJyxcbiAgICAgICAgICAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLFxuICAgICAgICAgICdsb2dzOlB1dExvZ0V2ZW50cydcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXVxuICAgICAgfSkpO1xuXG4gICAgICAvLyBYUmF5IHBlcm1pc3Npb25zIGlmIHRyYWNpbmcgaXMgZW5hYmxlZFxuICAgICAgaWYgKHRoaXMubm9kZS50cnlHZXRDb250ZXh0KCdlbmFibGVYUmF5VHJhY2luZycpICE9PSBmYWxzZSkge1xuICAgICAgICBmdW5jLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICd4cmF5OlB1dFRyYWNlU2VnbWVudHMnLFxuICAgICAgICAgICAgJ3hyYXk6UHV0VGVsZW1ldHJ5UmVjb3JkcydcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlc291cmNlczogWycqJ11cbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59Il19
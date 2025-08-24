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
exports.BaseGameApisConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
/**
 * Base Game APIs Construct
 *
 * Implements API Gateway endpoints for base management following SOLID principles:
 * - Single Responsibility: Only handles API endpoint configuration
 * - Open/Closed: Easy to add new endpoints without modifying existing ones
 * - Liskov Substitution: All endpoints follow consistent patterns
 * - Interface Segregation: Clear separation between player and admin APIs
 * - Dependency Inversion: Depends on Lambda function abstractions
 *
 * API Endpoints:
 * - POST /bases - Create new base
 * - PUT /bases/{baseId}/upgrade - Upgrade base
 * - PUT /bases/{baseId}/move - Move base
 * - GET /players/{playerId}/bases - List player bases
 * - GET /players/{playerId}/bases/{baseId} - Get base details
 * - POST /spawn/calculate - Calculate spawn location
 *
 * Features:
 * - Request/response validation
 * - CORS support for web clients
 * - Rate limiting and throttling
 * - Comprehensive logging
 * - Error handling
 */
class BaseGameApisConstruct extends constructs_1.Construct {
    api;
    constructor(scope, id, props) {
        super(scope, id);
        const { environment, config, lambdas } = props;
        // Create API Gateway with comprehensive configuration
        this.api = this.createApiGateway(environment);
        // Create API models for request/response validation
        const models = this.createApiModels();
        // Create request validators
        const validators = this.createRequestValidators();
        // Create API resources and methods
        this.createBaseManagementEndpoints(lambdas, models, validators);
        this.createBaseQueryEndpoints(lambdas, models, validators);
        this.createSpawnManagementEndpoints(lambdas, models, validators);
        // Configure CORS for all endpoints
        this.configureCors();
    }
    createApiGateway(environment) {
        return new apigateway.RestApi(this, 'GameBaseServiceApi', {
            restApiName: `game-base-service-${environment}`,
            description: `Loupeen RTS Platform - Base Building and Management API (${environment})`,
            // Enable CloudWatch logging
            deployOptions: {
                stageName: environment,
                accessLogDestination: new apigateway.LogGroupLogDestination(new logs.LogGroup(this, 'ApiAccessLogGroup', {
                    logGroupName: `/aws/apigateway/game-base-service-${environment}`,
                    retention: logs.RetentionDays.ONE_WEEK,
                    removalPolicy: cdk.RemovalPolicy.DESTROY
                })),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    caller: true,
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    user: true
                }),
                // Enable request/response data logging in non-production
                dataTraceEnabled: environment !== 'production',
                loggingLevel: environment === 'production'
                    ? apigateway.MethodLoggingLevel.ERROR
                    : apigateway.MethodLoggingLevel.INFO,
                // Enable detailed CloudWatch metrics
                metricsEnabled: true,
                // Throttling configuration
                throttlingRateLimit: environment === 'production' ? 1000 : 100,
                throttlingBurstLimit: environment === 'production' ? 2000 : 200
            },
            // Default CORS configuration
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                    'X-Player-Id',
                    'X-Alliance-Id'
                ]
            },
            // API Gateway configuration
            endpointConfiguration: {
                types: [apigateway.EndpointType.REGIONAL]
            },
            // Enable binary media types for future file uploads
            binaryMediaTypes: ['multipart/form-data', 'image/*'],
            // Minimum compression size
            minimumCompressionSize: 1000
        });
    }
    createApiModels() {
        const models = {};
        // Create Base Request Model
        models.createBaseRequest = this.api.addModel('CreateBaseRequest', {
            contentType: 'application/json',
            modelName: 'CreateBaseRequest',
            description: 'Request model for creating a new base',
            schema: {
                schema: apigateway.JsonSchemaVersion.DRAFT4,
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    playerId: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 50 },
                    baseType: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ['command_center', 'outpost', 'fortress', 'mining_station', 'research_lab']
                    },
                    baseName: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 100 },
                    coordinates: {
                        type: apigateway.JsonSchemaType.OBJECT,
                        properties: {
                            x: { type: apigateway.JsonSchemaType.NUMBER },
                            y: { type: apigateway.JsonSchemaType.NUMBER }
                        }
                    },
                    spawnLocationId: { type: apigateway.JsonSchemaType.STRING },
                    allianceId: { type: apigateway.JsonSchemaType.STRING }
                },
                required: ['playerId', 'baseType', 'baseName']
            }
        });
        // Upgrade Base Request Model
        models.upgradeBaseRequest = this.api.addModel('UpgradeBaseRequest', {
            contentType: 'application/json',
            modelName: 'UpgradeBaseRequest',
            schema: {
                schema: apigateway.JsonSchemaVersion.DRAFT4,
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    playerId: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 50 },
                    baseId: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 50 },
                    upgradeType: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ['level', 'defense', 'storage', 'production', 'specialized']
                    },
                    skipTime: { type: apigateway.JsonSchemaType.BOOLEAN }
                },
                required: ['playerId', 'baseId', 'upgradeType']
            }
        });
        // Move Base Request Model
        models.moveBaseRequest = this.api.addModel('MoveBaseRequest', {
            contentType: 'application/json',
            modelName: 'MoveBaseRequest',
            schema: {
                schema: apigateway.JsonSchemaVersion.DRAFT4,
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    playerId: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 50 },
                    baseId: { type: apigateway.JsonSchemaType.STRING, minLength: 1, maxLength: 50 },
                    newCoordinates: {
                        type: apigateway.JsonSchemaType.OBJECT,
                        properties: {
                            x: { type: apigateway.JsonSchemaType.NUMBER },
                            y: { type: apigateway.JsonSchemaType.NUMBER }
                        },
                        required: ['x', 'y']
                    },
                    useTeleport: { type: apigateway.JsonSchemaType.BOOLEAN }
                },
                required: ['playerId', 'baseId', 'newCoordinates']
            }
        });
        // Standard Success Response Model
        models.successResponse = this.api.addModel('SuccessResponse', {
            contentType: 'application/json',
            modelName: 'SuccessResponse',
            schema: {
                schema: apigateway.JsonSchemaVersion.DRAFT4,
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    success: { type: apigateway.JsonSchemaType.BOOLEAN },
                    data: { type: apigateway.JsonSchemaType.OBJECT },
                    message: { type: apigateway.JsonSchemaType.STRING }
                },
                required: ['success']
            }
        });
        // Error Response Model
        models.errorResponse = this.api.addModel('ErrorResponse', {
            contentType: 'application/json',
            modelName: 'ErrorResponse',
            schema: {
                schema: apigateway.JsonSchemaVersion.DRAFT4,
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    success: {
                        type: apigateway.JsonSchemaType.BOOLEAN,
                        enum: [false]
                    },
                    error: {
                        type: apigateway.JsonSchemaType.OBJECT,
                        properties: {
                            code: { type: apigateway.JsonSchemaType.STRING },
                            message: { type: apigateway.JsonSchemaType.STRING },
                            details: { type: apigateway.JsonSchemaType.OBJECT }
                        },
                        required: ['code', 'message']
                    }
                },
                required: ['success', 'error']
            }
        });
        return models;
    }
    createRequestValidators() {
        return {
            bodyValidator: this.api.addRequestValidator('BodyValidator', {
                requestValidatorName: 'body-validator',
                validateRequestBody: true,
                validateRequestParameters: false
            }),
            paramsValidator: this.api.addRequestValidator('ParamsValidator', {
                requestValidatorName: 'params-validator',
                validateRequestBody: false,
                validateRequestParameters: true
            }),
            fullValidator: this.api.addRequestValidator('FullValidator', {
                requestValidatorName: 'full-validator',
                validateRequestBody: true,
                validateRequestParameters: true
            })
        };
    }
    createBaseManagementEndpoints(lambdas, models, validators) {
        // /bases resource
        const basesResource = this.api.root.addResource('bases');
        // POST /bases - Create new base
        basesResource.addMethod('POST', new apigateway.LambdaIntegration(lambdas.createBase), {
            requestValidator: validators.bodyValidator,
            requestModels: {
                'application/json': models.createBaseRequest
            },
            methodResponses: [
                {
                    statusCode: '201',
                    responseModels: {
                        'application/json': models.successResponse
                    }
                },
                {
                    statusCode: '400',
                    responseModels: {
                        'application/json': models.errorResponse
                    }
                }
            ]
        });
        // /bases/{baseId} resource
        const baseResource = basesResource.addResource('{baseId}');
        // PUT /bases/{baseId}/upgrade - Upgrade base
        const upgradeResource = baseResource.addResource('upgrade');
        upgradeResource.addMethod('PUT', new apigateway.LambdaIntegration(lambdas.upgradeBase), {
            requestValidator: validators.fullValidator,
            requestParameters: {
                'method.request.path.baseId': true
            },
            requestModels: {
                'application/json': models.upgradeBaseRequest
            }
        });
        // PUT /bases/{baseId}/move - Move base
        const moveResource = baseResource.addResource('move');
        moveResource.addMethod('PUT', new apigateway.LambdaIntegration(lambdas.moveBase), {
            requestValidator: validators.fullValidator,
            requestParameters: {
                'method.request.path.baseId': true
            },
            requestModels: {
                'application/json': models.moveBaseRequest
            }
        });
    }
    createBaseQueryEndpoints(lambdas, models, validators) {
        // /players resource
        const playersResource = this.api.root.addResource('players');
        const playerResource = playersResource.addResource('{playerId}');
        // /players/{playerId}/bases resource
        const playerBasesResource = playerResource.addResource('bases');
        // GET /players/{playerId}/bases - List player bases
        playerBasesResource.addMethod('GET', new apigateway.LambdaIntegration(lambdas.listBases), {
            requestValidator: validators.paramsValidator,
            requestParameters: {
                'method.request.path.playerId': true,
                'method.request.querystring.status': false,
                'method.request.querystring.limit': false,
                'method.request.querystring.lastEvaluatedKey': false,
                'method.request.querystring.includeStats': false
            }
        });
        // /players/{playerId}/bases/{baseId} resource
        const playerBaseResource = playerBasesResource.addResource('{baseId}');
        // GET /players/{playerId}/bases/{baseId} - Get base details
        playerBaseResource.addMethod('GET', new apigateway.LambdaIntegration(lambdas.getBaseDetails), {
            requestValidator: validators.paramsValidator,
            requestParameters: {
                'method.request.path.playerId': true,
                'method.request.path.baseId': true
            }
        });
    }
    createSpawnManagementEndpoints(lambdas, models, validators) {
        // /spawn resource
        const spawnResource = this.api.root.addResource('spawn');
        // POST /spawn/calculate - Calculate spawn location
        const calculateResource = spawnResource.addResource('calculate');
        calculateResource.addMethod('POST', new apigateway.LambdaIntegration(lambdas.calculateSpawnLocation), {
            requestValidator: validators.bodyValidator
        });
    }
    configureCors() {
        // CORS is already configured in the API Gateway constructor
        // This method is placeholder for additional CORS configuration if needed
        // Add custom CORS headers if required
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Player-Id,X-Alliance-Id',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        };
        // Additional CORS configuration can be added here if needed
    }
}
exports.BaseGameApisConstruct = BaseGameApisConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1nYW1lLWFwaXMtY29uc3RydWN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vY29uc3RydWN0cy9iYXNlLWdhbWUtYXBpcy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQUV6RCwyREFBNkM7QUFDN0MsMkNBQXVDO0FBaUJ2Qzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBd0JHO0FBQ0gsTUFBYSxxQkFBc0IsU0FBUSxzQkFBUztJQUNsQyxHQUFHLENBQXFCO0lBRXhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBaUM7UUFDekUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFL0Msc0RBQXNEO1FBQ3RELElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRTlDLG9EQUFvRDtRQUNwRCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFFdEMsNEJBQTRCO1FBQzVCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBRWxELG1DQUFtQztRQUNuQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsOEJBQThCLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUVqRSxtQ0FBbUM7UUFDbkMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lB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R0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ2pFLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLEVBQUU7WUFDcEcsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGFBQWE7U0FDM0MsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLGFBQWE7UUFDbkIsNERBQTREO1FBQzVELHlFQUF5RTtRQUV6RSxzQ0FBc0M7UUFDdEMsTUFBTSxXQUFXLEdBQUc7WUFDbEIsNkJBQTZCLEVBQUUsR0FBRztZQUNsQyw4QkFBOEIsRUFBRSxnR0FBZ0c7WUFDaEksOEJBQThCLEVBQUUsNkJBQTZCO1NBQzlELENBQUM7UUFFRiw0REFBNEQ7SUFDOUQsQ0FBQztDQUNGO0FBeldELHNEQXlXQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBOb2RlanNGdW5jdGlvbiB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtbm9kZWpzJztcbmltcG9ydCB7IEdhbWVCYXNlU2VydmljZUNvbmZpZyB9IGZyb20gJy4uL2NvbmZpZy9lbnZpcm9ubWVudC1jb25maWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJhc2VHYW1lQXBpc0NvbnN0cnVjdFByb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgY29uZmlnOiBHYW1lQmFzZVNlcnZpY2VDb25maWc7XG4gIGxhbWJkYXM6IHtcbiAgICBjcmVhdGVCYXNlOiBOb2RlanNGdW5jdGlvbjtcbiAgICB1cGdyYWRlQmFzZTogTm9kZWpzRnVuY3Rpb247XG4gICAgbW92ZUJhc2U6IE5vZGVqc0Z1bmN0aW9uO1xuICAgIGxpc3RCYXNlczogTm9kZWpzRnVuY3Rpb247XG4gICAgZ2V0QmFzZURldGFpbHM6IE5vZGVqc0Z1bmN0aW9uO1xuICAgIGNhbGN1bGF0ZVNwYXduTG9jYXRpb246IE5vZGVqc0Z1bmN0aW9uO1xuICB9O1xufVxuXG4vKipcbiAqIEJhc2UgR2FtZSBBUElzIENvbnN0cnVjdFxuICogXG4gKiBJbXBsZW1lbnRzIEFQSSBHYXRld2F5IGVuZHBvaW50cyBmb3IgYmFzZSBtYW5hZ2VtZW50IGZvbGxvd2luZyBTT0xJRCBwcmluY2lwbGVzOlxuICogLSBTaW5nbGUgUmVzcG9uc2liaWxpdHk6IE9ubHkgaGFuZGxlcyBBUEkgZW5kcG9pbnQgY29uZmlndXJhdGlvblxuICogLSBPcGVuL0Nsb3NlZDogRWFzeSB0byBhZGQgbmV3IGVuZHBvaW50cyB3aXRob3V0IG1vZGlmeWluZyBleGlzdGluZyBvbmVzXG4gKiAtIExpc2tvdiBTdWJzdGl0dXRpb246IEFsbCBlbmRwb2ludHMgZm9sbG93IGNvbnNpc3RlbnQgcGF0dGVybnNcbiAqIC0gSW50ZXJmYWNlIFNlZ3JlZ2F0aW9uOiBDbGVhciBzZXBhcmF0aW9uIGJldHdlZW4gcGxheWVyIGFuZCBhZG1pbiBBUElzXG4gKiAtIERlcGVuZGVuY3kgSW52ZXJzaW9uOiBEZXBlbmRzIG9uIExhbWJkYSBmdW5jdGlvbiBhYnN0cmFjdGlvbnNcbiAqIFxuICogQVBJIEVuZHBvaW50czpcbiAqIC0gUE9TVCAvYmFzZXMgLSBDcmVhdGUgbmV3IGJhc2VcbiAqIC0gUFVUIC9iYXNlcy97YmFzZUlkfS91cGdyYWRlIC0gVXBncmFkZSBiYXNlXG4gKiAtIFBVVCAvYmFzZXMve2Jhc2VJZH0vbW92ZSAtIE1vdmUgYmFzZVxuICogLSBHRVQgL3BsYXllcnMve3BsYXllcklkfS9iYXNlcyAtIExpc3QgcGxheWVyIGJhc2VzXG4gKiAtIEdFVCAvcGxheWVycy97cGxheWVySWR9L2Jhc2VzL3tiYXNlSWR9IC0gR2V0IGJhc2UgZGV0YWlsc1xuICogLSBQT1NUIC9zcGF3bi9jYWxjdWxhdGUgLSBDYWxjdWxhdGUgc3Bhd24gbG9jYXRpb25cbiAqIFxuICogRmVhdHVyZXM6XG4gKiAtIFJlcXVlc3QvcmVzcG9uc2UgdmFsaWRhdGlvblxuICogLSBDT1JTIHN1cHBvcnQgZm9yIHdlYiBjbGllbnRzXG4gKiAtIFJhdGUgbGltaXRpbmcgYW5kIHRocm90dGxpbmdcbiAqIC0gQ29tcHJlaGVuc2l2ZSBsb2dnaW5nXG4gKiAtIEVycm9yIGhhbmRsaW5nXG4gKi9cbmV4cG9ydCBjbGFzcyBCYXNlR2FtZUFwaXNDb25zdHJ1Y3QgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIFxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmFzZUdhbWVBcGlzQ29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgY29uc3QgeyBlbnZpcm9ubWVudCwgY29uZmlnLCBsYW1iZGFzIH0gPSBwcm9wcztcblxuICAgIC8vIENyZWF0ZSBBUEkgR2F0ZXdheSB3aXRoIGNvbXByZWhlbnNpdmUgY29uZmlndXJhdGlvblxuICAgIHRoaXMuYXBpID0gdGhpcy5jcmVhdGVBcGlHYXRld2F5KGVudmlyb25tZW50KTtcblxuICAgIC8vIENyZWF0ZSBBUEkgbW9kZWxzIGZvciByZXF1ZXN0L3Jlc3BvbnNlIHZhbGlkYXRpb25cbiAgICBjb25zdCBtb2RlbHMgPSB0aGlzLmNyZWF0ZUFwaU1vZGVscygpO1xuXG4gICAgLy8gQ3JlYXRlIHJlcXVlc3QgdmFsaWRhdG9yc1xuICAgIGNvbnN0IHZhbGlkYXRvcnMgPSB0aGlzLmNyZWF0ZVJlcXVlc3RWYWxpZGF0b3JzKCk7XG5cbiAgICAvLyBDcmVhdGUgQVBJIHJlc291cmNlcyBhbmQgbWV0aG9kc1xuICAgIHRoaXMuY3JlYXRlQmFzZU1hbmFnZW1lbnRFbmRwb2ludHMobGFtYmRhcywgbW9kZWxzLCB2YWxpZGF0b3JzKTtcbiAgICB0aGlzLmNyZWF0ZUJhc2VRdWVyeUVuZHBvaW50cyhsYW1iZGFzLCBtb2RlbHMsIHZhbGlkYXRvcnMpO1xuICAgIHRoaXMuY3JlYXRlU3Bhd25NYW5hZ2VtZW50RW5kcG9pbnRzKGxhbWJkYXMsIG1vZGVscywgdmFsaWRhdG9ycyk7XG5cbiAgICAvLyBDb25maWd1cmUgQ09SUyBmb3IgYWxsIGVuZHBvaW50c1xuICAgIHRoaXMuY29uZmlndXJlQ29ycygpO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVBcGlHYXRld2F5KGVudmlyb25tZW50OiBzdHJpbmcpOiBhcGlnYXRld2F5LlJlc3RBcGkge1xuICAgIHJldHVybiBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdHYW1lQmFzZVNlcnZpY2VBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYGdhbWUtYmFzZS1zZXJ2aWNlLSR7ZW52aXJvbm1lbnR9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgTG91cGVlbiBSVFMgUGxhdGZvcm0gLSBCYXNlIEJ1aWxkaW5nIGFuZCBNYW5hZ2VtZW50IEFQSSAoJHtlbnZpcm9ubWVudH0pYCxcbiAgICAgIFxuICAgICAgLy8gRW5hYmxlIENsb3VkV2F0Y2ggbG9nZ2luZ1xuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6IGVudmlyb25tZW50LFxuICAgICAgICBhY2Nlc3NMb2dEZXN0aW5hdGlvbjogbmV3IGFwaWdhdGV3YXkuTG9nR3JvdXBMb2dEZXN0aW5hdGlvbihcbiAgICAgICAgICBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnQXBpQWNjZXNzTG9nR3JvdXAnLCB7XG4gICAgICAgICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2FwaWdhdGV3YXkvZ2FtZS1iYXNlLXNlcnZpY2UtJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICAgICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZXG4gICAgICAgICAgfSlcbiAgICAgICAgKSxcbiAgICAgICAgYWNjZXNzTG9nRm9ybWF0OiBhcGlnYXRld2F5LkFjY2Vzc0xvZ0Zvcm1hdC5qc29uV2l0aFN0YW5kYXJkRmllbGRzKHtcbiAgICAgICAgICBjYWxsZXI6IHRydWUsXG4gICAgICAgICAgaHR0cE1ldGhvZDogdHJ1ZSxcbiAgICAgICAgICBpcDogdHJ1ZSxcbiAgICAgICAgICBwcm90b2NvbDogdHJ1ZSxcbiAgICAgICAgICByZXF1ZXN0VGltZTogdHJ1ZSxcbiAgICAgICAgICByZXNvdXJjZVBhdGg6IHRydWUsXG4gICAgICAgICAgcmVzcG9uc2VMZW5ndGg6IHRydWUsXG4gICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgIHVzZXI6IHRydWVcbiAgICAgICAgfSksXG4gICAgICAgIFxuICAgICAgICAvLyBFbmFibGUgcmVxdWVzdC9yZXNwb25zZSBkYXRhIGxvZ2dpbmcgaW4gbm9uLXByb2R1Y3Rpb25cbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogZW52aXJvbm1lbnQgIT09ICdwcm9kdWN0aW9uJyxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nIFxuICAgICAgICAgID8gYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuRVJST1IgXG4gICAgICAgICAgOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBcbiAgICAgICAgLy8gRW5hYmxlIGRldGFpbGVkIENsb3VkV2F0Y2ggbWV0cmljc1xuICAgICAgICBtZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgXG4gICAgICAgIC8vIFRocm90dGxpbmcgY29uZmlndXJhdGlvblxuICAgICAgICB0aHJvdHRsaW5nUmF0ZUxpbWl0OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2R1Y3Rpb24nID8gMTAwMCA6IDEwMCxcbiAgICAgICAgdGhyb3R0bGluZ0J1cnN0TGltaXQ6IGVudmlyb25tZW50ID09PSAncHJvZHVjdGlvbicgPyAyMDAwIDogMjAwXG4gICAgICB9LFxuICAgICAgXG4gICAgICAvLyBEZWZhdWx0IENPUlMgY29uZmlndXJhdGlvblxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZScsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcbiAgICAgICAgICAnWC1BcGktS2V5JyxcbiAgICAgICAgICAnWC1BbXotU2VjdXJpdHktVG9rZW4nLFxuICAgICAgICAgICdYLVBsYXllci1JZCcsXG4gICAgICAgICAgJ1gtQWxsaWFuY2UtSWQnXG4gICAgICAgIF1cbiAgICAgIH0sXG5cbiAgICAgIC8vIEFQSSBHYXRld2F5IGNvbmZpZ3VyYXRpb25cbiAgICAgIGVuZHBvaW50Q29uZmlndXJhdGlvbjoge1xuICAgICAgICB0eXBlczogW2FwaWdhdGV3YXkuRW5kcG9pbnRUeXBlLlJFR0lPTkFMXVxuICAgICAgfSxcbiAgICAgIFxuICAgICAgLy8gRW5hYmxlIGJpbmFyeSBtZWRpYSB0eXBlcyBmb3IgZnV0dXJlIGZpbGUgdXBsb2Fkc1xuICAgICAgYmluYXJ5TWVkaWFUeXBlczogWydtdWx0aXBhcnQvZm9ybS1kYXRhJywgJ2ltYWdlLyonXSxcbiAgICAgIFxuICAgICAgLy8gTWluaW11bSBjb21wcmVzc2lvbiBzaXplXG4gICAgICBtaW5pbXVtQ29tcHJlc3Npb25TaXplOiAxMDAwXG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUFwaU1vZGVscygpOiBSZWNvcmQ8c3RyaW5nLCBhcGlnYXRld2F5Lk1vZGVsPiB7XG4gICAgY29uc3QgbW9kZWxzOiBSZWNvcmQ8c3RyaW5nLCBhcGlnYXRld2F5Lk1vZGVsPiA9IHt9O1xuXG4gICAgLy8gQ3JlYXRlIEJhc2UgUmVxdWVzdCBNb2RlbFxuICAgIG1vZGVscy5jcmVhdGVCYXNlUmVxdWVzdCA9IHRoaXMuYXBpLmFkZE1vZGVsKCdDcmVhdGVCYXNlUmVxdWVzdCcsIHtcbiAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICBtb2RlbE5hbWU6ICdDcmVhdGVCYXNlUmVxdWVzdCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JlcXVlc3QgbW9kZWwgZm9yIGNyZWF0aW5nIGEgbmV3IGJhc2UnLFxuICAgICAgc2NoZW1hOiB7XG4gICAgICAgIHNjaGVtYTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVmVyc2lvbi5EUkFGVDQsXG4gICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuT0JKRUNULFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgcGxheWVySWQ6IHsgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5TVFJJTkcsIG1pbkxlbmd0aDogMSwgbWF4TGVuZ3RoOiA1MCB9LFxuICAgICAgICAgIGJhc2VUeXBlOiB7IFxuICAgICAgICAgICAgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5TVFJJTkcsXG4gICAgICAgICAgICBlbnVtOiBbJ2NvbW1hbmRfY2VudGVyJywgJ291dHBvc3QnLCAnZm9ydHJlc3MnLCAnbWluaW5nX3N0YXRpb24nLCAncmVzZWFyY2hfbGFiJ11cbiAgICAgICAgICB9LFxuICAgICAgICAgIGJhc2VOYW1lOiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuU1RSSU5HLCBtaW5MZW5ndGg6IDEsIG1heExlbmd0aDogMTAwIH0sXG4gICAgICAgICAgY29vcmRpbmF0ZXM6IHtcbiAgICAgICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuT0JKRUNULFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICB4OiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuTlVNQkVSIH0sXG4gICAgICAgICAgICAgIHk6IHsgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5OVU1CRVIgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3Bhd25Mb2NhdGlvbklkOiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuU1RSSU5HIH0sXG4gICAgICAgICAgYWxsaWFuY2VJZDogeyB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLlNUUklORyB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ3BsYXllcklkJywgJ2Jhc2VUeXBlJywgJ2Jhc2VOYW1lJ11cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFVwZ3JhZGUgQmFzZSBSZXF1ZXN0IE1vZGVsXG4gICAgbW9kZWxzLnVwZ3JhZGVCYXNlUmVxdWVzdCA9IHRoaXMuYXBpLmFkZE1vZGVsKCdVcGdyYWRlQmFzZVJlcXVlc3QnLCB7XG4gICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgbW9kZWxOYW1lOiAnVXBncmFkZUJhc2VSZXF1ZXN0JyxcbiAgICAgIHNjaGVtYToge1xuICAgICAgICBzY2hlbWE6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVZlcnNpb24uRFJBRlQ0LFxuICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHBsYXllcklkOiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuU1RSSU5HLCBtaW5MZW5ndGg6IDEsIG1heExlbmd0aDogNTAgfSxcbiAgICAgICAgICBiYXNlSWQ6IHsgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5TVFJJTkcsIG1pbkxlbmd0aDogMSwgbWF4TGVuZ3RoOiA1MCB9LFxuICAgICAgICAgIHVwZ3JhZGVUeXBlOiB7XG4gICAgICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLlNUUklORyxcbiAgICAgICAgICAgIGVudW06IFsnbGV2ZWwnLCAnZGVmZW5zZScsICdzdG9yYWdlJywgJ3Byb2R1Y3Rpb24nLCAnc3BlY2lhbGl6ZWQnXVxuICAgICAgICAgIH0sXG4gICAgICAgICAgc2tpcFRpbWU6IHsgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5CT09MRUFOIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsncGxheWVySWQnLCAnYmFzZUlkJywgJ3VwZ3JhZGVUeXBlJ11cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIE1vdmUgQmFzZSBSZXF1ZXN0IE1vZGVsXG4gICAgbW9kZWxzLm1vdmVCYXNlUmVxdWVzdCA9IHRoaXMuYXBpLmFkZE1vZGVsKCdNb3ZlQmFzZVJlcXVlc3QnLCB7XG4gICAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgbW9kZWxOYW1lOiAnTW92ZUJhc2VSZXF1ZXN0JyxcbiAgICAgIHNjaGVtYToge1xuICAgICAgICBzY2hlbWE6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVZlcnNpb24uRFJBRlQ0LFxuICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHBsYXllcklkOiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuU1RSSU5HLCBtaW5MZW5ndGg6IDEsIG1heExlbmd0aDogNTAgfSxcbiAgICAgICAgICBiYXNlSWQ6IHsgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5TVFJJTkcsIG1pbkxlbmd0aDogMSwgbWF4TGVuZ3RoOiA1MCB9LFxuICAgICAgICAgIG5ld0Nvb3JkaW5hdGVzOiB7XG4gICAgICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgeDogeyB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLk5VTUJFUiB9LFxuICAgICAgICAgICAgICB5OiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuTlVNQkVSIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZXF1aXJlZDogWyd4JywgJ3knXVxuICAgICAgICAgIH0sXG4gICAgICAgICAgdXNlVGVsZXBvcnQ6IHsgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5CT09MRUFOIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsncGxheWVySWQnLCAnYmFzZUlkJywgJ25ld0Nvb3JkaW5hdGVzJ11cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIFN0YW5kYXJkIFN1Y2Nlc3MgUmVzcG9uc2UgTW9kZWxcbiAgICBtb2RlbHMuc3VjY2Vzc1Jlc3BvbnNlID0gdGhpcy5hcGkuYWRkTW9kZWwoJ1N1Y2Nlc3NSZXNwb25zZScsIHtcbiAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICBtb2RlbE5hbWU6ICdTdWNjZXNzUmVzcG9uc2UnLFxuICAgICAgc2NoZW1hOiB7XG4gICAgICAgIHNjaGVtYTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVmVyc2lvbi5EUkFGVDQsXG4gICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuT0JKRUNULFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgc3VjY2VzczogeyB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLkJPT0xFQU4gfSxcbiAgICAgICAgICBkYXRhOiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuT0JKRUNUIH0sXG4gICAgICAgICAgbWVzc2FnZTogeyB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLlNUUklORyB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ3N1Y2Nlc3MnXVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gRXJyb3IgUmVzcG9uc2UgTW9kZWxcbiAgICBtb2RlbHMuZXJyb3JSZXNwb25zZSA9IHRoaXMuYXBpLmFkZE1vZGVsKCdFcnJvclJlc3BvbnNlJywge1xuICAgICAgY29udGVudFR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgIG1vZGVsTmFtZTogJ0Vycm9yUmVzcG9uc2UnLFxuICAgICAgc2NoZW1hOiB7XG4gICAgICAgIHNjaGVtYTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVmVyc2lvbi5EUkFGVDQsXG4gICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuT0JKRUNULFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgc3VjY2VzczogeyBcbiAgICAgICAgICAgIHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuQk9PTEVBTixcbiAgICAgICAgICAgIGVudW06IFtmYWxzZV1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGVycm9yOiB7XG4gICAgICAgICAgICB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLk9CSkVDVCxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgY29kZTogeyB0eXBlOiBhcGlnYXRld2F5Lkpzb25TY2hlbWFUeXBlLlNUUklORyB9LFxuICAgICAgICAgICAgICBtZXNzYWdlOiB7IHR5cGU6IGFwaWdhdGV3YXkuSnNvblNjaGVtYVR5cGUuU1RSSU5HIH0sXG4gICAgICAgICAgICAgIGRldGFpbHM6IHsgdHlwZTogYXBpZ2F0ZXdheS5Kc29uU2NoZW1hVHlwZS5PQkpFQ1QgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2NvZGUnLCAnbWVzc2FnZSddXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydzdWNjZXNzJywgJ2Vycm9yJ11cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtb2RlbHM7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZVJlcXVlc3RWYWxpZGF0b3JzKCk6IFJlY29yZDxzdHJpbmcsIGFwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcj4ge1xuICAgIHJldHVybiB7XG4gICAgICBib2R5VmFsaWRhdG9yOiB0aGlzLmFwaS5hZGRSZXF1ZXN0VmFsaWRhdG9yKCdCb2R5VmFsaWRhdG9yJywge1xuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yTmFtZTogJ2JvZHktdmFsaWRhdG9yJyxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogdHJ1ZSxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0UGFyYW1ldGVyczogZmFsc2VcbiAgICAgIH0pLFxuICAgICAgXG4gICAgICBwYXJhbXNWYWxpZGF0b3I6IHRoaXMuYXBpLmFkZFJlcXVlc3RWYWxpZGF0b3IoJ1BhcmFtc1ZhbGlkYXRvcicsIHtcbiAgICAgICAgcmVxdWVzdFZhbGlkYXRvck5hbWU6ICdwYXJhbXMtdmFsaWRhdG9yJyxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogZmFsc2UsXG4gICAgICAgIHZhbGlkYXRlUmVxdWVzdFBhcmFtZXRlcnM6IHRydWVcbiAgICAgIH0pLFxuICAgICAgXG4gICAgICBmdWxsVmFsaWRhdG9yOiB0aGlzLmFwaS5hZGRSZXF1ZXN0VmFsaWRhdG9yKCdGdWxsVmFsaWRhdG9yJywge1xuICAgICAgICByZXF1ZXN0VmFsaWRhdG9yTmFtZTogJ2Z1bGwtdmFsaWRhdG9yJyxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0Qm9keTogdHJ1ZSxcbiAgICAgICAgdmFsaWRhdGVSZXF1ZXN0UGFyYW1ldGVyczogdHJ1ZVxuICAgICAgfSlcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVCYXNlTWFuYWdlbWVudEVuZHBvaW50cyhcbiAgICBsYW1iZGFzOiBCYXNlR2FtZUFwaXNDb25zdHJ1Y3RQcm9wc1snbGFtYmRhcyddLFxuICAgIG1vZGVsczogUmVjb3JkPHN0cmluZywgYXBpZ2F0ZXdheS5Nb2RlbD4sXG4gICAgdmFsaWRhdG9yczogUmVjb3JkPHN0cmluZywgYXBpZ2F0ZXdheS5SZXF1ZXN0VmFsaWRhdG9yPlxuICApOiB2b2lkIHtcbiAgICAvLyAvYmFzZXMgcmVzb3VyY2VcbiAgICBjb25zdCBiYXNlc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYmFzZXMnKTtcblxuICAgIC8vIFBPU1QgL2Jhc2VzIC0gQ3JlYXRlIG5ldyBiYXNlXG4gICAgYmFzZXNSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsYW1iZGFzLmNyZWF0ZUJhc2UpLCB7XG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiB2YWxpZGF0b3JzLmJvZHlWYWxpZGF0b3IsXG4gICAgICByZXF1ZXN0TW9kZWxzOiB7XG4gICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogbW9kZWxzLmNyZWF0ZUJhc2VSZXF1ZXN0XG4gICAgICB9LFxuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiAnMjAxJyxcbiAgICAgICAgICByZXNwb25zZU1vZGVsczoge1xuICAgICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBtb2RlbHMuc3VjY2Vzc1Jlc3BvbnNlXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogJzQwMCcsXG4gICAgICAgICAgcmVzcG9uc2VNb2RlbHM6IHtcbiAgICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogbW9kZWxzLmVycm9yUmVzcG9uc2VcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcblxuICAgIC8vIC9iYXNlcy97YmFzZUlkfSByZXNvdXJjZVxuICAgIGNvbnN0IGJhc2VSZXNvdXJjZSA9IGJhc2VzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tiYXNlSWR9Jyk7XG5cbiAgICAvLyBQVVQgL2Jhc2VzL3tiYXNlSWR9L3VwZ3JhZGUgLSBVcGdyYWRlIGJhc2VcbiAgICBjb25zdCB1cGdyYWRlUmVzb3VyY2UgPSBiYXNlUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3VwZ3JhZGUnKTtcbiAgICB1cGdyYWRlUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsYW1iZGFzLnVwZ3JhZGVCYXNlKSwge1xuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogdmFsaWRhdG9ycy5mdWxsVmFsaWRhdG9yLFxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguYmFzZUlkJzogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHJlcXVlc3RNb2RlbHM6IHtcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBtb2RlbHMudXBncmFkZUJhc2VSZXF1ZXN0XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBQVVQgL2Jhc2VzL3tiYXNlSWR9L21vdmUgLSBNb3ZlIGJhc2VcbiAgICBjb25zdCBtb3ZlUmVzb3VyY2UgPSBiYXNlUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ21vdmUnKTtcbiAgICBtb3ZlUmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsYW1iZGFzLm1vdmVCYXNlKSwge1xuICAgICAgcmVxdWVzdFZhbGlkYXRvcjogdmFsaWRhdG9ycy5mdWxsVmFsaWRhdG9yLFxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguYmFzZUlkJzogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHJlcXVlc3RNb2RlbHM6IHtcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiBtb2RlbHMubW92ZUJhc2VSZXF1ZXN0XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNyZWF0ZUJhc2VRdWVyeUVuZHBvaW50cyhcbiAgICBsYW1iZGFzOiBCYXNlR2FtZUFwaXNDb25zdHJ1Y3RQcm9wc1snbGFtYmRhcyddLFxuICAgIG1vZGVsczogUmVjb3JkPHN0cmluZywgYXBpZ2F0ZXdheS5Nb2RlbD4sXG4gICAgdmFsaWRhdG9yczogUmVjb3JkPHN0cmluZywgYXBpZ2F0ZXdheS5SZXF1ZXN0VmFsaWRhdG9yPlxuICApOiB2b2lkIHtcbiAgICAvLyAvcGxheWVycyByZXNvdXJjZVxuICAgIGNvbnN0IHBsYXllcnNSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3BsYXllcnMnKTtcbiAgICBjb25zdCBwbGF5ZXJSZXNvdXJjZSA9IHBsYXllcnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgne3BsYXllcklkfScpO1xuICAgIFxuICAgIC8vIC9wbGF5ZXJzL3twbGF5ZXJJZH0vYmFzZXMgcmVzb3VyY2VcbiAgICBjb25zdCBwbGF5ZXJCYXNlc1Jlc291cmNlID0gcGxheWVyUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2Jhc2VzJyk7XG4gICAgXG4gICAgLy8gR0VUIC9wbGF5ZXJzL3twbGF5ZXJJZH0vYmFzZXMgLSBMaXN0IHBsYXllciBiYXNlc1xuICAgIHBsYXllckJhc2VzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihsYW1iZGFzLmxpc3RCYXNlcyksIHtcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHZhbGlkYXRvcnMucGFyYW1zVmFsaWRhdG9yLFxuICAgICAgcmVxdWVzdFBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGgucGxheWVySWQnOiB0cnVlLFxuICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuc3RhdHVzJzogZmFsc2UsXG4gICAgICAgICdtZXRob2QucmVxdWVzdC5xdWVyeXN0cmluZy5saW1pdCc6IGZhbHNlLFxuICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcubGFzdEV2YWx1YXRlZEtleSc6IGZhbHNlLFxuICAgICAgICAnbWV0aG9kLnJlcXVlc3QucXVlcnlzdHJpbmcuaW5jbHVkZVN0YXRzJzogZmFsc2VcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIC9wbGF5ZXJzL3twbGF5ZXJJZH0vYmFzZXMve2Jhc2VJZH0gcmVzb3VyY2VcbiAgICBjb25zdCBwbGF5ZXJCYXNlUmVzb3VyY2UgPSBwbGF5ZXJCYXNlc1Jlc291cmNlLmFkZFJlc291cmNlKCd7YmFzZUlkfScpO1xuICAgIFxuICAgIC8vIEdFVCAvcGxheWVycy97cGxheWVySWR9L2Jhc2VzL3tiYXNlSWR9IC0gR2V0IGJhc2UgZGV0YWlsc1xuICAgIHBsYXllckJhc2VSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxhbWJkYXMuZ2V0QmFzZURldGFpbHMpLCB7XG4gICAgICByZXF1ZXN0VmFsaWRhdG9yOiB2YWxpZGF0b3JzLnBhcmFtc1ZhbGlkYXRvcixcbiAgICAgIHJlcXVlc3RQYXJhbWV0ZXJzOiB7XG4gICAgICAgICdtZXRob2QucmVxdWVzdC5wYXRoLnBsYXllcklkJzogdHJ1ZSxcbiAgICAgICAgJ21ldGhvZC5yZXF1ZXN0LnBhdGguYmFzZUlkJzogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjcmVhdGVTcGF3bk1hbmFnZW1lbnRFbmRwb2ludHMoXG4gICAgbGFtYmRhczogQmFzZUdhbWVBcGlzQ29uc3RydWN0UHJvcHNbJ2xhbWJkYXMnXSxcbiAgICBtb2RlbHM6IFJlY29yZDxzdHJpbmcsIGFwaWdhdGV3YXkuTW9kZWw+LFxuICAgIHZhbGlkYXRvcnM6IFJlY29yZDxzdHJpbmcsIGFwaWdhdGV3YXkuUmVxdWVzdFZhbGlkYXRvcj5cbiAgKTogdm9pZCB7XG4gICAgLy8gL3NwYXduIHJlc291cmNlXG4gICAgY29uc3Qgc3Bhd25SZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3NwYXduJyk7XG5cbiAgICAvLyBQT1NUIC9zcGF3bi9jYWxjdWxhdGUgLSBDYWxjdWxhdGUgc3Bhd24gbG9jYXRpb25cbiAgICBjb25zdCBjYWxjdWxhdGVSZXNvdXJjZSA9IHNwYXduUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2NhbGN1bGF0ZScpO1xuICAgIGNhbGN1bGF0ZVJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGxhbWJkYXMuY2FsY3VsYXRlU3Bhd25Mb2NhdGlvbiksIHtcbiAgICAgIHJlcXVlc3RWYWxpZGF0b3I6IHZhbGlkYXRvcnMuYm9keVZhbGlkYXRvclxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25maWd1cmVDb3JzKCk6IHZvaWQge1xuICAgIC8vIENPUlMgaXMgYWxyZWFkeSBjb25maWd1cmVkIGluIHRoZSBBUEkgR2F0ZXdheSBjb25zdHJ1Y3RvclxuICAgIC8vIFRoaXMgbWV0aG9kIGlzIHBsYWNlaG9sZGVyIGZvciBhZGRpdGlvbmFsIENPUlMgY29uZmlndXJhdGlvbiBpZiBuZWVkZWRcbiAgICBcbiAgICAvLyBBZGQgY3VzdG9tIENPUlMgaGVhZGVycyBpZiByZXF1aXJlZFxuICAgIGNvbnN0IGNvcnNIZWFkZXJzID0ge1xuICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSxYLUFtei1EYXRlLEF1dGhvcml6YXRpb24sWC1BcGktS2V5LFgtQW16LVNlY3VyaXR5LVRva2VuLFgtUGxheWVyLUlkLFgtQWxsaWFuY2UtSWQnLFxuICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnR0VULFBPU1QsUFVULERFTEVURSxPUFRJT05TJ1xuICAgIH07XG5cbiAgICAvLyBBZGRpdGlvbmFsIENPUlMgY29uZmlndXJhdGlvbiBjYW4gYmUgYWRkZWQgaGVyZSBpZiBuZWVkZWRcbiAgfVxufSJdfQ==
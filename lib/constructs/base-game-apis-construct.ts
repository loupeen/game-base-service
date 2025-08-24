import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { GameBaseServiceConfig } from '../config/environment-config';

export interface BaseGameApisConstructProps {
  environment: string;
  config: GameBaseServiceConfig;
  lambdas: {
    createBase: NodejsFunction;
    upgradeBase: NodejsFunction;
    moveBase: NodejsFunction;
    listBases: NodejsFunction;
    getBaseDetails: NodejsFunction;
    calculateSpawnLocation: NodejsFunction;
  };
}

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
export class BaseGameApisConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  
  constructor(scope: Construct, id: string, props: BaseGameApisConstructProps) {
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

  private createApiGateway(environment: string): apigateway.RestApi {
    return new apigateway.RestApi(this, 'GameBaseServiceApi', {
      restApiName: `game-base-service-${environment}`,
      description: `Loupeen RTS Platform - Base Building and Management API (${environment})`,
      
      // Enable CloudWatch logging
      deployOptions: {
        stageName: environment,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          new logs.LogGroup(this, 'ApiAccessLogGroup', {
            logGroupName: `/aws/apigateway/game-base-service-${environment}`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
          })
        ),
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

  private createApiModels(): Record<string, apigateway.Model> {
    const models: Record<string, apigateway.Model> = {};

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

  private createRequestValidators(): Record<string, apigateway.RequestValidator> {
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

  private createBaseManagementEndpoints(
    lambdas: BaseGameApisConstructProps['lambdas'],
    models: Record<string, apigateway.Model>,
    validators: Record<string, apigateway.RequestValidator>
  ): void {
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

  private createBaseQueryEndpoints(
    lambdas: BaseGameApisConstructProps['lambdas'],
    models: Record<string, apigateway.Model>,
    validators: Record<string, apigateway.RequestValidator>
  ): void {
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

  private createSpawnManagementEndpoints(
    lambdas: BaseGameApisConstructProps['lambdas'],
    models: Record<string, apigateway.Model>,
    validators: Record<string, apigateway.RequestValidator>
  ): void {
    // /spawn resource
    const spawnResource = this.api.root.addResource('spawn');

    // POST /spawn/calculate - Calculate spawn location
    const calculateResource = spawnResource.addResource('calculate');
    calculateResource.addMethod('POST', new apigateway.LambdaIntegration(lambdas.calculateSpawnLocation), {
      requestValidator: validators.bodyValidator
    });
  }

  private configureCors(): void {
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
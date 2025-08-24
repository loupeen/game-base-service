import * as apigateway from 'aws-cdk-lib/aws-apigateway';
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
export declare class BaseGameApisConstruct extends Construct {
    readonly api: apigateway.RestApi;
    constructor(scope: Construct, id: string, props: BaseGameApisConstructProps);
    private createApiGateway;
    private createApiModels;
    private createRequestValidators;
    private createBaseManagementEndpoints;
    private createBaseQueryEndpoints;
    private createSpawnManagementEndpoints;
    private configureCors;
}

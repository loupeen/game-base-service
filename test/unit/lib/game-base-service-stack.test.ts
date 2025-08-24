import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { GameBaseServiceStack } from '../../../lib/game-base-service-stack';

/**
 * Unit tests for GameBaseServiceStack
 * Following SOLID principles with focused testing responsibilities
 */
describe('GameBaseServiceStack', () => {
  let app: App;
  let stack: GameBaseServiceStack;
  let template: Template;

  beforeEach(() => {
    app = new App({
      context: {
        environment: 'test'
      }
    });
    
    stack = new GameBaseServiceStack(app, 'TestGameBaseServiceStack', {
      environment: 'test',
      env: {
        account: '728427470046',
        region: 'eu-north-1'
      }
    });
    
    template = Template.fromStack(stack);
  });

  describe('Stack creation and basic structure', () => {
    it('should create the stack without errors', () => {
      expect(stack).toBeDefined();
      expect(stack.config).toBeDefined();
      expect(stack.tablesConstruct).toBeDefined();
      expect(stack.lambdasConstruct).toBeDefined();
      expect(stack.apisConstruct).toBeDefined();
      expect(stack.monitoringConstruct).toBeDefined();
    });

    it('should have correct stack name and environment', () => {
      expect(stack.stackName).toContain('test');
      expect(stack.config.environment).toBe('test');
    });
  });

  describe('DynamoDB Tables', () => {
    it('should create all required DynamoDB tables', () => {
      // Verify PlayerBases table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'GameBaseService-test-PlayerBases',
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [
          { AttributeName: 'playerId', KeyType: 'HASH' },
          { AttributeName: 'baseId', KeyType: 'RANGE' }
        ]
      });

      // Verify BaseTemplates table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'GameBaseService-test-BaseTemplates',
        KeySchema: [
          { AttributeName: 'baseType', KeyType: 'HASH' },
          { AttributeName: 'templateId', KeyType: 'RANGE' }
        ]
      });

      // Verify SpawnLocations table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'GameBaseService-test-SpawnLocations',
        KeySchema: [
          { AttributeName: 'spawnRegionId', KeyType: 'HASH' },
          { AttributeName: 'spawnLocationId', KeyType: 'RANGE' }
        ]
      });

      // Verify BaseUpgrades table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'GameBaseService-test-BaseUpgrades',
        KeySchema: [
          { AttributeName: 'playerId', KeyType: 'HASH' },
          { AttributeName: 'upgradeId', KeyType: 'RANGE' }
        ]
      });
    });

    it('should create Global Secondary Indexes', () => {
      // Verify LocationIndex on PlayerBases table
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'GameBaseService-test-PlayerBases',
        GlobalSecondaryIndexes: [
          {
            IndexName: 'LocationIndex',
            KeySchema: [
              { AttributeName: 'mapSectionId', KeyType: 'HASH' }
            ]
          },
          {
            IndexName: 'AllianceIndex', 
            KeySchema: [
              { AttributeName: 'allianceId', KeyType: 'HASH' }
            ]
          },
          {
            IndexName: 'StatusIndex',
            KeySchema: [
              { AttributeName: 'status', KeyType: 'HASH' }
            ]
          }
        ]
      });
    });

    it('should configure proper deletion protection for production', () => {
      // Create production stack to test deletion protection
      const prodApp = new App({
        context: { environment: 'production' }
      });
      
      const prodStack = new GameBaseServiceStack(prodApp, 'ProdGameBaseServiceStack', {
        environment: 'production',
        env: {
          account: '123456789012',
          region: 'us-east-1'
        }
      });

      const prodTemplate = Template.fromStack(prodStack);
      
      // Production tables should have deletion protection
      prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        DeletionProtectionEnabled: true
      });
    });
  });

  describe('Lambda Functions', () => {
    it('should create all required Lambda functions', () => {
      // Create Base Lambda
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'GameBaseService-test-CreateBase',
        Runtime: 'nodejs20.x',
        Handler: 'create-base.handler',
        Architecture: 'arm64'
      });

      // Upgrade Base Lambda
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'GameBaseService-test-UpgradeBase',
        Runtime: 'nodejs20.x',
        Handler: 'upgrade-base.handler'
      });

      // Move Base Lambda
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'GameBaseService-test-MoveBase',
        Handler: 'move-base.handler'
      });

      // List Bases Lambda
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'GameBaseService-test-ListBases',
        Handler: 'list-bases.handler'
      });

      // Get Base Details Lambda
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'GameBaseService-test-GetBaseDetails',
        Handler: 'get-base-details.handler'
      });

      // Calculate Spawn Location Lambda
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'GameBaseService-test-CalculateSpawnLocation',
        Handler: 'calculate-spawn-location.handler'
      });
    });

    it('should configure Lambda environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            PLAYER_BASES_TABLE: 'GameBaseService-test-PlayerBases',
            BASE_TEMPLATES_TABLE: 'GameBaseService-test-BaseTemplates',
            SPAWN_LOCATIONS_TABLE: 'GameBaseService-test-SpawnLocations',
            BASE_UPGRADES_TABLE: 'GameBaseService-test-BaseUpgrades'
          }
        }
      });
    });

    it('should use ARM64 architecture for cost optimization', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Architecture: 'arm64'
      });
    });

    it('should configure appropriate timeouts', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        Timeout: 30
      });
    });
  });

  describe('API Gateway', () => {
    it('should create REST API', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'game-base-service-test',
        Description: 'Loupeen RTS Platform - Base Building and Management API (test)'
      });
    });

    it('should configure API Gateway deployment', () => {
      template.hasResourceProperties('AWS::ApiGateway::Deployment', {
        StageName: 'test'
      });
    });

    it('should create API resources and methods', () => {
      // Verify bases resource exists
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'bases'
      });

      // Verify players resource exists
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'players'
      });

      // Verify spawn resource exists
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'spawn'
      });

      // Verify POST method on bases
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        ResourceId: { Ref: expect.any(String) },
        RestApiId: { Ref: expect.any(String) }
      });
    });

    it('should configure CORS', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS'
      });
    });

    it('should configure request validation', () => {
      template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
        Name: 'body-validator',
        ValidateRequestBody: true,
        ValidateRequestParameters: false
      });

      template.hasResourceProperties('AWS::ApiGateway::RequestValidator', {
        Name: 'params-validator',
        ValidateRequestBody: false,
        ValidateRequestParameters: true
      });
    });
  });

  describe('CloudWatch Monitoring', () => {
    it('should create CloudWatch Dashboard', () => {
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'GameBaseService-test'
      });
    });

    it('should create SNS topic for alerts', () => {
      template.hasResourceProperties('AWS::SNS::Topic', {
        TopicName: 'game-base-service-alerts-test',
        DisplayName: 'Game Base Service Alerts (test)'
      });
    });

    it('should create CloudWatch Alarms', () => {
      // Lambda error alarms
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: expect.stringContaining('error-rate'),
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda'
      });

      // Lambda duration alarms
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: expect.stringContaining('high-duration'),
        MetricName: 'Duration',
        Namespace: 'AWS/Lambda'
      });

      // API Gateway alarms
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: '5XXError',
        Namespace: 'AWS/ApiGateway'
      });
    });
  });

  describe('IAM Permissions', () => {
    it('should grant Lambda functions DynamoDB permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: expect.arrayContaining([
            expect.objectContaining({
              Action: expect.arrayContaining([
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:Query',
                'dynamodb:Scan'
              ]),
              Effect: 'Allow',
              Resource: expect.any(Array)
            })
          ])
        }
      });
    });

    it('should grant CloudWatch permissions for monitoring', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: expect.arrayContaining([
            expect.objectContaining({
              Action: expect.arrayContaining([
                'cloudwatch:PutMetricData'
              ]),
              Effect: 'Allow'
            })
          ])
        }
      });
    });
  });

  describe('Environment-specific configuration', () => {
    it('should use different configuration for QA environment', () => {
      const qaApp = new App({
        context: { environment: 'qa' }
      });
      
      const qaStack = new GameBaseServiceStack(qaApp, 'QAGameBaseServiceStack', {
        environment: 'qa',
        env: {
          account: '077029784291',
          region: 'us-east-1'
        }
      });

      expect(qaStack.config.environment).toBe('qa');
      expect(qaStack.config.region).toBe('us-east-1');
    });

    it('should handle missing environment gracefully', () => {
      const defaultApp = new App();
      
      const defaultStack = new GameBaseServiceStack(defaultApp, 'DefaultGameBaseServiceStack');
      
      expect(defaultStack.config.environment).toBe('development');
    });
  });

  describe('Resource count validation', () => {
    it('should not exceed reasonable resource limits', () => {
      const resources = template.toJSON().Resources;
      const resourceCount = Object.keys(resources).length;
      
      // Should have reasonable number of resources (not 500+)
      expect(resourceCount).toBeLessThan(200);
      expect(resourceCount).toBeGreaterThan(20);
    });

    it('should have appropriate resource distribution', () => {
      const resources = template.toJSON().Resources;
      
      // Count different resource types
      const resourceTypes = Object.values(resources).reduce((acc: Record<string, number>, resource: any) => {
        const type = resource.Type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      // Should have expected resource types
      expect(resourceTypes['AWS::Lambda::Function']).toBeGreaterThan(5);
      expect(resourceTypes['AWS::DynamoDB::Table']).toBe(4);
      expect(resourceTypes['AWS::ApiGateway::RestApi']).toBe(1);
      expect(resourceTypes['AWS::CloudWatch::Dashboard']).toBe(1);
    });
  });
});
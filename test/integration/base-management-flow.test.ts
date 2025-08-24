import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as createBaseHandler } from '../../lambda/base-management/create-base';
import { handler as listBasesHandler } from '../../lambda/base-queries/list-bases';
import { handler as upgradeBaseHandler } from '../../lambda/base-management/upgrade-base';
import { handler as getBaseDetailsHandler } from '../../lambda/base-queries/get-base-details';
import { 
  createMockAPIGatewayEvent,
  TEST_PLAYER_ID
} from '../fixtures/test-data';

/**
 * Integration tests for complete base management flow
 * These tests validate the entire workflow from base creation to management
 */
describe('Base Management Integration Flow', () => {
  const integrationPlayerId = `integration-test-${Date.now()}`;
  let createdBaseId: string;

  // Skip integration tests if not in integration test environment
  beforeAll(() => {
    if (process.env.TEST_ENV !== 'integration') {
      console.log('⚠️  Skipping integration tests - set TEST_ENV=integration to run');
    }
  });

  describe('Complete base lifecycle', () => {
    it('should complete full base creation and management flow', async () => {
      // Skip if not integration environment
      if (process.env.TEST_ENV !== 'integration') {
        return;
      }

      // Step 1: List bases (should be empty initially)
      const initialListEvent = createMockAPIGatewayEvent(
        null, 
        { playerId: integrationPlayerId }
      );
      
      const initialList = await listBasesHandler(initialListEvent);
      expect(initialList.statusCode).toBe(200);
      
      const initialBody = JSON.parse(initialList.body);
      expect(initialBody.data.bases).toHaveLength(0);
      expect(initialBody.data.summary.totalBases).toBe(0);

      // Step 2: Create a new base
      const createBaseEvent = createMockAPIGatewayEvent({
        playerId: integrationPlayerId,
        baseType: 'command_center',
        baseName: 'Integration Test HQ',
        coordinates: { x: 1000, y: 2000 },
        allianceId: 'test-alliance-123'
      });

      const createResult = await createBaseHandler(createBaseEvent);
      expect(createResult.statusCode).toBe(201);
      
      const createBody = JSON.parse(createResult.body);
      expect(createBody.success).toBe(true);
      expect(createBody.data.base).toMatchObject({
        playerId: integrationPlayerId,
        baseType: 'command_center',
        baseName: 'Integration Test HQ',
        level: 1,
        status: 'building'
      });
      
      createdBaseId = createBody.data.base.baseId;
      expect(createdBaseId).toBeDefined();

      // Step 3: List bases again (should show the new base)
      const updatedListEvent = createMockAPIGatewayEvent(
        null,
        { playerId: integrationPlayerId }
      );
      
      const updatedList = await listBasesHandler(updatedListEvent);
      expect(updatedList.statusCode).toBe(200);
      
      const updatedBody = JSON.parse(updatedList.body);
      expect(updatedBody.data.bases).toHaveLength(1);
      expect(updatedBody.data.bases[0].baseId).toBe(createdBaseId);
      expect(updatedBody.data.summary.totalBases).toBe(1);

      // Step 4: Get detailed base information
      const detailsEvent = createMockAPIGatewayEvent(
        null,
        { 
          playerId: integrationPlayerId, 
          baseId: createdBaseId 
        }
      );
      
      const detailsResult = await getBaseDetailsHandler(detailsEvent);
      expect(detailsResult.statusCode).toBe(200);
      
      const detailsBody = JSON.parse(detailsResult.body);
      expect(detailsBody.success).toBe(true);
      expect(detailsBody.data.base).toMatchObject({
        playerId: integrationPlayerId,
        baseId: createdBaseId,
        baseName: 'Integration Test HQ',
        baseType: 'command_center'
      });
      expect(detailsBody.data.metrics).toBeDefined();
      expect(detailsBody.data.activeUpgrades).toEqual([]);

    }, 120000); // 2 minute timeout for integration test

    it('should handle base upgrade workflow', async () => {
      // Skip if not integration environment
      if (process.env.TEST_ENV !== 'integration' || !createdBaseId) {
        return;
      }

      // Step 1: Attempt to upgrade the base
      const upgradeEvent = createMockAPIGatewayEvent(
        {
          playerId: integrationPlayerId,
          baseId: createdBaseId,
          upgradeType: 'level',
          skipTime: false
        },
        { baseId: createdBaseId }
      );

      const upgradeResult = await upgradeBaseHandler(upgradeEvent);
      expect(upgradeResult.statusCode).toBe(200);
      
      const upgradeBody = JSON.parse(upgradeResult.body);
      expect(upgradeBody.success).toBe(true);
      expect(upgradeBody.data.upgrade).toMatchObject({
        baseId: createdBaseId,
        upgradeType: 'level',
        fromLevel: 1,
        toLevel: 2,
        status: 'in_progress'
      });

      // Step 2: Verify base details show the active upgrade
      const detailsAfterUpgrade = createMockAPIGatewayEvent(
        null,
        { 
          playerId: integrationPlayerId, 
          baseId: createdBaseId 
        }
      );
      
      const detailsResult = await getBaseDetailsHandler(detailsAfterUpgrade);
      expect(detailsResult.statusCode).toBe(200);
      
      const detailsBody = JSON.parse(detailsResult.body);
      expect(detailsBody.data.activeUpgrades).toHaveLength(1);
      expect(detailsBody.data.activeUpgrades[0]).toMatchObject({
        upgradeType: 'level',
        status: 'in_progress'
      });

    }, 60000); // 1 minute timeout

    it('should handle instant upgrade with gold cost', async () => {
      // Skip if not integration environment or no base
      if (process.env.TEST_ENV !== 'integration' || !createdBaseId) {
        return;
      }

      // Create another base for instant upgrade test
      const createSecondBaseEvent = createMockAPIGatewayEvent({
        playerId: integrationPlayerId,
        baseType: 'outpost',
        baseName: 'Integration Outpost',
        coordinates: { x: 1500, y: 2500 }
      });

      const createResult = await createBaseHandler(createSecondBaseEvent);
      expect(createResult.statusCode).toBe(201);
      
      const createBody = JSON.parse(createResult.body);
      const secondBaseId = createBody.data.base.baseId;

      // Perform instant upgrade
      const instantUpgradeEvent = createMockAPIGatewayEvent(
        {
          playerId: integrationPlayerId,
          baseId: secondBaseId,
          upgradeType: 'level',
          skipTime: true
        },
        { baseId: secondBaseId }
      );

      const upgradeResult = await upgradeBaseHandler(instantUpgradeEvent);
      expect(upgradeResult.statusCode).toBe(200);
      
      const upgradeBody = JSON.parse(upgradeResult.body);
      expect(upgradeBody.success).toBe(true);
      expect(upgradeBody.data.upgrade.status).toBe('completed');
      expect(upgradeBody.data.goldCost).toBeGreaterThan(0);

    }, 60000);
  });

  describe('Error scenarios and edge cases', () => {
    it('should handle base limit restrictions', async () => {
      // Skip if not integration environment
      if (process.env.TEST_ENV !== 'integration') {
        return;
      }

      const limitPlayerId = `limit-test-${Date.now()}`;
      
      // Try to create 6 bases (exceeds free limit of 5)
      const createPromises = [];
      for (let i = 1; i <= 6; i++) {
        const event = createMockAPIGatewayEvent({
          playerId: limitPlayerId,
          baseType: 'outpost',
          baseName: `Limit Test Base ${i}`,
          coordinates: { x: i * 100, y: i * 100 }
        });
        createPromises.push(createBaseHandler(event));
      }

      const results = await Promise.all(createPromises);
      
      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        expect(results[i].statusCode).toBe(201);
      }
      
      // 6th should fail due to limit
      expect(results[5].statusCode).toBe(400);
      const errorBody = JSON.parse(results[5].body);
      expect(errorBody.error.code).toBe('BASE_LIMIT_REACHED');

    }, 90000);

    it('should handle concurrent upgrade attempts', async () => {
      // Skip if not integration environment or no base
      if (process.env.TEST_ENV !== 'integration' || !createdBaseId) {
        return;
      }

      // Create a new base for this test
      const createBaseEvent = createMockAPIGatewayEvent({
        playerId: integrationPlayerId,
        baseType: 'command_center',
        baseName: 'Concurrent Test Base',
        coordinates: { x: 3000, y: 4000 }
      });

      const createResult = await createBaseHandler(createBaseEvent);
      const testBaseId = JSON.parse(createResult.body).data.base.baseId;

      // Attempt concurrent upgrades
      const upgrade1Event = createMockAPIGatewayEvent(
        {
          playerId: integrationPlayerId,
          baseId: testBaseId,
          upgradeType: 'level'
        },
        { baseId: testBaseId }
      );

      const upgrade2Event = createMockAPIGatewayEvent(
        {
          playerId: integrationPlayerId,
          baseId: testBaseId,
          upgradeType: 'defense'
        },
        { baseId: testBaseId }
      );

      const [result1, result2] = await Promise.all([
        upgradeBaseHandler(upgrade1Event),
        upgradeBaseHandler(upgrade2Event)
      ]);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter(r => r.statusCode === 200).length;
      const errorCount = [result1, result2].filter(r => r.statusCode === 400).length;
      
      expect(successCount).toBe(1);
      expect(errorCount).toBe(1);

    }, 60000);
  });

  // Cleanup after all tests
  afterAll(async () => {
    if (process.env.TEST_ENV === 'integration') {
      console.log('🧹 Integration test cleanup would happen here');
      // TODO: Clean up test data from DynamoDB tables
      // This would involve deleting all bases created during tests
    }
  });
});
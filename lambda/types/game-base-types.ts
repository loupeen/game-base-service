/**
 * Game Base Service Type Definitions
 * Provides strong typing for all Lambda functions and data structures
 */

// Base game object interfaces
export interface Coordinates {
  x: number;
  y: number;
}

export interface BaseStats {
  defense: number;
  storage: number;
  production: number;
}

export interface BaseTemplate {
  templateId: string;
  baseType: string;
  level: number;
  requirements: {
    resources: Record<string, number>;
    playerLevel: number;
  };
  stats: BaseStats;
  buildTime: number;
}

export interface PlayerBase {
  playerId: string;
  baseId: string;
  baseType: string;
  baseName: string;
  level: number;
  coordinates: Coordinates;
  mapSectionId: string;
  coordinateHash: string;
  allianceId?: string;
  status: 'active' | 'building' | 'moving' | 'destroyed';
  stats: BaseStats;
  createdAt: number;
  lastActiveAt: number;
  buildCompletionTime?: number;
  lastMovedAt?: number;
  arrivalTime?: number;
  ttl?: number;
}

export interface SpawnLocation {
  spawnRegionId: string;
  spawnLocationId: string;
  coordinates: Coordinates;
  isAvailable: boolean;
}

export interface BaseUpgradeTemplate {
  templateId: string;
  baseType: string;
  fromLevel: number;
  toLevel: number;
  requirements: {
    resources: Record<string, number>;
    playerLevel: number;
  };
  stats: BaseStats;
  buildTime: number;
}

// API Request/Response types
export interface CreateBaseRequest {
  playerId: string;
  baseType: 'command_center' | 'outpost' | 'fortress' | 'mining_station' | 'research_lab';
  baseName: string;
  coordinates?: Coordinates;
  spawnLocationId?: string;
  allianceId?: string;
}

export interface MoveBaseRequest {
  playerId: string;
  baseId: string;
  coordinates: Coordinates;
  instant?: boolean;
}

export interface UpgradeBaseRequest {
  playerId: string;
  baseId: string;
  upgradeType: 'level' | 'defense' | 'storage' | 'production' | 'specialized';
  instant?: boolean;
}

export interface GetBaseDetailsRequest {
  playerId: string;
  baseId: string;
  includeNeighbors?: boolean;
}

export interface ListBasesRequest {
  playerId: string;
  status?: 'active' | 'building' | 'moving' | 'destroyed' | 'all';
  limit?: number;
  lastEvaluatedKey?: string;
  includeStats?: boolean;
}

// API Response types
export interface BaseSummary {
  totalBases: number;
  activeBases: number;
  buildingBases: number;
  movingBases: number;
  destroyedBases: number;
  baseTypes: Record<string, number>;
  averageLevel: number;
  maxLevel: number;
  maxBasesAllowed: number;
  canCreateMore: boolean;
  oldestBase: number | null;
  newestBase: number | null;
}

export interface BaseNeighbor {
  playerId: string;
  baseId: string;
  baseName: string;
  coordinates: Coordinates;
  distance: number;
  level: number;
  allianceId?: string;
  isAlly: boolean;
  isEnemy: boolean;
}

export interface BaseDefense {
  currentStrength: number;
  maxStrength: number;
  repairTimeRemaining?: number;
}

// Extended base information for detailed views
export interface EnrichedPlayerBase extends PlayerBase {
  isActive: boolean;
  isUpgrading: boolean;
  canMove: boolean;
  location: string;
  ageInDays: number;
  completionIn?: number;
  arrivalIn?: number;
  neighbors?: BaseNeighbor[];
  defenseInfo?: BaseDefense;
  nextLevelStats?: BaseStats;
}

// DynamoDB query result types
export interface QueryResult<T> {
  items: T[];
  lastEvaluatedKey?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    lastEvaluatedKey?: string;
    hasMore: boolean;
  };
}
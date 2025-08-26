// Node.js environment type declarations
declare namespace NodeJS {
  interface ProcessEnv {
    PLAYER_BASES_TABLE?: string;
    BASE_TEMPLATES_TABLE?: string;
    SPAWN_LOCATIONS_TABLE?: string;
    BASE_UPGRADES_TABLE?: string;
    ENVIRONMENT?: string;
    AWS_REGION?: string;
    NODE_ENV?: string;
  }
}
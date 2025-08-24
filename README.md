# Game Base Service

Loupeen RTS Platform - Base Building and Management Service

## Overview

The Game Base Service handles all base-related operations in the Loupeen RTS Platform, including base creation, upgrades, movement, and spawn location calculation.

## Documentation

Complete documentation is available in the [claude-docs repository](https://github.com/loupeen/claude-docs).

## Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run all quality checks
npm run quality
```

## Architecture

This service follows domain-driven design principles with:
- **Base Management**: Create, upgrade, move operations
- **Base Queries**: List bases, get details  
- **Spawn Management**: Calculate optimal spawn locations
- **Monitoring**: CloudWatch dashboards and alarms

## Testing

- Unit tests: `test/unit/`
- Integration tests: `test/integration/`
- Smoke tests: `test/integration/smoke/`

Coverage requirements:
- Unit tests: 80% statements, 70% branches, 75% functions, 80% lines
- Core business logic: 85% statements, 75% branches, 80% functions, 85% lines

## Deployment

```bash
# Deploy to test environment
npm run deploy:test

# Deploy to QA environment  
npm run deploy:qa
```

## Dependencies

See [claude-docs](https://github.com/loupeen/claude-docs) for shared library dependencies and platform architecture.

## License

UNLICENSED - Private Loupeen RTS Platform code

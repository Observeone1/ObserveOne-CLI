# ObserveOne CLI: Monitoring as Code Feature Specification

## Feature Overview

The "Monitoring as Code" (MaC) feature will allow users to define, test, and deploy browser checks using code files stored in their local repositories. This follows the industry-standard approach pioneered by tools like Checkly, allowing tests to be version-controlled alongside application code.

## Business Objectives

- Enable Infrastructure as Code (IaC) practices for monitoring
- Allow tests to be stored in version control systems (Git)
- Enable collaborative development of monitoring definitions
- Support CI/CD integration for automated deployment
- Provide local testing capabilities before deployment

## User Stories

1. **As a developer**, I want to define browser checks in code files so that I can track changes in version control.

2. **As a DevOps engineer**, I want to deploy test definitions from my CI/CD pipeline so that monitoring stays in sync with application changes.

3. **As a QA engineer**, I want to test my monitoring definitions locally before deploying them to production.

4. **As a team lead**, I want to review monitoring changes in pull requests before they're deployed to ensure quality.

## Functional Requirements

### R1: Project Initialization

- The CLI shall provide an `init` command to set up a new project
- The command shall create a configuration file (`.observeone.config.json`)
- The command shall create a recommended directory structure for test definitions
- The command shall allow users to specify project name, description, and default options

### R2: Test Definition Support

- The CLI shall support multiple test definition formats: JavaScript (.obs.js), JSON (.obs.json), and YAML (.obs.yaml)
- Test definitions shall include required fields: name, url, prompt
- Test definitions shall support optional fields: description, schedule configuration, assertions
- The CLI shall validate test definitions before deployment

### R3: Local Testing

- The CLI shall provide a `test` command to validate definitions locally
- The command shall validate syntax and structure of test definitions
- The command shall optionally allow dry-run execution to verify test functionality
- The command shall provide detailed error reporting for invalid definitions

### R4: Deployment

- The CLI shall provide a `deploy` command to sync local definitions to the platform
- The command shall create new tests on the platform for new definitions
- The command shall update existing tests for modified definitions
- The command shall support selective deployment (specific files or all files)
- The command shall provide feedback on deployment success/failure

### R5: Backward Compatibility

- The CLI shall maintain all existing functionality (login, list, ai-check)
- The CLI shall continue to work with existing platform APIs
- New commands shall not break existing workflows

## Non-Functional Requirements

### NFR1: Security

- API keys shall continue to be stored securely
- Test definitions shall not expose sensitive credentials
- Authentication shall be required for deployment operations

### NFR2: Performance

- The CLI shall handle bulk operations efficiently
- Deployment shall support parallel processing where appropriate
- Local validation shall be fast to enable tight development loops

### NFR3: Reliability

- Deployment shall include proper error handling and recovery
- The CLI shall provide clear error messages when operations fail
- Network timeouts and retries shall be properly configured

## API Integration Points

The new commands will use the following backend API endpoints:

- `GET /api/browser-checks` - List existing tests (for diff operations)
- `POST /api/browser-checks` - Create new tests
- `PUT /api/browser-checks/:id` - Update existing tests
- `DELETE /api/browser-checks/:id` - Delete tests (for cleanup operations)

## Command Specifications

### `obs init`

Initialize a new ObserveOne project

```
obs init [options]
```

Options:

- `--project-name` - Name of the project (interactive if not provided)
- `--description` - Project description
- `--directory` - Directory to initialize (defaults to current directory)

### `obs deploy`

Deploy local test definitions to the platform

```
obs deploy [options] [files...]
```

Options:

- `--all` - Deploy all test definition files in the project
- `--preview` - Show what would be deployed without making changes
- `--dry-run` - Validate definitions without deploying
- `--include` - Glob pattern for files to include
- `--exclude` - Glob pattern for files to exclude

### `obs test`

Test definitions locally

```
obs test [options] [files...]
```

Options:

- `--all` - Test all definition files
- `--validate-only` - Only validate syntax, don't execute
- `--verbose` - Show detailed validation output
- `--fail-fast` - Stop on first validation error

## File Format Specifications

### JavaScript Format (.obs.js)

```javascript
export default {
  // Required fields
  name: "Test Name",
  url: "https://example.com",
  prompt: "Natural language instructions for the test",
  
  // Optional fields
  description: "Description of the test",
  schedule: "CRON expression or human-readable schedule",
  assertions: [
    {
      type: "status|responseTime|text|element",
      operator: "equals|not_equals|greater_than|less_than|contains|matches",
      value: "expected value"
    }
  ],
  config: {
    timeout: 30000,
    retries: 3,
    region: "us-east-1"
  }
}
```

### JSON Format (.obs.json)

```json
{
  "name": "Test Name",
  "url": "https://example.com",
  "prompt": "Natural language instructions for the test",
  "description": "Description of the test"
}
```

### YAML Format (.obs.yaml)

```yaml
name: "Test Name"
url: "https://example.com"
prompt: "Natural language instructions for the test"
description: "Description of the test"
```

## Error Handling

### Validation Errors

- Invalid file format
- Missing required fields
- Invalid field values
- Duplicate test names in a single deployment

### Runtime Errors

- Authentication failures
- Network connectivity issues
- API rate limiting
- Backend service unavailability

## Testing Strategy

### Unit Tests

- Test file loading and parsing
- Validate command option parsing
- Test API client interactions with mocks
- Test error handling paths

### Integration Tests

- Test actual API interactions with a test environment
- Test the complete deploy workflow
- Test backward compatibility with existing functionality

### End-to-End Tests

- Test the full developer workflow from init to deploy
- Test CI/CD integration scenarios

## Deployment Considerations

### Versioning

- New functionality shall be released in a backward-compatible manner
- Major version updates may include breaking changes with migration guides

### Rollout Strategy

- Feature flags for early testing
- Gradual rollout to different user segments
- Monitoring and alerting for new functionality

## Success Metrics

- Adoption rate of new commands
- Reduction in manual monitoring configuration
- User satisfaction with the MaC workflow
- Reduction in deployment errors through better validation

## Dependencies

- Node.js 16+ runtime
- TypeScript compilation tools
- File system access for reading definition files
- Network access for API communication

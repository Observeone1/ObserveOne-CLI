# ObserveOne Backend Documentation

## Project Overview

ObserveOne is an AI-powered application monitoring platform that allows users to define, run, and monitor tests using natural language instructions. The platform combines AI with traditional monitoring approaches to provide comprehensive application monitoring.

## Architecture Overview

The backend is built with Node.js/TypeScript and follows a service/controller pattern with the following key components:

- **Database**: Supabase (PostgreSQL-based)
- **Caching**: Redis for session management and task queues
- **Authentication**: JWT-based with Supabase integration
- **Task Management**: Redis-based task queue system
- **API Framework**: Express.js with modular routing

## Current Features

### Browser Checks

- Natural language test definition and execution
- Screenshot and step-by-step execution results
- Real-time task updates via Server-Sent Events
- Test scheduling and execution history

### API Checks

- HTTP endpoint monitoring with configurable assertions
- Response validation and performance tracking
- Scheduled execution

### URL Monitors

- Website uptime monitoring
- Response time tracking
- SSL certificate monitoring

### Heartbeat Monitors

- External service health checks
- Interval-based monitoring

### Playwright Tests

- Code-based test execution
- Advanced browser automation

### Team Management

- Multi-user collaboration
- Team-based test management
- Role-based access control

### Subscription & Payments

- Usage-based billing
- Plan management
- Test execution limits

## API Structure

### Main Endpoints

- `GET /api/browser-checks` - List all browser tests
- `POST /api/browser-checks` - Create a new browser test
- `GET /api/browser-checks/:id` - Get a specific browser test
- `PUT /api/browser-checks/:id` - Update a browser test
- `DELETE /api/browser-checks/:id` - Delete a browser test
- `POST /api/browser-checks/:id/execute` - Execute a browser test
- `POST /api/browser-checks/execute-adhoc` - Execute ad-hoc test

- `GET /api/api-checks` - List all API checks
- `POST /api/api-checks` - Create a new API check
- `GET /api/api-checks/:id` - Get a specific API check
- `PUT /api/api-checks/:id` - Update an API check
- `DELETE /api/api-checks/:id` - Delete an API check

- `GET /api/url-monitors` - List all URL monitors
- `POST /api/url-monitors` - Create a new URL monitor
- And more for other service types

### Authentication

All endpoints (except health and public routes) require authentication via JWT token in the Authorization header:

```text
Authorization: Bearer <jwt_token>
```

## Database Schema

The application uses Supabase with Row Level Security (RLS) policies to ensure data isolation between users. The main tables include:

- `tests` - Stores test definitions (name, URL, prompt, etc.)
- `test_executions` - Tracks test execution history
- `test_step_results` - Stores detailed execution results
- `users` - User account information
- `teams` - Team management
- `subscriptions` - Billing information
- And more for specific feature sets

## Development Setup

1. **Database**: Requires PostgreSQL 16.2 and Redis
2. **Environment**: Use the `docker-compose.local.yml` file to start services
3. **Dependencies**: Run `npm install` to install dependencies
4. **Configuration**: Set environment variables in `.env` file

## Environment Variables

Key environment variables include:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `REDIS_URL` - Redis connection string
- Various JWT and payment configuration variables

## Monitoring as Code Architecture

The planned "Monitoring as Code" feature will allow users to define tests in local files and deploy them to the platform. Current implementation includes:

- CLI tool (obs1/observeone) for local development
- Test definition file formats (.obs1.js, .obs1.json, .obs1.yaml)
- Deploy and test commands for local workflow
- Integration with the backend API endpoints

## Current CLI Commands

The CLI currently supports:

- `obs1 login` - Authenticate with the platform
- `obs1 list` - List all tests
- `obs1 ai-check` - Execute tests (existing or ad-hoc)

Planned additions:

- `obs1 deploy` - Deploy local test definitions to the platform
- `obs1 test` - Test definitions locally before deployment
- `obs1 init` - Initialize a new project

## Services Architecture

The backend follows a service-oriented architecture:

- **Controllers** - Handle API routes and request/response logic
- **Services** - Business logic and database operations
- **Models** - TypeScript interfaces and data structures
- **Middleware** - Authentication and validation layers

## Error Handling

The system implements comprehensive error handling with appropriate HTTP status codes:

- 200 - Success
- 400 - Bad Request (validation errors)
- 401 - Unauthorized (missing/invalid authentication)
- 403 - Forbidden (permission denied)
- 404 - Not Found
- 500 - Internal Server Error

## Security

- Row Level Security (RLS) in the database ensures users only access their own data
- JWT-based authentication with proper token validation
- Input validation on all API endpoints
- Rate limiting and usage quotas per subscription plan

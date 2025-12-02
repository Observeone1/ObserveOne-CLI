# ObserveOne CLI Deployment Guide

## Current Status

✅ **Ready for NPM Publishing**

- Package builds successfully
- All tests pass
- Simplified CLI with 3 core commands: `login`, `list`, `ai-check`
- Environment-configurable for deployment

## Deployment Options

### Option 1: NPM Registry (Recommended)

**For public distribution:**

```bash
# 1. Login to NPM
npm login

# 2. Publish to NPM
npm publish

# 3. Users can install globally
npm install -g @observeone/cli

# 4. Or use with npx
npx @observeone/cli --help
```

**Package Details:**

- **Name**: `@observeone/cli`
- **Version**: `1.0.0`
- **Size**: ~19.3 kB (90 kB unpacked)
- **Node**: >=16.0.0
- **Files**: dist/, README.md

### Option 2: Private NPM Registry

**For internal/private distribution:**

```bash
# Configure private registry
npm config set registry https://your-private-registry.com

# Publish to private registry
npm publish --registry https://your-private-registry.com
```

### Option 3: GitHub Packages

**For GitHub-hosted packages:**

```bash
# Configure GitHub packages
npm config set @yourorg:registry https://npm.pkg.github.com

# Publish to GitHub packages
npm publish
```

### Option 4: Direct Distribution

**For direct file distribution:**

```bash
# Build the package
npm run build

# Create tarball
npm pack

# Distribute @observeone/cli-1.0.0.tgz
# Users install with: npm install -g @observeone/cli-1.0.0.tgz
```

## Environment Configuration

### For CLI Maintainers (Build Time)

Set these environment variables when building the CLI:

```bash
# Production build
export OBS1_API_URL=https://api.observeone.com
npm run build
npm publish

# Development build
export OBS1_API_URL=http://localhost:3000
npm run build
```

### For Users (Runtime)

Users can configure via environment variables:

```bash
# Authentication (optional - can also use obs1 login)
export OBS1_API_KEY=your-api-key

# Output format
export OBS1_JSON_OUTPUT=true
export OBS1_VERBOSE=true
```

## Pre-Deployment Checklist

- [x] ✅ Package builds successfully (`npm run build`)
- [x] ✅ README updated with simplified commands
- [x] ✅ TypeScript types are correct
- [x] ✅ Package.json has correct bin entry
- [x] ✅ Files array includes only necessary files
- [x] ✅ Version is set correctly (1.0.0)
- [x] ✅ Dependencies are properly specified
- [x] ✅ No sensitive data in package

## Post-Deployment

### Update Documentation

1. Update main ObserveOne docs to reference the CLI
2. Add installation instructions to main README
3. Update API documentation with CLI examples

### User Onboarding

1. Create getting started guide
2. Add CLI examples to main documentation
3. Update CI/CD examples with new simplified commands

## Commands After Deployment

Users will have access to:

```bash
# Authentication + project setup
obs1 login

# List available tests
obs1 list

# Run tests (with automatic waiting)
obs1 ai-check "test-name"

# Ad-hoc testing
obs1 ai-check --url https://example.com --prompt "test instructions"
```

## Version Management

For future updates:

```bash
# Update version
npm version patch  # 1.0.1
npm version minor  # 1.1.0
npm version major  # 2.0.0

# Publish new version
npm publish
```

## Rollback Plan

If issues arise:

```bash
# Unpublish (within 24 hours)
npm unpublish @observeone/cli@1.0.0

# Or publish fixed version
npm version patch
npm publish
```

## Monitoring

After deployment, monitor:

1. **Download stats**: `npm view @observeone/cli downloads`
2. **User feedback**: GitHub issues, Discord
3. **Error reports**: Check for common usage errors
4. **Performance**: Monitor API calls from CLI

## Next Steps

1. **Deploy to NPM**: `npm publish`
2. **Update main docs**: Add CLI installation instructions
3. **Create examples**: Add CLI usage examples
4. **Monitor usage**: Track downloads and user feedback
5. **Iterate**: Collect feedback for v1.1.0

---

**Ready to deploy!** 🚀

# Publishing ObserveOne CLI to NPM - Complete Guide

This guide walks you through publishing the `@observeone/cli` package to the npm registry.

---

## Prerequisites

### 1. NPM Account Setup

**Create an NPM account** (if you don't have one):

```bash
# Visit https://www.npmjs.com/signup
# Or create from CLI
npm adduser
```

**Login to your NPM account**:

```bash
npm login
```

**Setup Two-Factor Authentication (2FA)** (required for publishing):

1. Go to <https://www.npmjs.com/settings/your-username/tfa>
2. Enable 2FA for authorization and publishing
3. Save backup codes

**Verify Organization Access**:

- The package is scoped to `@observeone`
- You need to be a member of the `observeone` npm organization
- Ask your team lead to add you: <https://www.npmjs.com/settings/observeone/members>

---

## Pre-Publish Checklist

### 1. Review Package.json

Current configuration looks good:

- ✅ Package name: `@observeone/cli`
- ✅ Version: `1.0.1`
- ✅ Binary command: `obs1`
- ✅ Build script: `prepublishOnly` hook configured
- ✅ Files to include: `dist`, `README.md`

### 2. Update Version Number

Follow [Semantic Versioning](https://semver.org/):

```bash
# For patches (bug fixes): 1.0.1 → 1.0.2
npm version patch

# For minor changes (new features): 1.0.1 → 1.1.0
npm version minor

# For major changes (breaking changes): 1.0.1 → 2.0.0
npm version major

# Or manually specify version
npm version 1.0.2
```

This will:

- Update `package.json` version
- Create a git commit
- Create a git tag

### 3. Create Changelog

Document what's new in this version:

**Create/Update `CHANGELOG.md`**:

```markdown
# Changelog

## [1.0.2] - 2025-11-30

### Added
- New feature X
- Support for Y

### Fixed
- Bug fix Z

### Changed
- Improved error messages
```

### 4. Verify Build

```bash
# Clean previous build
rm -rf dist

# Build the project
npm run build

# Verify dist directory exists and contains JS files
ls dist/
```

### 5. Test Build Locally

```bash
# Link package locally
npm link

# Test the CLI globally
obs1 --version
obs1 login --help

# Run a quick test
obs1 list  # (if authenticated)

# Unlink when done
npm unlink -g @observeone/cli
```

### 6. Run Checks

```bash
# Check TypeScript compilation
npm run check
```

---

## Publishing Process

### Method 1: Standard Publish (Recommended)

```bash
# 1. Ensure you're on the right branch
git checkout main
git pull origin main

# 2. Update version (creates git tag)
npm version patch  # or minor/major

# 3. Build and publish (prepublishOnly runs automatically)
npm publish --access public

# 4. Push changes and tags to GitHub
git push origin main
git push origin --tags
```

### Method 2: Beta/Pre-release Publish

For testing before official release:

```bash
# Update to beta version
npm version 1.0.2-beta.0

# Publish as beta
npm publish --tag beta --access public

# Users can install with:
# npm install @observeone/cli@beta
```

### Method 3: Dry Run (Test Without Publishing)

```bash
# See what would be published
npm publish --dry-run
```

---

## Post-Publish Verification

### 1. Verify on NPM Registry

```bash
# Check package page
# Visit: https://www.npmjs.com/package/@observeone/cli

# View package info
npm view @observeone/cli
```

### 2. Test Installation

```bash
# In a new directory or clean environment
npm install -g @observeone/cli

# Verify installation
obs1 --version

# Test commands
obs1 --help
```

### 3. Update Documentation

- Update main project README if needed
- Update ObserveOne website documentation
- Notify team in Slack/Discord

---

## Version Management

### Current Version: 1.0.1

**Recommended versioning strategy**:

- **Patch releases** (1.0.x): Bug fixes, minor improvements
- **Minor releases** (1.x.0): New features, backward compatible
- **Major releases** (x.0.0): Breaking changes

### Tag Format

Git tags are created automatically by `npm version`:

- `v1.0.2` for version 1.0.2
- Push tags: `git push origin --tags`

---

## Troubleshooting

### Issue: "You must sign up for private packages"

**Solution**: Add `--access public` flag:

```bash
npm publish --access public
```

### Issue: "You do not have permission to publish"

**Solutions**:

1. Verify you're logged in: `npm whoami`
2. Check organization membership
3. Verify 2FA is configured
4. Contact organization admin to grant publish rights

### Issue: "Version already exists"

**Solution**: Bump version number:

```bash
npm version patch
npm publish --access public
```

### Issue: "prepublishOnly script failed"

**Solution**: Fix build errors:

```bash
# Check build
npm run build

# Check TypeScript errors
npm run check
```

### Issue: Package includes wrong files

**Solution**: Check what will be published:

```bash
# See files to be included
npm pack --dry-run

# Verify .npmignore is correct
cat .npmignore
```

---

## CI/CD Publishing (Future Enhancement)

For automated publishing via GitHub Actions:

**Create `.github/workflows/publish.yml`**:

```yaml
name: Publish to NPM

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Setup**:

1. Go to <https://www.npmjs.com/settings/your-username/tokens>
2. Create "Automation" token
3. Add to GitHub Secrets as `NPM_TOKEN`

---

## Quick Reference

```bash
# Complete publish workflow
git checkout main
git pull origin main
npm version patch              # Updates version, creates tag
npm publish --access public     # Publish
git push origin main --tags     # Push to GitHub

# Verify
npm view @observeone/cli
npm install -g @observeone/cli
obs1 --version
```

---

## Package Information

- **Name**: `@observeone/cli`
- **Current Version**: `1.0.1`
- **Registry**: <https://www.npmjs.com/package/@observeone/cli>
- **Binary**: `obs1`
- **License**: MIT
- **Node Version**: >=16.0.0

---

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review npm docs: <https://docs.npmjs.com/>
3. Ask in team chat
4. Check npm status: <https://status.npmjs.org/>

**Happy Publishing! 🚀**

# REBRANDING TODO: Demiurge → Holistix

**Status**: 🟢 IN PROGRESS - Phase 4 & 2 Complete  
**Target Brand**: Holistix Forge  
**GitHub Org**: **`HolistixForge`** ✅ SECURED  
**Repo Name**: **`platform`** ✅  
**Package Namespace**: **`@holistix-forge/*`** ✅ DONE  
**Docker Prefix**: **`holistixforge/*`** (no hyphen) ✅ SECURED  
**NPM Org**: **`holistix-forge`** ✅ SECURED  
**Domain**: **`holistix.so`** ✅ ACQUIRED

---

## 📊 SCOPE SUMMARY

Based on codebase analysis:

- **275 occurrences** of "demiurge" (case-insensitive) across **144 files**
- **95 occurrences** of "Demiurge" (case-sensitive) across **46 files**
- **1,057 occurrences** of `@monorepo` namespace across **379 files**
- **7 files** with "demiurge" in filename
- **103 occurrences** of "kosmoforge" in website (4 files)
- **2 SVG logo files** with "kosmoforge" naming
- **14 domain references** to `.holistix.so`
- **8 Docker image references** with `demiurge/` prefix

---

## 🎯 PHASE 1: PRE-REBRANDING DECISIONS ✅ COMPLETED

### ✅ Final Decisions

- [x] **1.1** GitHub organization name: **`Holistix`**
  - Full URL: `github.com/Holistix`
- [x] **1.2** Main repository name: **`platform`**
  - Full URL: `github.com/Holistix/platform`
- [x] **1.3** Package namespace: **`@holistix/*`**
  - All packages: `@holistix/app-frontend`, `@holistix/app-gateway`, etc.
- [x] **1.4** Docker image prefix: **`holistix/*`**
  - All images: `holistix/jupyterlab-minimal`, `holistix/ubuntu-terminal`, etc.
- [x] **1.5** Primary domain: **`holistix.so`** ✅ ACQUIRED
  - Alternative domains to consider: `holistix.io`, `holistix.com`, `holistix.cloud`
- [x] **1.6** Finalize license model: **AGPL-3.0**
  - Current: AGPL-3.0 (GNU Affero General Public License v3.0)
  - Changed from PolyForm Noncommercial + Commercial dual license to AGPL-3.0
  - ✅ Changed to AGPL-3.0, LICENSE file updated, COMMERCIAL_LICENSE.md removed

### 📝 Decision Summary

```
Brand:     Holistix Forge
GitHub:    github.com/HolistixForge/platform ✅ SECURED
NPM:       @holistix-forge/* ✅ SECURED
Docker:    holistixforge/* (no hyphen) ✅ SECURED
Domains:   holistix.so (primary) ✅ ACQUIRED
           holistixforge.com (redirect)
           holistix-forge.com (redirect)
Email:     contact@holistix.so
```

---

## 🌐 PHASE 2: WEBSITE & BRANDING ASSETS ✅ COMPLETE

### 2.1 Landing Page (`website/`)

- [x] **2.1.1** Update `index.html`

  - [x] Replace "Kosmoforge" with "Holistix Forge" (19 occurrences)
  - [x] Update page title
  - [x] Update meta description
  - [x] Update logo references
  - [x] Update GitHub links → `https://github.com/HolistixForge/platform`

- [x] **2.1.2** Update `docs.html`

  - [x] Replace "Kosmoforge" mentions (3 occurrences)
  - [x] Update page title
  - [x] Update logo references
  - [x] Update GitHub links

- [x] **2.1.3** Update `styles.css`

  - [x] No brand-specific changes needed

- [x] **2.1.4** Replace logo files

  - [x] Delete `kosmoforge.svg`
  - [x] Delete `kosmoforge-logo-mono.svg`
  - [x] Create `holistix-forge.svg` (placeholder)
  - [x] Create `holistix-forge-logo-mono.svg` (placeholder)
  - [x] Update all logo references in HTML files

- [x] **2.1.5** Update `COPYWRITING.md`

  - [x] Replace all 78 occurrences of "Kosmoforge" with "Holistix Forge"
  - [ ] ⚠️ TODO: Review and update brand messaging (manual task)
  - [ ] ⚠️ TODO: Update taglines if needed
  - [ ] ⚠️ TODO: Update SEO keywords

- [ ] **2.1.6** Update `README_DOCS.md`

  - [ ] Check for any brand references

- [ ] **2.1.7** Update `docs-config.json`
  - [ ] Check for brand mentions in documentation titles

**Note**: Logo files are functional placeholders. Replace with professional design when ready.

---

## 📝 PHASE 3: DOCUMENTATION

### 3.1 Main Documentation Files (8 files to update)

- [ ] **3.1.1** `README.md` (7 occurrences)

  - [ ] Update description
  - [ ] Update GitHub links
  - [ ] Update issue tracker links
  - [ ] Update discussion links
  - [ ] Replace all "Demiurge" mentions with "Holistix"

- [ ] **3.1.2** `CONTRIBUTING.md` (4 occurrences)

  - [ ] Update repository clone URLs
  - [ ] Update GitHub links

- [ ] **3.1.3** `LICENSE` (1 occurrence)

  - [ ] Review and update if changing license model
  - [ ] Update copyright holder if needed

- [x] **3.1.4** `COMMERCIAL_LICENSE.md` - DELETED (no longer applicable with AGPL-3.0)

- [ ] **3.1.5** `README_NEXT_STEPS.md` (3 occurrences)
  - [ ] Update all brand references
  - [ ] Update domain references

### 3.2 Documentation Hub (`doc/`)

- [ ] **3.2.1** `doc/README.md` (2 occurrences)

  - [ ] Update description

- [ ] **3.2.2** `doc/LICENSING.md` (14 occurrences)
  - [ ] Update all "Demiurge" references to "Holistix"
  - [ ] Update contact email ( → @holistix.so)
  - [ ] Update license file references

### 3.3 Architecture Docs (`doc/architecture/`)

- [ ] **3.3.1** `OVERVIEW.md` (3 occurrences)
- [ ] **3.3.2** `SYSTEM_ARCHITECTURE.md` (1 occurrence)
- [ ] **3.3.3** `GATEWAY_ARCHITECTURE.md` (4 occurrences)
- [ ] **3.3.4** `FRONTEND_ARCHITECTURE.md` (1 occurrence)
- [ ] Update all architecture diagrams with new brand name

### 3.4 Guide Docs (`doc/guides/`)

- [ ] **3.4.1** `LOCAL_DEVELOPMENT.md` (2 occurrences)
- [ ] **3.4.2** `MODULES_TESTING.md` (1 occurrence)
- [ ] **3.4.3** `NX_WORKSPACE.md` (1 occurrence)

### 3.5 Reference Docs (`doc/reference/`)

- [ ] **3.5.1** `API.md` (3 occurrences)
- [ ] **3.5.2** `CHEATSHEET.md` (1 occurrence + domain reference)

### 3.6 Internal/Current Work Docs

- [ ] **3.6.1** `doc/internal/AI-summary.md` (3 occurrences)
- [ ] **3.6.2** `doc/current-works/TODO.md` (1 occurrence)
- [ ] **3.6.3** `doc/current-works/TODO_ANTOINE.md` (check for mentions)

### 3.7 Archive Docs (`doc/archive/`)

- [ ] **3.7.1** `doc/archive/README.md`
- [ ] **3.7.2** `doc/archive/project-server-state-and-transition.md` (1 occurrence)
- [ ] **3.7.3** `doc/archive/2024-container-refactor/*.md` (multiple occurrences)
- [ ] **Decision**: Keep these as historical or update for consistency?

### 3.8 Fluid Lifecycle Docs

- [ ] **3.8.1** `doc/fluid-lifecycle/README.md` (1 occurrence)
- [ ] **Decision**: Keep historical context or update mentions of evolution to Holistix?

---

## 💻 PHASE 4: SOURCE CODE - PACKAGE NAMESPACE ✅ COMPLETE

### 4.1 Package.json Files (ALL packages - 379 files affected)

- [x] **4.1.1** Root `package.json`

  - [x] Update workspace name: `@monorepo/source` → `@holistix-forge/source`
  - [x] No hardcoded paths found

- [x] **4.1.2** Update ALL package names: `@monorepo/*` → `@holistix-forge/*`

  - [x] All 32 packages renamed
  - [x] All package.json files updated

- [x] **4.1.3** Update ALL imports in source files (~1,500 occurrences)

  - [x] All TypeScript/JavaScript imports updated
  - [x] Build tested: ✅ All 32 projects successful

- [x] **4.1.4** Update `package-lock.json`

  - [x] Regenerated successfully

- [x] **4.1.5** Update Nx project names

  - [x] Updated `nx.name` field in 23 package.json files
  - [x] Updated 2 project.json files (app-gateway, notion)
  - [x] All projects now display with `@holistix-forge/*` scope

- [x] **4.1.6** Fix package naming conflicts

  - [x] Renamed `demiurge-types` directory → `types`
  - [x] Package now: `@holistix-forge/types`
  - [x] Kept `simple-types` as `@holistix-forge/simple-types`

- [x] **4.1.7** Fix EPriority enum issues
  - [x] Updated numeric log priorities to enum constants
  - [x] Files fixed: dispatchers.ts, collab.ts, backendEventProcessor.ts, module/index.ts

### 4.2 TypeScript Configuration Files

- [x] **4.2.1** Update all `tsconfig.json` files

  - [x] Nx sync applied automatically
  - [x] All TypeScript references updated

- [x] **4.2.2** Root `tsconfig.json`
  - [x] No changes needed (no path mappings)

**Status**: ✅ Complete - All builds passing

---

## 💻 PHASE 5: SOURCE CODE - BRAND REFERENCES

### 5.1 Component Names & Files (7 files to rename)

**⚠️ IMPORTANT**: File renames must be done with git to preserve history:

```bash
# Use git mv to preserve history
git mv packages/modules/space/src/lib/components/demiurge-space.tsx \
       packages/modules/space/src/lib/components/holistix-space.tsx

git mv packages/modules/space/src/lib/stories/story-demiurge-space.tsx \
       packages/modules/space/src/lib/stories/story-holistix-space.tsx

git mv docker-images/user-images/demiurge-functions.sh \
       docker-images/user-images/holistix-functions.sh

git mv packages/modules/user-containers/docker-images/ubuntu/demiurge-entrypoint.sh \
       packages/modules/user-containers/docker-images/ubuntu/holistix-entrypoint.sh

git mv packages/modules/pgadmin4/docker-image/demiurge-entrypoint.sh \
       packages/modules/pgadmin4/docker-image/holistix-entrypoint.sh

git mv packages/modules/n8n/docker-image/demiurge-entrypoint.sh \
       packages/modules/n8n/docker-image/holistix-entrypoint.sh

git mv packages/modules/jupyter/docker-image/demiurge-entrypoint.sh \
       packages/modules/jupyter/docker-image/holistix-entrypoint.sh
```

- [ ] **5.1.1** Rename files with "demiurge" in name (7 files):

  - [ ] `packages/modules/space/src/lib/components/demiurge-space.tsx` → `holistix-space.tsx`
  - [ ] `packages/modules/space/src/lib/stories/story-demiurge-space.tsx` → `story-holistix-space.tsx`
  - [ ] `docker-images/user-images/demiurge-functions.sh` → `holistix-functions.sh`
  - [ ] `packages/modules/user-containers/docker-images/ubuntu/demiurge-entrypoint.sh` → `holistix-entrypoint.sh`
  - [ ] `packages/modules/pgadmin4/docker-image/demiurge-entrypoint.sh` → `holistix-entrypoint.sh`
  - [ ] `packages/modules/n8n/docker-image/demiurge-entrypoint.sh` → `holistix-entrypoint.sh`
  - [ ] `packages/modules/jupyter/docker-image/demiurge-entrypoint.sh` → `holistix-entrypoint.sh`

- [ ] **5.1.2** Update ALL references to renamed files:
  - [ ] All imports of `demiurge-space` component
  - [ ] Dockerfile COPY statements for entrypoint files
  - [ ] README references to `demiurge-functions.sh`
  - [ ] Any scripts sourcing these files

### 5.2 Component & Class Names

- [ ] **5.2.1** `packages/modules/space/src/lib/components/demiurge-space.tsx`

  - [ ] Rename component: `DemiurgeSpace` → `HolistixSpace` (8 occurrences)
  - [ ] Update all imports of this component

- [ ] **5.2.2** Update CSS class names

  - [ ] `demiurge-space` → `holistix-space`
  - [ ] Check `packages/modules/space/src/lib/components/css/index.scss`

- [ ] **5.2.3** Update exports in `packages/modules/space/src/frontend.ts`

### 5.3 Code Comments & Documentation Strings (144 files)

- [ ] **5.3.1** Run global find/replace for code comments

  - [ ] Find: `demiurge` → Replace: `holistix` (case-insensitive)
  - [ ] Manual review of each change for context

- [ ] **5.3.2** Update JSDoc/TSDoc comments with brand name

### 5.4 Type Definitions

- [x] **5.4.1** Rename package: `@monorepo/demiurge-types` → `@holistix/types`
  - [x] Update package.json
  - [x] Update all imports

### 5.5 Test Files & Storybook Stories

- [ ] **5.5.1** Update all `.stories.tsx` files with brand mentions
  - [ ] `packages/modules/space/src/lib/stories/story-demiurge-space.tsx`
  - [ ] And ~15 other story files

---

## 🎨 PHASE 5.5: SPACE → WHITEBOARD MODULE RENAME ✅ DONE

**Status**: ✅ **COMPLETED**  
**Date**: Dec 5, 2025  
**Time**: 1.5 hours  
**Priority**: High

Complete rename of "space" module to "whiteboard" - brand-neutral naming aligned with functionality.

### Changes Completed

#### 5.5.1 Directory & Package Structure

- [x] Renamed directory: `packages/modules/space` → `packages/modules/whiteboard`
- [x] Updated package name: `@holistix-forge/space` → `@holistix-forge/whiteboard`
- [x] Updated `sourceRoot`: `packages/modules/space/src` → `packages/modules/whiteboard/src`
- [x] Updated config files: `jest.config.ts`, `vite.config.ts`
- [x] Updated `package.json` style exports: `dist/space.css` → `dist/whiteboard.css`

#### 5.5.2 File Renames (10 files)

- [x] `space-reducer.ts` → `whiteboard-reducer.ts`
- [x] `space-events.ts` → `whiteboard-events.ts`
- [x] `space-types.ts` → `whiteboard-types.ts`
- [x] `space-menu.tsx` → `whiteboard-menu.tsx`
- [x] `collab-space-state.ts` → `collab-whiteboard-state.ts`
- [x] `spaceState.ts` → `whiteboardState.ts`
- [x] `space-module/` directory → `whiteboard-module/`
- [x] All internal imports updated (150+ references)

#### 5.5.3 Type System Updates (8 types)

- [x] `TSpaceSharedData` → `TWhiteboardSharedData`
- [x] `TSpaceMenuEntry` → `TWhiteboardMenuEntry`
- [x] `TSpaceMenuEntries` → `TWhiteboardMenuEntries`
- [x] `TSpaceFrontendExports` → `TWhiteboardFrontendExports`
- [x] `TSpaceEvent` → `TWhiteboardEvent`
- [x] `TSpaceContext` → `TWhiteboardContext`
- [x] Story types: `StoryMockSpaceContext` → `StoryMockWhiteboardContext`

#### 5.5.4 Classes & Functions

- [x] `SpaceReducer` class → `WhiteboardReducer`
- [x] `SpaceState` class → `WhiteboardState`
- [x] `spaceMenuEntries` function → `whiteboardMenuEntries`
- [x] Component names in stories updated

#### 5.5.5 Shared Data Keys ⚠️ BREAKING CHANGE

All Yjs shared data event types renamed from `'space:*'` to `'whiteboard:*'`:

- [x] `'space:graphViews'` → `'whiteboard:graphViews'`
- [x] `'space:new-view'` → `'whiteboard:new-view'`
- [x] `'space:new-group'` → `'whiteboard:new-group'`
- [x] `'space:new-shape'` → `'whiteboard:new-shape'`
- [x] `'space:move-node'` → `'whiteboard:move-node'`
- [x] `'space:lock-node'` → `'whiteboard:lock-node'`
- [x] `'space:disable-feature'` → `'whiteboard:disable-feature'`
- [x] `'space:shape-property-change'` → `'whiteboard:shape-property-change'`

⚠️ **Note**: This is a breaking change - existing user data with 'space:' keys will need migration.

#### 5.5.6 Module Metadata

- [x] Module name: `'space'` → `'whiteboard'`
- [x] Module description: `'Space module'` → `'Whiteboard module'`
- [x] Frontend module exports updated

#### 5.5.7 Cross-Module Updates (9 modules affected)

- [x] **airtable**: Updated `TSpaceMenuEntries` imports and usage
- [x] **chats**: Updated `TSpaceEvent` to `TWhiteboardEvent`
- [x] **excalidraw**: Updated menu entries and event types
- [x] **jupyter**: Updated menu entries
- [x] **notion**: Updated menu entries
- [x] **socials**: Updated menu entries
- [x] **user-containers**: Updated menu entries (servers-menu.tsx)
- [x] **n8n**: Updated menu entries
- [x] **app-frontend**: Updated style imports (`@holistix-forge/whiteboard/style`)
- [x] **app-gateway**: Updated event types in `build-collab.ts`

#### 5.5.8 Documentation

- [x] `README.md`: Updated all references from "Space" to "Whiteboard"
- [x] Type documentation updated
- [x] API documentation updated

#### 5.5.9 Build & Verification

- [x] Cleared Nx cache: `npx nx reset`
- [x] Synced workspace: `npx nx sync`
- [x] Regenerated `package-lock.json`
- [x] Full build test: **ALL 32 PROJECTS BUILD SUCCESSFULLY**
- [x] Fixed all TypeScript linter errors
- [x] Verified verbose build: **NO ERRORS REMAINING**

### Statistics

- **135 files modified**
- **~300 text replacements** (types, imports, references)
- **10 files renamed** (with git history preserved)
- **1 directory renamed** (with git history preserved)
- **9 modules updated** (cross-module references)
- **8 shared data keys renamed** (breaking change)

### Next Steps

- User to commit changes (user handles all commits)
- Consider data migration script for existing users (if needed)

---

## 🐳 PHASE 6: DOCKER IMAGES ✅ DONE

### 6.1 Docker Image Names (8 occurrences of `demiurge/`)

- [ ] **6.1.1** Update base images in Dockerfiles:
  - [ ] `packages/modules/user-containers/docker-images/ubuntu/Dockerfile`
    - [ ] `demiurge/ubuntu-terminal` → `holistix/ubuntu-terminal`
  - [ ] `packages/modules/jupyter/docker-image/Dockerfile-minimal`
    - [ ] `demiurge/jupyterlab-minimal` → `holistix/jupyterlab-minimal`
  - [ ] `packages/modules/jupyter/docker-image/Dockerfile-pytorch`
    - [ ] `demiurge/jupyterlab-pytorch` → `holistix/jupyterlab-pytorch`
  - [ ] `packages/modules/pgadmin4/docker-image/Dockerfile`
    - [ ] `demiurge/pgadmin4` → `holistix/pgadmin4`
  - [ ] `packages/modules/n8n/docker-image/Dockerfile`
    - [ ] `demiurge/n8n` → `holistix/n8n`

### 6.2 Image Registry References in Code

- [ ] **6.2.1** Update image URIs in module backend files:
  - [ ] `packages/modules/user-containers/src/index.ts`
  - [ ] `packages/modules/jupyter/src/index.ts`
  - [ ] `packages/modules/pgadmin4/src/backend.ts`
  - [ ] `packages/modules/n8n/src/backend.ts`

### 6.3 Docker Build Scripts

- [ ] **6.3.1** Update any build scripts with image names:
  - [ ] `scripts/local-dev/build-images.sh`
  - [ ] Module-specific build scripts

### 6.4 Docker Documentation

- [ ] **6.4.1** `docker-images/README.md` (2 occurrences)
- [ ] **6.4.2** `docker-images/user-images/README.md` (2 occurrences)
- [ ] **6.4.3** Module READMEs with Docker instructions

---

## 🌍 PHASE 7: DOMAINS & URLS

### 7.1 Domain References (14 occurrences of `.holistix.so`)

- [ ] **7.1.1** Update in documentation:

  - [ ] `doc/reference/CHEATSHEET.md`
  - [ ] `doc/guides/LOCAL_DEVELOPMENT.md`
  - [ ] `doc/archive/2024-container-refactor/CONTAINER_FEATURE_CURRENT_IMPLEMENTATION.md`
  - [ ] `packages/app-ganymede-cmds/README.md`
  - [ ] `packages/app-frontend/README.md`

- [ ] **7.1.2** Update in source code:

  - [ ] `packages/app-frontend/vite.config.ts`
  - [ ] `packages/app-ganymede/src/routes/auth/oauth.ts`
  - [ ] Any other config files with domain references

- [ ] **7.1.3** Update email addresses:
  - [ ] `licensing@holistix.so` → `contact@holistix.so`
  - [ ] `contact@holistix.so` → `contact@holistix.so`
  - [ ] `support@holistix.so` → `contact@holistix.so`
  - [ ] Check: `LICENSING.md`, website (COMMERCIAL_LICENSE.md has been removed)

### 7.2 Environment Variables & Configuration

- [ ] **7.2.1** Update example environment files:

  - [ ] Check `.env.example` files for domain references
  - [ ] `scripts/local-dev/create-env.sh` - domain variables

- [ ] **7.2.2** Update configuration templates:
  - [ ] PowerDNS setup scripts
  - [ ] Nginx configuration templates

---

## 🗄️ PHASE 8: DATABASE & BACKEND

### 8.1 Database Schema

- [ ] **8.1.1** Review `packages/app-ganymede/database/schema/03-data.sql`
  - [ ] Check for any brand references in seed data

### 8.2 OAuth Configuration

- [x] **8.2.1** Update OAuth client names:
  - [x] `packages/app-ganymede/src/models/oauth.ts`
  - [x] `packages/app-ganymede/src/routes/auth/oauth.ts`
  - [x] `packages/types/src/lib/ganymede-api/oauth.ts`

### 8.3 API Specifications

- [ ] **8.3.1** `packages/app-ganymede/src/oas30.json` (4 occurrences)

  - [ ] Update API title
  - [ ] Update descriptions
  - [ ] Update server URLs
  - [ ] Update contact information

- [ ] **8.3.2** `packages/app-gateway/src/oas30.json`
  - [ ] Same updates as above

---

## 🔧 PHASE 9: BUILD & DEPLOYMENT SCRIPTS

### 9.1 Local Development Scripts (`scripts/local-dev/`)

- [ ] **9.1.1** `create-env.sh` (2 occurrences)
- [ ] **9.1.2** `envctl.sh` (1 occurrence)
- [ ] **9.1.3** `envctl-monitor.sh` (1 occurrence)
- [ ] **9.1.4** `setup-all.sh` (1 occurrence)
- [ ] **9.1.5** `setup-powerdns.sh` (1 occurrence)
- [ ] Update any comments or echo statements with brand name

### 9.2 Production Scripts (`scripts/production/`)

- [ ] **9.2.1** `install.sh` (1 occurrence)
- [ ] Check for other production scripts with brand references

### 9.3 Build Configuration

- [ ] **9.3.1** `nx.json` - check for brand-specific configurations
- [ ] **9.3.2** Vite configs - check for brand in comments
- [ ] **9.3.3** Jest configs - check for brand in comments

---

## 📦 PHASE 10: PACKAGE DISTRIBUTION

### 10.1 Root Package Configuration

- [ ] **10.1.1** Update root `package.json`:
  - [ ] Change `"name": "@monorepo/source"` to `"@holistix/source"`
  - [ ] Update `"license"` if changing license model
  - [ ] Review and update any scripts

### 10.2 NPM Package Preparation (if publishing)

- [ ] **10.2.1** Ensure package names don't conflict
  - [ ] Check NPM registry for `@holistix/*` availability
  - [ ] Reserve package names if publishing publicly

### 10.3 Docker Registry

- [ ] **10.3.1** Choose Docker registry:

  - [ ] Docker Hub: `holistix/*`
  - [ ] GitHub Container Registry: `ghcr.io/holistix-platform/*`
  - [ ] Private registry

- [ ] **10.3.2** Rebuild and push all images with new names

---

## 🧪 PHASE 11: TESTING & VERIFICATION

### 11.1 Build Testing

- [ ] **11.1.1** Run full build:
  ```bash
  npx nx run-many -t build
  ```
- [ ] **11.1.2** Fix any build errors from rebranding

### 11.2 Module Testing

- [ ] **11.2.1** Test Storybook for all modules:
  ```bash
  npx nx run <module>:storybook
  ```
- [ ] Verify brand changes in UI

### 11.3 Local Development Testing

- [ ] **11.3.1** Create test environment:
  ```bash
  ./scripts/local-dev/create-env.sh test-rebrand domain.local
  ```
- [ ] **11.3.2** Verify all services start correctly
- [ ] **11.3.3** Test full workflow:
  - [ ] User signup/login
  - [ ] Organization creation
  - [ ] Project creation
  - [ ] Container deployment
  - [ ] Collaboration features

### 11.4 Docker Testing

- [ ] **11.4.1** Build all Docker images with new names
- [ ] **11.4.2** Test container deployments
- [ ] **11.4.3** Verify entrypoint scripts work

### 11.5 Documentation Review

- [ ] **11.5.1** Spot-check all updated documentation
- [ ] **11.5.2** Verify all links work
- [ ] **11.5.3** Check for orphaned references

---

## 🚀 PHASE 12: GITHUB MIGRATION

### 12.1 Update Placeholder References (6 files with "Holistix")

- [ ] **12.1.1** Replace `Holistix` placeholders with actual organization name:
  - [ ] `SETUP_COMPLETE.md`
  - [ ] `scripts/local-dev/HTTP_BUILD_DISTRIBUTION.md`
  - [ ] `HTTP_BUILD_SOLUTION.md`
  - [ ] `doc/guides/LOCAL_DEVELOPMENT.md`
  - [ ] `README.md`
  - [ ] `CONTRIBUTING.md`
  - [ ] Replace with: `https://github.com/<actual-org-name>/holistix`

### 12.2 Update Current GitHub References (2 files)

- [ ] **12.2.1** Replace `DemiurgeGalaxie` organization:
  - [ ] `website/index.html` (line 34)
  - [ ] `website/docs.html`
  - [ ] Update to new organization name

### 12.3 GitHub Organization Setup

- [ ] **12.3.1** Create new GitHub organization

  - [ ] Organization name: TBD
  - [ ] Organization URL: `github.com/<org-name>`

- [ ] **12.3.2** Configure organization settings:
  - [ ] Profile picture / avatar (use new Holistix logo)
  - [ ] Display name: "Holistix"
  - [ ] Description: "Unified platform for complex project collaboration"
  - [ ] Website: `https://holistix.so`
  - [ ] Email: `contact@holistix.so`
  - [ ] Location: (your location)
  - [ ] Billing information (if applicable)
  - [ ] Default repository permissions
  - [ ] Member privileges

### 12.2 Repository Transfer/Creation

- [ ] **12.2.1** **Option A: Transfer existing repo**

  - [ ] Backup current repository
  - [ ] Transfer to new organization
  - [ ] Rename repository to new name
  - [ ] Update repository description
  - [ ] Update repository topics/tags
  - [ ] Update website link

- [ ] **12.2.2** **Option B: Create fresh repository**
  - [ ] Create new repository in new organization
  - [ ] Push rebranded codebase
  - [ ] Migrate issues (if needed)
  - [ ] Migrate discussions (if needed)

### 12.3 Repository Configuration

- [ ] **12.3.1** Update repository settings:

  - [ ] Description
  - [ ] Website
  - [ ] Topics
  - [ ] Social preview image
  - [ ] Features (Issues, Discussions, Wiki, etc.)

- [ ] **12.3.2** Configure branch protection rules
- [ ] **12.3.3** Set up GitHub Actions (if any)
- [ ] **12.3.4** Configure secrets and variables

### 12.4 Update Git Remotes

- [ ] **12.4.1** Update local git remotes:
  ```bash
  git remote set-url origin https://github.com/<new-org>/<new-repo>.git
  ```

---

## 🌐 PHASE 13: ONLINE PRESENCE

### 13.1 Domain Setup

- [ ] **13.1.1** Configure DNS for **`holistix.so`**
  - [ ] Point to hosting provider
  - [ ] Set up subdomains:
    - [ ] `www.holistix.so` → main site
    - [ ] `docs.holistix.so` → documentation
    - [ ] `blog.holistix.so` → blog (optional)
    - [ ] `status.holistix.so` → status page (optional)
- [ ] **13.1.2** Set up SSL certificates
  - [ ] Automatic via hosting provider
  - [ ] Or use Let's Encrypt
  - [ ] Wildcard cert: `*.holistix.so`
- [ ] **13.1.3** Configure redirects from old domain (if applicable)
  - [ ] If `holistix.so` is owned, set up 301 redirects
- [ ] **13.1.4** Consider acquiring additional domains (optional)
  - [ ] `holistix.io` (for ".io" preference in tech community)
  - [ ] `holistix.com` (most common TLD)
  - [ ] `holistix.cloud` (for SaaS branding)
  - [ ] Point all to primary `holistix.so` with redirects

### 13.2 Website Deployment

- [ ] **13.2.1** Deploy updated landing page
- [ ] **13.2.2** Deploy updated documentation site
- [ ] **13.2.3** Test all links and functionality

---

## ✅ PHASE 15: POST-REBRANDING CLEANUP

### 15.1 Verification Sweep

- [ ] **15.1.1** Search for any remaining "demiurge" references:

  ```bash
  grep -ri "demiurge" . --exclude-dir={node_modules,.git,dist}
  ```

  - [ ] Expected: 0 results (except in git history and this TODO)

- [ ] **15.1.2** Search for any remaining "kosmoforge" references:

  ```bash
  grep -ri "kosmoforge" . --exclude-dir={node_modules,.git,dist}
  ```

  - [ ] Expected: 0 results (logo files deleted)

- [ ] **15.1.3** Search for old domain references:

  ```bash
  grep -ri "holistix.so" . --exclude-dir={node_modules,.git,dist}
  ```

  - [ ] Expected: 0 results

- [ ] **15.1.4** Search for placeholder references:

  ```bash
  grep -r "Holistix" . --exclude-dir={node_modules,.git,dist}
  grep -r "DemiurgeGalaxie" . --exclude-dir={node_modules,.git,dist}
  ```

  - [ ] Expected: 0 results

- [ ] **15.1.5** Verify package namespace:
  ```bash
  grep -r "@monorepo/" . --exclude-dir={node_modules,.git,dist} | wc -l
  ```
  - [ ] Expected: 0 results

### 15.3 Remove This TODO File

- [ ] **15.3.1** Delete `REBRANDING_TODO.md` when complete
- [ ] **15.3.2** Or move to `doc/archive/` for historical reference

---

## 🔍 SEARCH & REPLACE CHECKLIST

### Automated Find/Replace (with caution!)

**⚠️ CRITICAL**: Run in a separate branch first! Test build after each step.

```bash
# Create rebranding branch
git checkout -b rebrand/holistix
git add -A
git commit -m "Checkpoint before rebranding"

# 1. Brand name - Demiurge → Holistix (case-insensitive, 275 occurrences)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.md" -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/REBRANDING_TODO.md" \
  -exec sed -i 's/demiurge/holistix/gi' {} +

# 2. Package namespace - @monorepo/* → @holistix/* (1,057 occurrences)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/package-lock.json" \
  -exec sed -i 's/@monorepo\//@holistix\//g' {} +

# 3. Docker images - demiurge/ → holistix/ (8 occurrences)
find . -type f \( -name "Dockerfile*" -o -name "*.ts" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's/demiurge\//holistix\//g' {} +

# 4. Domain - holistix.so → holistix.so (14 occurrences)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.html" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's/demiurge\.co/holistix.so/g' {} +

# 5. Kosmoforge → Holistix (website only, 103 occurrences)
find ./website -type f \( -name "*.html" -o -name "*.md" -o -name "*.css" \) \
  -exec sed -i 's/Kosmoforge/Holistix/g' {} +

# 6. GitHub placeholders - Holistix → Holistix (6 occurrences)
find . -type f \( -name "*.md" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's|https://github.com/Holistix/monorepo|https://github.com/Holistix/platform|g' {} +

# Also update any standalone Holistix references
find . -type f \( -name "*.md" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's/Holistix/Holistix/g' {} +

# 7. Current GitHub org - DemiurgeGalaxie → Holistix (2 occurrences)
find ./website -type f -name "*.html" \
  -exec sed -i 's|https://github.com/DemiurgeGalaxie/monorepo|https://github.com/Holistix/platform|g' {} +

find ./website -type f -name "*.html" \
  -exec sed -i 's/DemiurgeGalaxie/Holistix/g' {} +

# After all replacements:
# - Regenerate package-lock.json
npm install

# - Test build
npx nx run-many -t build

# - Commit checkpoint
git add -A
git commit -m "Apply automated rebranding: text replacements"
```

**⚠️ WARNING**: Test these in a branch first! Manual review required for:

- File renames
- Component/class names (case-sensitive)
- Historical documentation (may want to preserve)
- Archive documentation (may want to preserve context)

---

## 📋 RECOMMENDED EXECUTION ORDER

1. **Phase 1**: Make all naming decisions first ⚠️ CRITICAL
2. **Phase 2**: Update website & branding assets (visible changes)
3. **Phase 4**: Update package namespace (`@monorepo/*` → `@holistix/*`)
4. **Phase 5**: Update source code brand references
5. **Phase 3**: Update documentation (after code changes for accuracy)
6. **Phase 6**: Update Docker images and scripts
7. **Phase 7**: Update domains and URLs
8. **Phase 8**: Update database and backend references
9. **Phase 9**: Update build and deployment scripts
10. **Phase 11**: Comprehensive testing
11. **Phase 12**: GitHub migration
12. **Phase 13**: Online presence updates
13. **Phase 14**: Announcement
14. **Phase 15**: Post-rebranding cleanup

---

## ⚠️ IMPORTANT CONSIDERATIONS

### What NOT to Change

- [ ] **Git commit history** - Keep as-is, don't rewrite history
- [ ] **Archive documentation** - Decide: preserve historical context or update for consistency
- [ ] **Fluid lifecycle docs** - Likely keep as historical origin story
- [ ] **This REBRANDING_TODO.md** - Don't include in automated replacements

### Special Attention Required

- [x] **OAuth client names** - "demiurge-global" → "app-main-client-id"

  - [x] This is a breaking change for existing users
  - [x] May need migration path or backward compatibility

- [x] **Package type definitions** - `@monorepo/demiurge-types` → `@holistix/types`

  - [x] Also removing "demiurge" from package name
  - [x] Update ALL imports across codebase

- [ ] **Docker entrypoint scripts** - Sourcing `demiurge-functions.sh`

  - [ ] Update all COPY statements in Dockerfiles
  - [ ] Update all source/. statements in entrypoints
  - [ ] Test Docker builds after changes

- [ ] **Component exports** - `DemiurgeSpace` → `HolistixSpace`
  - [ ] This is a breaking change for any external consumers
  - [ ] Update all module stories using this component

### Case Sensitivity Matters

- [ ] Component names: `DemiurgeSpace` → `HolistixSpace` (PascalCase)
- [ ] File names: `demiurge-space.tsx` → `holistix-space.tsx` (kebab-case)
- [x] Package names: `@monorepo/demiurge-types` → `@holistix/types` (lowercase)
- [ ] CSS classes: `.demiurge-space` → `.holistix-space` (kebab-case)

### Testing Critical Paths

After rebranding, test these workflows end-to-end:

1. **Build pipeline**: All packages build successfully
2. **Storybook**: All module stories render
3. **Docker images**: All images build and run
4. **Local dev**: Environment creation and startup
5. **User containers**: Container deployment and networking
6. **Frontend**: Application loads and functions
7. **Documentation**: All links work, no 404s

---

## 🎯 QUICK REFERENCE: KEY NUMBERS

| Item                                      | Count   | Action                       |
| ----------------------------------------- | ------- | ---------------------------- |
| "demiurge" occurrences (case-insensitive) | 275     | Find/replace in 144 files    |
| "Demiurge" occurrences (case-sensitive)   | 95      | Find/replace in 46 files     |
| "Kosmoforge" occurrences                  | 103     | Replace in 4 website files   |
| "@monorepo" namespace references          | 1,057   | Replace in 379 files         |
| Files with "demiurge" in name             | 7       | Rename with `git mv`         |
| Docker image references                   | 8       | Update in Dockerfiles + code |
| Domain references (.holistix.so)          | 14      | Replace in 7 files           |
| "Holistix" placeholders                   | 6 files | Replace with actual org name |
| "DemiurgeGalaxie" references              | 2 files | Replace with new org name    |
| Logo files to replace                     | 2 files | Delete + create new          |

---

## 🚦 PROGRESS TRACKING

**Status**: 🟢 2/15 Phases Complete

- [x] **Phase 1**: Decisions ✅ COMPLETE
- [x] **Phase 2**: Website & Branding ✅ COMPLETE (placeholder logos)
- [ ] **Phase 3**: Documentation 🔴 NOT STARTED
- [x] **Phase 4**: Package Namespace ✅ COMPLETE
- [ ] **Phase 5**: Source Code (file renames, component names) 🔴 NOT STARTED
- [ ] **Phase 6**: Docker Images 🔴 NOT STARTED
- [ ] **Phase 7**: Domains & URLs 🔴 NOT STARTED
- [ ] **Phase 8**: Database & Backend 🔴 NOT STARTED
- [ ] **Phase 9**: Scripts 🔴 NOT STARTED
- [ ] **Phase 10**: Package Distribution 🔴 NOT STARTED
- [ ] **Phase 11**: Testing 🔴 NOT STARTED
- [ ] **Phase 12**: GitHub Migration 🔴 NOT STARTED
- [ ] **Phase 13**: Online Presence 🔴 NOT STARTED
- [ ] **Phase 14**: Announcement 🔴 NOT STARTED
- [ ] **Phase 15**: Cleanup 🔴 NOT STARTED

**Completion**: 2/15 phases (13% complete)

**Completed Work**:

- ✅ Package namespace: @monorepo → @holistix-forge
- ✅ Website: Kosmoforge → Holistix Forge
- ✅ Website GitHub URLs updated
- ✅ Placeholder logos created
- ✅ All 32 packages building successfully

---

**Last Updated**: 2025-12-03  
**Status**: ✅ Phase 1 Complete - Ready to Execute  
**Next Action**:

1. Reserve GitHub organization "Holistix" immediately
2. Create Holistix logo (SVG files)
3. Begin Phase 2 - Website updates

---

## 🎯 FINALIZED REBRANDING PARAMETERS

```yaml
Brand:
  Name: Holistix Forge
  Short Name: Holistix
  Tagline: "Forge Your Unified Workspace"

GitHub:
  Organization: HolistixForge ✅ SECURED
  Repository: platform
  URL: https://github.com/HolistixForge/platform

NPM:
  Organization: holistix-forge ✅ SECURED
  Packages: @holistix-forge/*
  Root: @holistix-forge/source
  Examples:
    - @holistix-forge/app-frontend
    - @holistix-forge/user-containers
    - @holistix-forge/types

Docker Hub:
  Username: holistixforge ✅ SECURED (no hyphen!)
  Images: holistixforge/*
  Examples:
    - holistixforge/jupyterlab-minimal
    - holistixforge/ubuntu-terminal
    - holistixforge/pgadmin4

Domains:
  Primary: holistix.so ✅ ACQUIRED
  Redirects:
    - holistixforge.com ✅ ACQUIRED → holistix.so
    - holistix-forge.com ✅ ACQUIRED → holistix.so
  Email: contact@holistix.so (single address for everything)

Website:
  Main: https://holistix.so
  Docs: https://docs.holistix.so (or holistix.so/docs)

License:
  Status: TBD ⚠️ (must decide before open source release)
  Options:
    - MIT (maximum adoption)
    - Apache 2.0 (patent protection)
    - AGPL (copyleft, SaaS protection)
    - Current dual-license model
```

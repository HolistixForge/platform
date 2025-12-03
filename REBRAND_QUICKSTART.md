# 🚀 Holistix Rebranding - Quick Start Guide

**Last Updated**: 2025-12-03

---

## ✅ What's Been Decided

```
Brand Name:    Holistix
GitHub Org:    Holistix  
Repository:    platform
Full URL:      https://github.com/Holistix/platform

Packages:      @holistix/*
Docker:        holistix/*  
Domain:        holistix.so ✅ ACQUIRED
Website:       https://holistix.so

License:       TBD (must decide before open source!)
```

---

## 🎯 THREE Simple Steps to Rebrand

### Step 1: Prepare (30 minutes)

```bash
# 1. Reserve GitHub organization RIGHT NOW! ⚠️
# Go to: https://github.com/organizations/plan
# Create organization named: Holistix (exact case)

# 2. Create Holistix logo
# - Design holistix.svg (color)
# - Design holistix-logo-mono.svg (monochrome)
# - Replace website/kosmoforge*.svg files

# 3. Decide on license
# Options: MIT, Apache 2.0, AGPL, or keep dual-license
```

### Step 2: Execute Automated Rebranding (2-4 hours)

```bash
# Safety first!
git checkout -b rebrand/holistix
git tag pre-rebrand-backup

# Preview what will change
./rebrand.sh

# Execute automated changes
./rebrand.sh --execute

# Regenerate package-lock
npm install

# Test build
npx nx run-many -t build

# Verify all old references are gone
./rebrand.sh --verify
```

### Step 3: Manual Tasks (4-8 hours)

See `REBRANDING_TODO.md` for complete checklist, but key manual tasks:

- [ ] Create new logo files
- [ ] Update website logo references
- [ ] Review all documentation (automated changes need spot-checking)
- [ ] Test Docker image builds
- [ ] Test local development environment
- [ ] Update GitHub organization settings
- [ ] Deploy new website to holistix.so

---

## 📊 What Gets Changed

### Automated (via `rebrand.sh`)
- ✅ **275** brand name references → `holistix`
- ✅ **1,057** package imports → `@holistix/*` 
- ✅ **103** website brand mentions → `Holistix`
- ✅ **14** domain references → `holistix.so`
- ✅ **8** Docker images → `holistix/*`
- ✅ **7** file renames → `holistix-*`
- ✅ **8** GitHub URLs → `github.com/Holistix/platform`

### Manual (via checklist)
- 🔨 Logo creation and replacement
- 🔨 Website HTML updates
- 🔨 Documentation review
- 🔨 Docker image rebuilds
- 🔨 GitHub organization setup
- 🔨 Testing and verification

---

## ⚠️ Breaking Changes

These changes will break existing deployments:

1. **Package namespace**: `@monorepo/*` → `@holistix/*`
2. **Docker images**: `holistix/*` → `holistix/*`
3. **OAuth client**: `holistix-global` → `holistix-global`

**Migration guide needed for existing users!**

---

## 📞 Immediate Actions (Do First!)

### 🔴 URGENT (Do Today)
1. **Reserve GitHub org "Holistix"** - first-come-first-served!
2. **Start logo design** - needed for website and GitHub

### 🟡 Important (This Week)
3. **Decide license model** - blocks open source release
4. **Configure email** - set up @holistix.so addresses
5. **Plan deployment** - DNS, SSL for holistix.so

---

## 🧪 Testing Checklist (After Rebranding)

```bash
# 1. Build all packages
npx nx run-many -t build

# 2. Run tests
npx nx run-many -t test

# 3. Test Storybook
npx nx run space:storybook
npx nx run user-containers:storybook

# 4. Test local development
cd scripts/local-dev
./create-env.sh test-rebrand domain.local
./build-frontend.sh test-rebrand
./envctl.sh start test-rebrand

# 5. Rebuild Docker images
cd packages/modules/jupyter/docker-image
docker build -t holistix/jupyterlab-minimal -f Dockerfile-minimal .

# 6. Verify no old references
./rebrand.sh --verify
```

---

## 📚 Documentation Files

- **`REBRANDING_TODO.md`** - Complete 15-phase checklist (1000+ lines)
- **`REBRANDING_SUMMARY.md`** - Quick reference of decisions
- **`rebrand.sh`** - Automated rebranding script
- **This file** - Quick start guide

---

## 💬 Need Help?

Stuck on something? Check:
1. **`REBRANDING_TODO.md`** - Detailed tasks for each phase
2. **`REBRANDING_SUMMARY.md`** - Quick parameter reference
3. **Original documentation** - Architecture docs explain the codebase

---

## ✨ After Rebranding

Once complete:
- Move these files to `doc/archive/rebranding-2025/`
- Update CHANGELOG with rebranding notice
- Create GitHub release: "v2.0.0 - Holistix Rebrand"
- Announce to community!

---

**Ready to begin?** Start with: `./rebrand.sh` (dry run)

🚀 **Good luck with the rebrand to Holistix!**


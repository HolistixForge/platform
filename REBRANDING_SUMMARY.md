# ✅ REBRANDING DECISIONS - FINALIZED

**Date**: 2025-12-03  
**Status**: Ready to Execute

---

## 🎯 FINAL BRANDING PARAMETERS

```yaml
Brand:
  Name: Holistix
  Tagline: "Unified Project Intelligence"
  Alternative: "Complete Context. Complete Control."
  
GitHub:
  Organization: Holistix
  Repository: platform
  Full URL: https://github.com/Holistix/platform
  
Packages:
  Namespace: @holistix/*
  Root Package: @holistix/source
  Examples:
    - @holistix/app-frontend
    - @holistix/app-gateway
    - @holistix/app-ganymede
    - @holistix/user-containers
  
Docker:
  Prefix: holistix/*
  Examples:
    - holistix/jupyterlab-minimal
    - holistix/jupyterlab-pytorch
    - holistix/ubuntu-terminal
    - holistix/pgadmin4
    - holistix/n8n
  Registry Options:
    - Docker Hub: docker.io/holistix/*
    - GitHub: ghcr.io/holistix/*
  
Domain:
  Primary: holistix.so (ACQUIRED ✅)
  Email Addresses:
    - contact@holistix.so
    - licensing@holistix.so
    - support@holistix.so
    - hello@holistix.so (optional friendly)
  Subdomains:
    - www.holistix.so
    - docs.holistix.so
    - blog.holistix.so (optional)
    - status.holistix.so (optional)
  
  Additional Domains (recommended to acquire):
    - holistix.io (redirect to .so)
    - holistix.com (redirect to .so)
    - holistix.cloud (redirect to .so)
  
License:
  Status: TBD - MUST DECIDE BEFORE OPEN SOURCE RELEASE
  Current: PolyForm Noncommercial + Commercial Dual License
  Options to Consider:
    - MIT: Maximum adoption, permissive
    - Apache 2.0: Patent protection, permissive
    - AGPL: Copyleft, protects against SaaS competitors
    - Keep current dual-license model
```

---

## 🚨 IMMEDIATE ACTION ITEMS (Before Starting Rebranding)

### 1. Reserve GitHub Organization (URGENT! ⚠️)
```bash
# Go to: https://github.com/organizations/plan
# Organization name: Holistix (exact case)
# This is FIRST-COME-FIRST-SERVED - do this NOW!
```

### 2. Set Up Email Addresses
```bash
# Configure email forwarding/hosting for holistix.so:
- contact@holistix.so
- licensing@holistix.so  
- support@holistix.so
```

### 3. Create Holistix Logo
```bash
# Design requirements:
- SVG format (scalable)
- Two versions needed:
  - holistix.svg (color version)
  - holistix-logo-mono.svg (monochrome)
- Sizes: optimized for web (favicon, nav logo, social preview)
- Theme: Holistic/unified/interconnected concepts
```

### 4. Decide License Model
```bash
# Review options and make final decision
# This blocks open source release
```

---

## 📋 REBRANDING EXECUTION CHECKLIST

See **`REBRANDING_TODO.md`** for detailed 15-phase execution plan.

### Quick Summary:
- **Phase 1**: ✅ Decisions made
- **Phase 2**: Website & branding assets (4-6 hours)
- **Phase 3**: Documentation updates (6-8 hours)  
- **Phase 4**: Package namespace @monorepo → @holistix (3-4 hours) ⚠️ BIGGEST CHANGE
- **Phase 5**: Source code brand references (4-6 hours)
- **Phase 6**: Docker images (2-3 hours)
- **Phase 7**: Domains & URLs (2-3 hours)
- **Phase 8**: Database & backend (2-3 hours)
- **Phase 9**: Build scripts (1-2 hours)
- **Phase 10**: Package distribution (1-2 hours)
- **Phase 11**: Comprehensive testing (4-6 hours)
- **Phase 12**: GitHub migration (3-4 hours)
- **Phase 13**: Online presence (2-4 hours)
- **Phase 14**: Announcement (2-3 hours)
- **Phase 15**: Cleanup & verification (2-3 hours)

**Total Estimated**: 40-60 hours (1-1.5 weeks)

---

## 🔢 CHANGES BY THE NUMBERS

| Item | Count | Scope |
|------|-------|-------|
| "demiurge" text replacements | 275 | 144 files |
| "@monorepo" namespace changes | 1,057 | 379 files (BIGGEST TASK!) |
| File renames | 7 | Use `git mv` to preserve history |
| Docker image updates | 8 | Dockerfiles + code |
| Domain replacements | 14 | 7 files |
| GitHub URL updates | 8 | 6 docs + 2 website files |
| Logo files | 2 | Delete kosmoforge, create holistix |

---

## ⚡ AUTOMATED REBRANDING SCRIPT

Once you're ready to execute, use this script (from `REBRANDING_TODO.md`):

```bash
# EXECUTE IN ORDER - Test in branch first!

# 0. Create safety checkpoint
git checkout -b rebrand/holistix
git tag pre-rebrand-backup

# 1. Brand name: demiurge → holistix
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.md" -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" \
  -exec sed -i 's/demiurge/holistix/gi' {} +

# 2. Package namespace: @monorepo/ → @holistix/
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/package-lock.json" \
  -exec sed -i 's/@monorepo\//@holistix\//g' {} +

# 3. Docker images: demiurge/ → holistix/
find . -type f \( -name "Dockerfile*" -o -name "*.ts" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's/demiurge\//holistix\//g' {} +

# 4. Domain: holistix.so → holistix.so
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" -o -name "*.html" -o -name "*.sh" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's/demiurge\.co/holistix.so/g' {} +

# 5. Website: Kosmoforge → Holistix
find ./website -type f \( -name "*.html" -o -name "*.md" -o -name "*.css" \) \
  -exec sed -i 's/Kosmoforge/Holistix/g' {} +

# 6. GitHub placeholders: Holistix → Holistix
find . -type f -name "*.md" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's|https://github.com/Holistix/monorepo|https://github.com/Holistix/platform|g' {} +

# 7. Current GitHub: DemiurgeGalaxie → Holistix
find ./website -type f -name "*.html" \
  -exec sed -i 's|https://github.com/DemiurgeGalaxie/monorepo|https://github.com/Holistix/platform|g' {} +

# 8. File renames (preserve git history)
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

# 9. Regenerate package-lock.json
npm install

# 10. Test build
npx nx run-many -t build

# 11. Commit
git add -A
git commit -m "Rebrand: Demiurge → Holistix

- Update brand name across all files
- Change package namespace: @monorepo/* → @holistix/*
- Update Docker images: demiurge/* → holistix/*
- Update domain: holistix.so → holistix.so
- Update GitHub org: DemiurgeGalaxie → Holistix
- Rename files to use holistix naming
- Update website from Kosmoforge to Holistix

Total changes:
- 275 brand name replacements
- 1,057 package namespace updates
- 7 file renames
- 8 Docker image updates
- 14 domain updates
"
```

---

## ⚠️ CRITICAL NOTES

### Breaking Changes
1. **Package namespace change** (`@monorepo/*` → `@holistix/*`)
   - Any external packages importing will break
   - Need migration guide for existing users

2. **OAuth client rename** (`demiurge-global` → `holistix-global`)
   - Existing tokens will be invalid
   - Users need to re-authenticate

3. **Docker image names** (`demiurge/*` → `holistix/*`)
   - Need to update all deployment configs
   - Old images won't pull anymore

### Non-Breaking Changes
- Domain change (only affects documentation/examples)
- GitHub org/repo URL (redirects can be set up)
- File renames (internal only)

---

## 📞 SUPPORT MIGRATION

Update these systems after rebranding:
- [ ] Error messages in code
- [ ] Email templates (if any)
- [ ] Automated notifications
- [ ] Contact forms
- [ ] Support ticketing system
- [ ] Documentation links
- [ ] Status page

---

## 🎨 LOGO DESIGN BRIEF

**Brand Name**: Holistix  
**Concept**: Holistic, unified, complete, integrated

**Design Themes to Explore**:
- Interconnected nodes/network (aligns with graph architecture)
- Unified circle/sphere (holistic, complete)
- Interlocking shapes (integration, LEGO concept)
- Abstract "H" letterform
- Geometric patterns suggesting wholeness

**Color Palette Ideas**:
- Primary: Deep blue/purple (trust, technology)
- Accent: Bright teal/cyan (innovation, connectivity)
- Keep it simple for mono version

**Technical Requirements**:
- SVG format (infinitely scalable)
- Works at small sizes (16x16 favicon)
- Works at large sizes (social preview 1200x630)
- Readable in monochrome
- No complex gradients (for versatility)

---

**Next Steps**: See `REBRANDING_TODO.md` for comprehensive 15-phase execution plan.


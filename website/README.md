# Holistix Forge Website

This directory contains the website for Holistix Forge.

## Directory Structure

```
website/
├── index.html              # Main landing page
├── styles.css              # Main stylesheet
├── script.js               # JavaScript for navigation
├── doc-template.html       # HTML template for documentation pages
├── docs.css               # Documentation-specific styles
├── build-docs.sh          # Build script for static documentation
└── static/                # Generated documentation (gitignored)
```

## Documentation System

We use **md-file-graph** to generate static HTML documentation with full SEO optimization.

### Generate Documentation

```bash
cd website
./build-docs.sh
```

This will:

1. Discover all markdown files in the repository
2. Convert each to SEO-optimized HTML
3. Generate sitemap.xml and robots.txt
4. Output everything to `static/` directory

### What You Get

- ✅ Individual HTML page for each markdown file
- ✅ Full SEO optimization (meta tags, Open Graph, Twitter Cards)
- ✅ Structured data (JSON-LD) for search engines
- ✅ Automatic sitemap.xml generation
- ✅ Fast, pre-rendered pages
- ✅ Works without JavaScript

### Generated Output

```
static/
├── README.html
├── CONTRIBUTING.html
├── doc/
│   ├── architecture/*.html
│   ├── guides/*.html
│   └── reference/*.html
├── packages/
│   └── modules/*.html
├── sitemap.xml
└── robots.txt
```

## Development Workflow

### Quick Iteration

For quick testing of documentation changes:

```bash
# 1. Edit markdown files in the repository
# 2. Regenerate
cd website
./build-docs.sh

# 3. Test locally
cd static
python3 -m http.server 8000
# Visit http://localhost:8000

# 4. Check your changes
# Open http://localhost:8000/doc/your-file.html
```

### Live Preview Option

If you want live reload during development, you can use any static server with watch capability:

```bash
# Option 1: Python with auto-reload (requires watchdog)
pip install watchdog
python3 -m http.server 8000 --directory static

# Option 2: Node.js live-server
npm install -g live-server
cd static && live-server

# Option 3: Just rebuild when needed
cd website
./build-docs.sh && cd static && python3 -m http.server 8000
```

## Build Process

### What `build-docs.sh` Does

1. **Checks for md-file-graph**

   - Verifies md-file-graph is installed
   - Activates its virtual environment

2. **Generates HTML**

   ```bash
   md-file-graph html /path/to/monorepo \
       --output ./static \
       --base-url https://holistix.so \
       --template doc-template.html
   ```

3. **Creates SEO Files**
   - sitemap.xml (all documentation URLs)
   - robots.txt (crawler instructions)

### Customization

Edit `build-docs.sh` to:

- Change base URL
- Add custom md-file-graph options
- Include/exclude specific files

## Template Customization

The `doc-template.html` file defines the HTML structure for all documentation pages.

**Available Variables:**

- `{{ metadata.title }}` - Page title
- `{{ metadata.description }}` - Page description
- `{{ metadata.keywords }}` - Keywords list
- `{{ content|safe }}` - Rendered HTML content
- `{{ canonical_url }}` - Full page URL
- `{{ base_url }}` - Site base URL
- `{{ structured_data }}` - JSON-LD data

**What's Included:**

- Holistix Forge branding
- Navigation bar
- Google Analytics
- Complete SEO tags
- Responsive design

## Deployment

```bash
# 1. Generate static site
cd website
./build-docs.sh

# 2. Copy static assets to output
cp *.css *.js *.svg static/
cp index.html static/

# 3. Deploy to server
rsync -avz static/ user@server:/var/www/holistix.so/

# 4. Submit sitemap
# Visit Google Search Console
# Submit: https://holistix.so/sitemap.xml
```

## SEO Features

Every generated page includes:

### Meta Tags

- Primary: title, description, keywords, robots, canonical
- Open Graph: Facebook/LinkedIn previews
- Twitter Cards: Twitter previews

### Structured Data

- JSON-LD (Schema.org TechArticle)
- Rich snippets for search results

### Discovery

- sitemap.xml (automatic)
- robots.txt (automatic)
- Internal linking (automatic)

## Documentation Files

- **`README.md`** - This file (main documentation)
- **`README_DOCS.md`** - Documentation system details
- **`INTEGRATION.md`** - Integration with md-file-graph
- **`FILES.md`** - File reference guide
- **`COPYWRITING.md`** - Website copy and content

## Tools Used

### md-file-graph

The documentation generator is powered by **md-file-graph**, a tool for analyzing and visualizing markdown documentation.

**Location:** `/root/workspace/md-file-graph/`

**Commands:**

```bash
# Generate HTML
md-file-graph html /path/to/docs \
    --output ./static \
    --base-url https://example.com

# Visualize documentation structure
md-file-graph graph /path/to/docs -o ./output

# See all options
md-file-graph --help
```

## Troubleshooting

### md-file-graph not found

```bash
cd /root/workspace/md-file-graph
python3 -m venv venv
source venv/bin/activate
pip install -e .
```

### Missing dependencies

```bash
cd /root/workspace/md-file-graph
source venv/bin/activate
pip install -r requirements.txt
```

### Generated HTML missing styles

```bash
cp website/*.css website/static/
```

### Wrong URLs in sitemap

```bash
BASE_URL=https://holistix.so ./build-docs.sh
```

## Files Explained

- **`index.html`** - Main landing page
- **`styles.css`** - Main website styles
- **`docs.css`** - Documentation-specific styles
- **`script.js`** - Navigation and mobile menu
- **`doc-template.html`** - Template for generated docs
- **`build-docs.sh`** - Build script
- **`docs-github.js`** - Reference implementation (optional)
- **`*.svg`** - Logo files
- **`static/`** - Generated output (gitignored)

## Summary

- ✅ Simple: Just run `./build-docs.sh`
- ✅ Fast: Pre-rendered HTML
- ✅ SEO: Complete optimization
- ✅ Clean: No build artifacts in repo
- ✅ Flexible: Customize via template

All documentation is generated from markdown files using md-file-graph with full SEO optimization.

## License

This website is part of the Holistix Forge project and follows the same AGPL v3 license.

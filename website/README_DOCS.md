# Documentation System

This website includes a documentation viewer that can display markdown files from the project. The documentation list is **configurable** via `docs-config.json`.

## Configuration

The documentation system uses `docs-config.json` to determine:
- Which documentation files to include
- How they're organized in the navigation
- What labels to display

### Configuration Format

```json
{
  "sections": [
    {
      "title": "Section Name",
      "items": [
        {
          "label": "Display Name",
          "path": "relative/path/in/docs/directory.md",
          "source": "relative/path/from/repo/root.md"
        }
      ]
    }
  ]
}
```

- **`label`**: The text displayed in the navigation menu
- **`path`**: The path where the file will be stored in `website/docs/` (also used as the doc identifier)
- **`source`**: The path to the source file relative to the repository root

## Setup

1. **Configure documentation** in `docs-config.json`:
   - Add/remove sections as needed
   - Add items to include documentation files
   - Set appropriate labels and paths

2. **Copy documentation files** to the website directory:
   ```bash
   cd website
   ./copy-docs.sh
   ```
   
   This script reads `docs-config.json` and copies all configured files to `website/docs/`.

3. **Access the documentation**:
   - Navigate to `docs.html` in your browser
   - Or click the "Documentation" link in the main navigation

## How It Works

- **Configuration**: `docs-config.json` defines which docs to include
- **Copy Script**: `copy-docs.sh` reads the config and copies files using `jq`
- **Markdown Parser**: Uses [marked.js](https://marked.js.org/) (loaded via CDN) to convert markdown to HTML
- **Dynamic Navigation**: JavaScript generates the sidebar navigation from the config
- **File Loading**: JavaScript fetches markdown files from the `docs/` directory
- **URL Routing**: Uses URL hash (`#path/to/file.md`) to track the current document

## Adding New Documentation

1. **Edit `docs-config.json`** to add your documentation:
   ```json
   {
     "sections": [
       {
         "title": "My Section",
         "items": [
           {
             "label": "My Document",
             "path": "doc/my-section/MY_DOC.md",
             "source": "doc/my-section/MY_DOC.md"
           }
         ]
       }
     ]
   }
   ```

2. **Run the copy script**:
   ```bash
   ./copy-docs.sh
   ```

3. **That's it!** The navigation will automatically update when you reload `docs.html`.

## Requirements

- **jq**: Required for parsing the JSON config in the copy script
  - Install: `sudo apt-get install jq` (Linux) or `brew install jq` (macOS)

## Styling

Documentation styling is in `docs.css`. The markdown content uses the `.markdown-body` class and follows the website's design system.

## Notes

- The documentation files are copied (not symlinked) to ensure they're accessible when the website is deployed
- Run `copy-docs.sh` whenever documentation files are updated
- External links in markdown are preserved
- Relative markdown links (`.md` files) are converted to use the documentation router


// Documentation loader and router

// Configuration loaded from docs-config.json
let DOC_CONFIG = null;
let DOC_PATHS = {};

// Load configuration from docs-config.json
async function loadConfig() {
    try {
        const response = await fetch('docs-config.json');
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
        }
        DOC_CONFIG = await response.json();
        
        // Build DOC_PATHS object from config
        DOC_PATHS = {};
        DOC_CONFIG.sections.forEach(section => {
            section.items.forEach(item => {
                DOC_PATHS[item.path] = `docs/${item.path}`;
            });
        });
        
        return DOC_CONFIG;
    } catch (error) {
        console.error('Error loading documentation config:', error);
        throw error;
    }
}

// Generate navigation from config
function generateNavigation(config) {
    const navEl = document.getElementById('docs-nav');
    if (!navEl) return;
    
    navEl.innerHTML = '';
    
    config.sections.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'nav-section';
        
        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = section.title;
        sectionDiv.appendChild(sectionTitle);
        
        const ul = document.createElement('ul');
        section.items.forEach(item => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.setAttribute('data-doc', item.path);
            a.textContent = item.label;
            li.appendChild(a);
            ul.appendChild(li);
        });
        
        sectionDiv.appendChild(ul);
        navEl.appendChild(sectionDiv);
    });
}

// Configure marked.js
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false,
    });
}

// Get doc path from URL hash or default to README
function getCurrentDoc() {
    const hash = window.location.hash.slice(1);
    return hash || 'README.md';
}

// Load and render markdown file
async function loadDocumentation(docPath) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const contentEl = document.getElementById('doc-content');
    const errorMessageEl = errorEl.querySelector('.error-message');
    
    // Show loading state
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    contentEl.style.display = 'none';
    
    try {
        // Get the actual file path
        const filePath = DOC_PATHS[docPath];
        if (!filePath) {
            throw new Error(`Documentation file "${docPath}" not found in configuration`);
        }
        
        // Fetch the markdown file
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to load: ${response.status} ${response.statusText}`);
        }
        
        const markdown = await response.text();
        
        // Convert markdown to HTML
        if (typeof marked !== 'undefined') {
            const html = marked.parse(markdown);
            contentEl.innerHTML = html;
            
            // Fix relative links in markdown
            fixLinks(contentEl);
            
            // Scroll to top
            window.scrollTo(0, 0);
            
            // Show content
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
            
            // Update active nav item
            updateActiveNav(docPath);
        } else {
            throw new Error('Marked.js library not loaded');
        }
    } catch (error) {
        console.error('Error loading documentation:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorMessageEl.textContent = error.message;
    }
}

// Fix relative links in markdown content
function fixLinks(contentEl) {
    const links = contentEl.querySelectorAll('a[href]');
    links.forEach(link => {
        const href = link.getAttribute('href');
        // If it's a relative markdown link, convert it to our doc system
        if (href.endsWith('.md') && !href.startsWith('http')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const docPath = href.startsWith('../') 
                    ? href.replace('../', '') 
                    : href;
                navigateToDoc(docPath);
            });
        }
    });
}

// Update active navigation item
function updateActiveNav(docPath) {
    const navLinks = document.querySelectorAll('.docs-nav a');
    navLinks.forEach(link => {
        if (link.getAttribute('data-doc') === docPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Navigate to a documentation file
function navigateToDoc(docPath) {
    window.location.hash = docPath;
    loadDocumentation(docPath);
}

// Set up navigation event listeners
function setupNavigation() {
    const navLinks = document.querySelectorAll('.docs-nav a[data-doc]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const docPath = link.getAttribute('data-doc');
            navigateToDoc(docPath);
        });
    });
}

// Initialize documentation page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load configuration first
        await loadConfig();
        
        // Generate navigation from config
        generateNavigation(DOC_CONFIG);
        
        // Set up navigation event listeners
        setupNavigation();
        
        // Load initial documentation
        const initialDoc = getCurrentDoc();
        // Check if the initial doc exists in config
        if (DOC_PATHS[initialDoc]) {
            loadDocumentation(initialDoc);
        } else {
            // Default to first doc in config
            const firstDoc = DOC_CONFIG.sections[0]?.items[0]?.path;
            if (firstDoc) {
                navigateToDoc(firstDoc);
            }
        }
        
        // Handle hash changes
        window.addEventListener('hashchange', () => {
            const docPath = getCurrentDoc();
            if (DOC_PATHS[docPath]) {
                loadDocumentation(docPath);
            }
        });
    } catch (error) {
        console.error('Failed to initialize documentation:', error);
        const navEl = document.getElementById('docs-nav');
        if (navEl) {
            navEl.innerHTML = '<div class="error-nav">Failed to load documentation configuration.</div>';
        }
    }
});


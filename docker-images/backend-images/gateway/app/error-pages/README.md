# Nginx Custom Error Pages

This directory contains custom-styled error pages for nginx that match the Holistix Forge branding.

## Overview

The custom error page template (`error.html`) provides a user-friendly, branded error experience for all gateway-served content. It replaces the default nginx error pages with a modern, responsive design.

## Features

### 1. **Branded Design**
- Matches Holistix Forge color scheme (purple/pink gradient)
- Includes Holistix logo
- Modern, clean UI with glassmorphism effects
- Smooth animations and transitions

### 2. **Dynamic Error Messages**
The template uses nginx SSI (Server Side Includes) to dynamically display error-specific content:

- **400 Bad Request** - Invalid request format
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Access denied
- **404 Not Found** - Service or resource doesn't exist
- **500 Internal Server Error** - Server-side error
- **502 Bad Gateway** - Service not responding
- **503 Service Unavailable** - Temporary unavailability
- **504 Gateway Timeout** - Request timeout

### 3. **Auto-Retry for Service Startup**
For 502 and 503 errors (common when services are starting), the page automatically:
- Retries the request every 3 seconds
- Makes up to 3 retry attempts
- Shows retry progress to the user
- Automatically reloads on success

### 4. **Responsive Design**
- Mobile-friendly layout
- Adapts to all screen sizes
- Touch-optimized buttons and interactions

### 5. **Helpful Actions**
Each error page provides:
- **Try Again** button - Reload the page
- **Go Home** button - Navigate to root
- Links to documentation and GitHub

## Implementation

### Nginx Configuration

The error pages are configured in two places:

#### 1. Base Configuration (`reset-nginx.sh`)

```nginx
error_page 400 401 403 404 500 502 503 504 /error.html;

location = /error.html {
    ssi on;          # Enable Server Side Includes for dynamic content
    internal;        # Only accessible via error_page directive
    root /path/to/error-pages;
}
```

#### 2. Dynamic Container Routes (`update-nginx-locations.sh`)

Each dynamically added user container server block also includes the error page configuration, ensuring consistent error handling across all services.

### Server Side Includes (SSI)

The template uses nginx SSI to access the HTTP status code:

```html
<!--# echo var="status" default="500" -->
```

This allows a single template to handle all error codes dynamically.

**SSI must be enabled** in the location block with `ssi on;`.

## File Structure

```
error-pages/
├── error.html      # Main error page template (with inline CSS/JS)
└── README.md       # This file
```

## Testing Error Pages

### Manual Testing

1. **Test 404 (Not Found)**:
   ```bash
   curl -I https://your-domain.local/nonexistent-path
   ```

2. **Test 502 (Bad Gateway)**:
   - Stop the app-gateway service temporarily
   - Access the gateway URL

3. **Test 503 (Service Unavailable)**:
   - Access a user container service that's still starting

### Visual Testing

Open the error page directly in a browser:
```bash
# Serve locally for testing
cd error-pages
python3 -m http.server 8000

# Then visit: http://localhost:8000/error.html
```

### Browser Testing

Test across different browsers and screen sizes:
- Desktop: Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari, Android Chrome
- Tablet: iPad, Android tablets

## Customization

### Branding

To customize the branding:

1. **Colors**: Update CSS variables in `:root`
   ```css
   :root {
       --primary-purple: #7D1485;
       --dark-purple: #4E1261;
       --accent-pink: #d186e9;
   }
   ```

2. **Logo**: Replace the SVG in the `.logo` div
   ```html
   <div class="logo">
       <!-- Your custom logo SVG here -->
   </div>
   ```

### Error Messages

Error-specific messages are defined in the `errorConfig` JavaScript object:

```javascript
const errorConfig = {
    '404': {
        title: 'Service Not Found',
        message: 'The service you\'re looking for doesn\'t exist.',
        details: 'Check your project configuration...'
    }
    // Add or modify error messages here
};
```

### Auto-Retry Behavior

Adjust retry settings:

```javascript
const maxRetries = 3;        // Number of retry attempts
const retryDelay = 3000;     // Delay between retries (ms)
```

## Troubleshooting

### Error page not showing

1. **Check nginx configuration**:
   ```bash
   sudo nginx -t
   ```

2. **Verify file permissions**:
   ```bash
   ls -la /path/to/error-pages/error.html
   ```

3. **Check SSI is enabled**:
   ```nginx
   location = /error.html {
       ssi on;  # Must be present
       internal;
       root /path/to/error-pages;
   }
   ```

### Status code not displaying

1. **Verify SSI directive syntax**:
   ```html
   <!--# echo var="status" default="500" -->
   ```

2. **Check nginx logs**:
   ```bash
   tail -f /var/log/nginx/error.log
   ```

### Styling issues

1. **Clear browser cache**: Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac)

2. **Verify HTML is being served**: Check response headers:
   ```bash
   curl -I https://your-domain.local/nonexistent
   ```

## Performance

### Optimization

The error page is optimized for fast loading:

- **Inline CSS**: No external stylesheets
- **Inline JavaScript**: No external scripts
- **Small size**: ~15KB (uncompressed)
- **No external dependencies**: Works offline
- **Simple SVG logo**: Minimal overhead

### Caching

Nginx serves the error page with `internal` directive, which means:
- Not directly accessible via URL
- Only served on errors
- No caching headers needed

## Security

### Best Practices

1. **Internal directive**: Error page is not directly accessible
2. **No sensitive information**: Doesn't expose server details
3. **Generic messages**: Error details are user-friendly, not technical
4. **XSS protection**: Content is static HTML/CSS/JS

### Information Disclosure

The error page intentionally provides:
- Generic error messages (safe)
- Helpful guidance (improves UX)
- Links to public documentation (safe)

It does NOT expose:
- Server software versions
- Internal paths or configuration
- Stack traces or debug information
- Database connection details

## Future Enhancements

Potential improvements:

1. **Multilingual support**: Detect browser language and show translated messages
2. **Theme customization**: Support light/dark mode based on system preferences
3. **Error reporting**: Add optional "Report this issue" button
4. **Service status page**: Link to real-time service status dashboard
5. **Contact support**: Integrate with support ticket system

## Related Documentation

- [Gateway Architecture](../../../../doc/architecture/GATEWAY_ARCHITECTURE.md)
- [Nginx Manager Service](../../../../packages/app-ganymede/src/services/nginx-manager.ts)
- [Gateway Scripts README](../README.md)

## License

Part of Holistix Forge Platform - AGPL-3.0

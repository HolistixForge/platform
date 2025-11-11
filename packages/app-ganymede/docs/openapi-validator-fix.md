# OpenAPI Validator Fix

## Problem

The `express-openapi-validator` library was failing at runtime with the error:

```
openapi.validator: validation errors [
  {
    "instancePath": "",
    "schemaPath": "#/additionalProperties",
    "keyword": "additionalProperties",
    "params": {
      "additionalProperty": "default"
    },
    "message": "must NOT have additional properties"
  }
]
Error: openapi.validator: args.apiDoc was invalid.  See the output.
```

## Root Cause

The issue was caused by how **esbuild** handles JSON imports when using namespace imports (`import * as`):

### Original Code (Incorrect)
```typescript
import * as oas from './oas30.json';

setupValidator(app, {
  apiSpec: oas,  // Problem: oas contains extra "default" property
  validateRequests: true,
  // ...
});
```

### Bundled Output (Incorrect)
When esbuild bundled the code, it created:

```javascript
var oas30_exports = {};
__export(oas30_exports, {
  components: () => components,
  default: () => oas30_default,      // <-- Extra "default" property!
  info: () => info,
  openapi: () => openapi,
  paths: () => paths
});

// Later in code:
setupValidator(app, {
  apiSpec: oas30_exports,  // Contains: { openapi, info, paths, components, default }
  // ...
});
```

The resulting `oas30_exports` object had this structure:
```javascript
{
  openapi: "3.0.1",
  info: {...},
  paths: {...},
  components: {...},
  default: { openapi, info, paths, components }  // ❌ INVALID!
}
```

The OpenAPI 3.0 specification schema (used by `express-openapi-validator` for validation) has `additionalProperties: false` at the root level, meaning only these properties are allowed:
- `openapi`
- `info`
- `paths`
- `components`
- `servers` (optional)
- `security` (optional)
- `tags` (optional)
- `externalDocs` (optional)
- Properties matching pattern `^x-` (extensions)

The extra `default` property violated this constraint.

## Solution

Changed from namespace import to default import:

```typescript
// Fixed code:
import oas from './oas30.json';  // Default import instead of namespace import

setupValidator(app, {
  apiSpec: oas,  // Now correctly contains only OpenAPI properties
  validateRequests: true,
  // ...
});
```

### Bundled Output (Correct)
```javascript
var oas30_default = {
  openapi: "3.0.1",
  info: {...},
  paths: {...},
  components: {...}
};

// Later in code:
setupValidator(app, {
  apiSpec: oas30_default,  // ✅ Correct structure!
  // ...
});
```

## Testing

Added tests in `tests/openapi.spec.ts` to prevent regression:

1. **Validates the OAS file structure**: Ensures no extra "default" property
2. **Tests with express-openapi-validator**: Confirms the middleware can be created
3. **Validates with openapi-spec-validator**: External validation using Python tool

## Key Takeaways

1. **Be careful with JSON imports in TypeScript**: The behavior differs between:
   - `import * as name from './file.json'` → Creates namespace with `default` property
   - `import name from './file.json'` → Imports the JSON object directly

2. **esbuild bundling behavior**: Namespace imports of JSON files create both named exports AND a default export

3. **OpenAPI validation is strict**: The validator uses JSON Schema with `additionalProperties: false`, making it sensitive to extra properties

## References

- express-openapi-validator: https://github.com/cdimascio/express-openapi-validator
- OpenAPI 3.0 Schema: https://github.com/OAI/OpenAPI-Specification/blob/master/schemas/v3.0/schema.json
- esbuild JSON handling: https://esbuild.github.io/content-types/#json


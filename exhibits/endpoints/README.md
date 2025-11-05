# Exhibits Dashboard API Endpoints

## File Structure

### Core Files

- **`endpoints_config.js`** - Contains all base constants (APP_PATH, PREFIX, VERSION, ENDPOINT)
- **`index.js`** - Main entry point that combines all endpoint modules

### Endpoint Modules

- **`exhibit-endpoints.js`** - Main exhibit CRUD operations, preview, and sharing
- **`media-endpoints.js`** - All media-related operations (exhibit media, item media, general media)
- **`grid-endpoints.js`** - Grid and grid item operations
- **`item-endpoints.js`** - Standard item operations
- **`heading-endpoints.js`** - Heading operations
- **`timeline-endpoints.js`** - Timeline and timeline item operations
- **`workflow-endpoints.js`** - Publish, suppress, and unlock operations
- **`external-endpoints.js`** - External integrations (repository, Kaltura, subjects)
- **`utility-endpoints.js`** - Reorder, token verification, and recycle operations

## Usage

```javascript
// Import the main module
const endpoints = require('./index')();

// Access endpoints
const exhibitEndpoint = endpoints.exhibits.exhibit_records.endpoint;
```
# Exhibits Dashboard API Endpoints

## File Structure

### Core Files

- **`../../libs/endpoints_config.js`** - Shared URL prelude (`APP_PATH`, `API_ROOT`, `api_base()`) used by every endpoint registry
- **`index.js`** - Main entry point that combines all endpoint modules

### Endpoint Modules

- **`exhibit-endpoints.js`** - Main exhibit CRUD operations, preview, and sharing
- **`media-endpoints.js`** - All media-related operations (exhibit media, item media, general media)
- **`grid-endpoints.js`** - Grid and grid item operations
- **`item-endpoints.js`** - Standard item operations
- **`heading-endpoints.js`** - Heading operations
- **`timeline-endpoints.js`** - Timeline and timeline item operations
- **`workflow-endpoints.js`** - Publish, suppress, and unlock operations
- **`utility-endpoints.js`** - Reorder, token verification, and recycle operations

## Registry shape

Every registry is `<resource>.<http_method>.{ endpoint, description, params?, body? }`.
A resource key holds only HTTP-method keys; where one resource needs two of the
same method, the second gets its own resource key (`exhibit_records` vs
`exhibit_records_list`, `recycled_records` vs `recycled_records_all`).
Paths outside that shape are DEPRECATED aliases, marked as such at the bottom
of the file that defines them.

## Usage

```javascript
// Import the main module
const endpoints = require('./index')();

// Access endpoints
const exhibitEndpoint = endpoints.exhibits.exhibit_records.get.endpoint;
```
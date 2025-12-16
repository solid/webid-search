# Architecture Overview

This document provides a technical overview of the WebID crawler system architecture.

## System Flow

```
┌─────────────────┐
│  User creates   │
│  issue with     │
│  WebID URL      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  GitHub Issue Template                      │
│  (.github/ISSUE_TEMPLATE/crawl-webid.yml)   │
│  - Captures WebID URL                       │
│  - Auto-applies "crawler" label             │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  GitHub Actions Workflow Triggered          │
│  (.github/workflows/crawler.yml)            │
│  Trigger: issues.opened with "crawler"      │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Extract WebID from Issue Body              │
│  - Parse issue markdown                     │
│  - Validate URL format                      │
│  - Generate branch name                     │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Run Crawler Script                         │
│  (scripts/crawl.js)                         │
│  - Fetch WebID document via HTTP            │
│  - Parse RDF (Turtle/JSON-LD/RDF-XML)       │
│  - Extract linked WebIDs                    │
│  - Merge with existing data                 │
│  - Update data/webids.json                  │
└────────┬────────────────────────────────────┘
         │
         ├─── No new WebIDs ─────┐
         │                        │
         ▼                        ▼
┌──────────────────┐    ┌────────────────────┐
│  New WebIDs      │    │  No Changes        │
│  Discovered      │    │  - Add comment     │
│                  │    │  - Close issue     │
│  - Create PR     │    └────────────────────┘
│  - Link issue    │
│  - Add comment   │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Pull Request Created                       │
│  - Title: "WebIDs discovered from..."       │
│  - Body: "Closes #X"                        │
│  - Branch: crawler/sanitized-url            │
│  - Changes: data/webids.json only           │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Manual or Auto-Merge PR                    │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Issue Auto-Closed                          │
│  (via "Closes #X" in PR body)               │
└─────────────────────────────────────────────┘
```

## Components

### 1. Issue Template
**File**: `.github/ISSUE_TEMPLATE/crawl-webid.yml`

- GitHub Form template
- Captures WebID URL (required field)
- Optional description field
- Auto-applies `crawler` label

### 2. GitHub Actions Workflow
**File**: `.github/workflows/crawler.yml`

**Triggers**:
- `issues.opened` with `crawler` label
- `issues.edited` with `crawler` label

**Permissions**:
- `contents: write` - Modify repository files
- `pull-requests: write` - Create PRs
- `issues: write` - Comment on issues

**Steps**:
1. Checkout repository
2. Setup Node.js 18
3. Install npm dependencies
4. Extract WebID from issue body using regex
5. Run crawler script
6. Create PR if changes detected
7. Add comment to issue

### 3. Crawler Script
**File**: `scripts/crawl.js`

**Language**: Node.js (ES2020+)

**Dependencies**:
- `rdflib` - RDF parsing library
- Native `fetch` - HTTP requests (Node 18+)
- Native `fs/promises` - File operations

**Process**:
1. Load existing WebIDs from `data/webids.json`
2. Fetch WebID document with content negotiation
3. Parse RDF based on content-type:
   - `text/turtle`
   - `application/ld+json`
   - `application/rdf+xml`
4. Extract WebIDs using RDF predicates:
   - `foaf:knows` - Social connections
   - `solid:publicTypeIndex` - Solid indexes
   - `foaf:maker` - Content creators
   - `dc:creator` - Dublin Core creator
   - `foaf:primaryTopic` - Primary topic
   - And more...
5. Deduplicate WebIDs
6. Save to `data/webids.json`

### 4. Data Storage
**File**: `data/webids.json`

**Format**:
```json
{
  "lastUpdated": "ISO 8601 timestamp",
  "count": 123,
  "webids": [
    "https://sorted.example/url#1",
    "https://sorted.example/url#2"
  ]
}
```

**Characteristics**:
- Sorted alphabetically
- No duplicates
- Includes metadata (lastUpdated, count)

## Security Considerations

1. **Input Validation**:
   - URL validation before fetching
   - RDF parsing error handling
   - Network error handling

2. **Permissions**:
   - Minimal required permissions
   - No secrets exposed
   - GITHUB_TOKEN scoped to repository

3. **Code Security**:
   - CodeQL scanning enabled
   - No external dependencies for sensitive operations
   - No eval() or dynamic code execution

## Scalability

**Current Implementation**:
- Single WebID per issue
- Sequential processing
- No rate limiting
- In-memory deduplication

**Potential Improvements**:
- Batch processing multiple WebIDs
- Rate limiting for external requests
- Caching of fetched documents
- Parallel crawling
- Queue system for high volume

## Error Handling

1. **Network Errors**: Logged but don't crash crawler
2. **Parse Errors**: Logged, WebID still added to collection
3. **Invalid URLs**: Workflow fails with clear error message
4. **No Changes**: Issue closed with informative comment

## Testing Strategy

See [TESTING.md](TESTING.md) for detailed testing instructions.

**Test Coverage**:
- Manual UI testing via GitHub Issues
- Local script execution
- Error case validation
- End-to-end workflow validation

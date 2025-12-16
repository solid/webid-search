# WebID Search

A collaborative repository for discovering and indexing WebIDs across the decentralized web.

## What is a WebID?

A WebID is a URI (with an HTTP or HTTPS scheme) that denotes a person or agent. When dereferenced, it resolves to a profile document containing RDF (Resource Description Framework) data about the person or agent.

## How It Works

This repository uses an automated crawler system to discover and collect WebIDs:

1. **Submit a WebID**: Create a new issue using the "Crawl WebID" template
2. **Automatic Crawling**: A GitHub Actions workflow automatically:
   - Fetches the WebID document
   - Parses the RDF data
   - Discovers linked WebIDs (friends, contacts, related profiles)
   - Updates the WebID database
3. **Pull Request**: If new WebIDs are found, a PR is automatically created
4. **Auto-Close**: The original issue closes automatically when the PR is merged

## Contributing WebIDs

To contribute a WebID to the collection:

1. Go to the [Issues](../../issues) page
2. Click "New Issue"
3. Select the "Crawl WebID" template
4. Enter the WebID or URL you want to crawl
5. Submit the issue

The crawler will automatically process your submission!

## Data Structure

All discovered WebIDs are stored in [`data/webids.json`](data/webids.json) with the following structure:

```json
{
  "lastUpdated": "2025-12-16T00:00:00.000Z",
  "count": 123,
  "webids": [
    "https://example.com/profile#me",
    "https://another.example/card#i"
  ]
}
```

## Technical Details

### Crawler

The crawler ([`scripts/crawl.js`](scripts/crawl.js)) is a Node.js script that:
- Accepts WebID URLs as command-line arguments
- Fetches and parses RDF data (Turtle, JSON-LD, RDF/XML)
- Extracts WebIDs using common predicates:
  - `foaf:knows` - social connections
  - `solid:publicTypeIndex` - Solid pod indexes
  - `foaf:maker` - content creators
  - And more...
- Deduplicates and stores results

### GitHub Actions

The workflow ([`.github/workflows/crawler.yml`](.github/workflows/crawler.yml)) is triggered when:
- A new issue is created with the `crawler` label (automatic from template)
- An issue with the `crawler` label is edited

## Local Development

You can run the crawler locally:

```bash
# Install dependencies
npm install

# Run the crawler
npm run crawl -- https://example.com/profile#me
```

## License

MIT License - see [LICENSE](LICENSE) for details

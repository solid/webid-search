# WebID Search

A crawler to discover and store Solid WebIDs from the decentralized web.

## What is a WebID?

A [WebID](https://www.w3.org/wiki/WebID) is a unique URI that identifies a person on the web. In the [Solid](https://solidproject.org/) ecosystem, WebIDs point to profile documents that contain information about the user, including links to their data pods and connections to other users via `foaf:knows` relationships.

## Features

- 🔍 **Discover WebIDs** - Crawl Solid pod providers and follow social links
- 🕸️ **Social graph traversal** - Follow `foaf:knows` links to discover connected WebIDs
- 📁 **Multiple output formats** - Save as JSON, Turtle, or both
- 📊 **Index generation** - Creates searchable index files and RDF social graph
- ⏸️ **Resumable** - Resume interrupted crawls from where you left off
- 🛡️ **Polite crawling** - Configurable delays and timeouts

## Installation

```bash
npm install
```

## Usage

### Basic usage

Run the crawler with default settings (crawls from known Solid providers):

```bash
npm run crawl
```

### Start from a specific WebID

```bash
npm run crawl -- https://solidcommunity.net/username/profile/card#me
```

### Custom options

```bash
npm run crawl -- \
  --output ./my-webids \
  --max-webids 500 \
  --max-depth 3 \
  --seed https://solidweb.org/
```

### Resume a previous crawl

```bash
npm run crawl -- --resume --output ./webids
```

## CLI Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--seed <url>` | `-s` | - | Add a seed URL to start crawling from |
| `--output <dir>` | `-o` | `./webids` | Output directory |
| `--max-depth <n>` | `-d` | `2` | Maximum crawl depth |
| `--max-webids <n>` | `-m` | `1000` | Maximum WebIDs to discover |
| `--timeout <ms>` | `-t` | `10000` | Request timeout in milliseconds |
| `--delay <ms>` | - | `500` | Delay between requests |
| `--no-follow-knows` | - | - | Don't follow `foaf:knows` links |
| `--no-raw-turtle` | - | - | Don't save raw Turtle files |
| `--resume` | `-r` | - | Resume from previous crawl |
| `--help` | `-h` | - | Show help message |

## Output Structure

After running the crawler, your output directory will contain:

```
webids/
├── index.json          # Full index with metadata for all discovered WebIDs
├── index.ttl           # RDF graph of discovered WebIDs and their connections
├── webids.txt          # Simple newline-separated list of WebID URIs
└── profiles/           # Individual profile files
    ├── example_com_user_profile_card_me.json
    ├── example_com_user_profile_card_me.ttl
    └── ...
```

### index.json

Contains detailed information about each discovered WebID:

```json
{
  "crawledAt": "2024-01-01T12:00:00.000Z",
  "count": 42,
  "webids": [
    {
      "webid": "https://example.com/user/profile/card#me",
      "name": "Example User",
      "profileDocument": "https://example.com/user/profile/card",
      "oidcIssuers": ["https://solidcommunity.net"],
      "knowsCount": 5,
      "discoveredAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

### index.ttl

An RDF representation of the social graph:

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<https://example.com/user/profile/card#me> a foaf:Person ;
    foaf:name "Example User" ;
    foaf:knows <https://other.com/user/profile/card#me> .
```

## Programmatic Usage

You can also use the crawler as a library:

```typescript
import { WebIDCrawler } from './src/crawler.js';
import { WebIDStorage } from './src/storage.js';

const crawler = new WebIDCrawler({
  maxDepth: 2,
  maxWebIDs: 100,
  followKnows: true,
});

const storage = new WebIDStorage({
  outputDir: './my-webids',
  format: 'both',
});

// Crawl from a specific WebID
const webids = await crawler.crawlFromWebID('https://solidcommunity.net/user/profile/card#me');

// Save results
await storage.saveAll(webids);
```

## Default Seed URLs

When no seed URLs are provided, the crawler starts from known Solid pod providers:

- https://solidcommunity.net/
- https://solidweb.org/
- https://inrupt.net/
- https://solid.redpencil.io/
- https://teamid.live/

## How it Works

1. **Seed Discovery**: Start from known Solid pod providers or user-provided URLs
2. **Profile Parsing**: Fetch and parse RDF profile documents (Turtle format)
3. **WebID Validation**: Identify URIs that represent WebIDs based on RDF type and predicates
4. **Link Following**: Extract `foaf:knows` links to discover connected WebIDs
5. **Storage**: Save discovered WebIDs in multiple formats for easy querying

## Ethical Considerations

This crawler is designed to be respectful of server resources:

- **Rate limiting**: Configurable delay between requests (default 500ms)
- **Timeouts**: Requests timeout after 10 seconds by default
- **User-Agent**: Identifies itself as a crawler
- **Depth limits**: Prevents infinite crawling

Please use responsibly and respect the privacy of WebID owners.

## License

MIT

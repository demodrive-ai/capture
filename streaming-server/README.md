# Screenity Cursor Tracking Server

A FastAPI-based server that receives and stores cursor tracking data from the Screenity Chrome extension in real-time.

## Overview

This server acts as a real-time data collection endpoint for cursor movements, clicks, and other interaction events captured during Screenity screen recordings. It provides:

- Real-time event streaming endpoint
- Periodic data persistence
- Event statistics
- CORS support for Chrome extension

## Setup

### Prerequisites

- Python >= 3.12
- uv (Fast Python package installer)

### Dependencies

- fastapi >= 0.115.8
- uvicorn >= 0.34.0

### Installation

1. Install uv if you haven't already:
```bash
brew install uv
```

2. Create and activate a virtual environment:
```bash
uv venv
uv sync
source .venv/bin/activate  # On Unix/macOS
```

3. Start the server:
```bash
uv run uvicorn server:app --reload
```

The server will start on `http://localhost:8000`.

### Available Endpoints

1. **POST `/streaming-events`**
   - Receives cursor tracking events from the Screenity extension
   - Accepts JSON data with batch information
   - Example request body:
   ```json
   {
     "batchIndex": 1,
     "events": [
       {
         "type": "move",
         "x": 100,
         "y": 200,
         "timestamp": 1612345678900
       }
     ],
     "timestamp": 1612345678900,
     "totalEvents": 100
   }
   ```

2. **GET `/stats`**
   - Returns current statistics about received events
   - Example response:
   ```json
   {
     "totalEvents": 1000,
     "totalBatches": 20,
     "eventTypes": {
       "move": 800,
       "click": 150,
       "mousedown": 25,
       "mouseup": 25
     }
   }
   ```

### Data Storage

The server automatically saves event data to JSON files:
- Files are saved every 10 batches
- Naming format: `cursor_events_YYYYMMDD_HHMMSS.json`
- Each file contains:
  - Total event count
  - Total batch count
  - Last update timestamp
  - Complete event array

## File Structure

```
streaming-server/
├── .venv/                  # Virtual environment
├── __pycache__/           # Python cache
├── cursor_events_*.json   # Generated event files
├── server.py              # Main server implementation
├── pyproject.toml         # Poetry dependencies
└── README.md             # This file
```

## Monitoring

### Console Output

The server provides detailed console logging:
```
=== Received Batch 1 ===
Timestamp: 2024-02-02T12:34:56
Events in batch: 50
Total events received: 150
Total batches received: 3

Event types in this batch:
- move: 35
- click: 10
- mousedown: 3
- mouseup: 2
```

### File Output

Event files are saved with the following structure:
```json
{
  "totalEvents": 1000,
  "totalBatches": 20,
  "lastUpdate": "2024-02-02T12:34:56.789Z",
  "events": [
    {
      "type": "move",
      "x": 100,
      "y": 200,
      "timestamp": 1612345678900
    }
    // ... more events
  ]
}
```

## Integration with Screenity

This server is designed to work with the Screenity Chrome extension's cursor tracking feature. The extension automatically streams cursor events to this server when recording is active.

### Configuration

The extension's CursorTracker is configured to connect to `http://localhost:8000/streaming-events` by default. You can modify this in the extension's `CursorTracker.js` file if needed.

## Performance Considerations

- Events are stored in memory until saved to file
- Files can grow large during long recording sessions (observed up to 27MB per file)
- Consider implementing database storage for production use
- Memory usage increases with number of events

## Data Management

### File Growth
The server generates JSON files that can grow significantly in size:
- Typical file sizes range from ~200KB to 27MB
- Files are generated every 10 batches
- Long recording sessions create multiple files

### Storage Management
To manage storage effectively:

1. **Regular Cleanup**
   ```bash
   # Example cleanup script for files older than 7 days
   find . -name "cursor_events_*.json" -mtime +7 -delete
   ```

2. **Archival Strategy**
   - Consider compressing older files:
   ```bash
   gzip cursor_events_*.json
   ```
   - Or move to long-term storage:
   ```bash
   mkdir -p archives/$(date +%Y%m)
   mv cursor_events_*.json archives/$(date +%Y%m)/
   ```

3. **Monitoring**
   - Check disk usage:
   ```bash
   du -h cursor_events_*.json
   ```
   - Monitor file count:
   ```bash
   ls -l cursor_events_*.json | wc -l
   ```

### Data Analysis
For large datasets:
1. Use streaming JSON parsers for analysis
2. Consider converting to more efficient formats (e.g., parquet)
3. Implement data aggregation strategies

## Future Improvements

- [ ] Add database support for better scalability
- [ ] Implement event filtering and search
- [ ] Add authentication for secure data transmission
- [ ] Add data compression for large event batches
- [ ] Implement data cleanup/archival strategy

## License

This project is part of Screenity and follows its licensing terms.

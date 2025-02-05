from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import json
from datetime import datetime
import os

app = FastAPI()

# Add CORS middleware to allow requests from the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your extension's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store events in memory (you might want to use a database in production)
cursor_events = []
batch_count = 0

@app.post("/streaming-events")
async def receive_streaming_events(request: Request):
    global batch_count
    try:
        # Parse the JSON data
        data = await request.json()
        
        # Extract batch information
        batch_index = data.get('batchIndex', -1)
        events = data.get('events', [])
        timestamp = data.get('timestamp')
        total_events = data.get('totalEvents', 0)
        
        # Add events to our storage
        cursor_events.extend(events)
        batch_count += 1
        
        # Log information about the received batch
        print(f"\n=== Received Batch {batch_index} ===")
        print(f"Timestamp: {datetime.fromtimestamp(timestamp/1000).isoformat()}")
        print(f"Events in batch: {len(events)}")
        print(f"Total events received: {len(cursor_events)}")
        print(f"Total batches received: {batch_count}")
        
        # Log event types distribution in this batch
        event_types = {}
        for event in events:
            event_type = event.get('type', 'unknown')
            event_types[event_type] = event_types.get(event_type, 0) + 1
        print("\nEvent types in this batch:")
        for event_type, count in event_types.items():
            print(f"- {event_type}: {count}")
            
        # Save events to a file periodically (every 10 batches)
        if batch_count % 10 == 0:
            save_path = f"cursor_events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(save_path, 'w') as f:
                json.dump({
                    'totalEvents': len(cursor_events),
                    'totalBatches': batch_count,
                    'lastUpdate': datetime.now().isoformat(),
                    'events': cursor_events
                }, f, indent=2)
            print(f"\nSaved events to {save_path}")
        
        return {
            "status": "success",
            "message": f"Received batch {batch_index} with {len(events)} events",
            "totalEventsReceived": len(cursor_events),
            "totalBatches": batch_count
        }
        
    except Exception as e:
        print(f"Error processing events: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@app.get("/stats")
async def get_stats():
    """Get current statistics about received events"""
    event_types = {}
    for event in cursor_events:
        event_type = event.get('type', 'unknown')
        event_types[event_type] = event_types.get(event_type, 0) + 1
        
    return {
        "totalEvents": len(cursor_events),
        "totalBatches": batch_count,
        "eventTypes": event_types
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
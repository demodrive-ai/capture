Based on my analysis of the codebase, here's a comprehensive plan to enhance the tracking capabilities:
1. Metadata Collection Infrastructure
A. Create a new MetadataTracker class:

```
class MetadataTracker {
  private recordingStartTime: number;
  private currentChunkIndex: number;
  private metadataStore: IDBObjectStore;
  private isTracking: boolean;
  private frameRequestId: number;
  
  constructor() {
    this.recordingStartTime = 0;
    this.currentChunkIndex = 0;
    this.isTracking = false;
  }

  // Core tracking data structure
  interface RecordingMetadata {
    timestamp: number;
    chunkIndex: number;
    recordingState: {
      isRecording: boolean;
      isPaused: boolean;
      quality: string;
      resolution: {width: number, height: number};
      fps: number;
      audioBitsPerSecond: number;
      videoBitsPerSecond: number;
      mimeType: string;
    };
    streamInfo: {
      videoTracks: MediaStreamTrack[];
      audioTracks: MediaStreamTrack[];
      systemAudio: boolean;
      microphoneAudio: boolean;
    };
  }
}
```
B. Integration Points:
Modify startRecording() to initialize metadata tracking:
```
async function startRecording() {
  // Existing initialization code...
  
  // Initialize metadata tracking
  const metadata = {
    timestamp: Date.now(),
    chunkIndex: 0,
    recordingState: {
      isRecording: true,
      isPaused: false,
      quality: qualityValue,
      resolution: {
        width: recorder.current.getVideoTracks()[0].getSettings().width,
        height: recorder.current.getVideoTracks()[0].getSettings().height
      },
      fps: recorder.current.getVideoTracks()[0].getSettings().frameRate,
      audioBitsPerSecond,
      videoBitsPerSecond,
      mimeType: recorder.current.mimeType
    },
    streamInfo: {
      videoTracks: liveStream.current.getVideoTracks(),
      audioTracks: liveStream.current.getAudioTracks(),
      systemAudio: data.systemAudio,
      microphoneAudio: data.micActive
    }
  };
  
  await metadataStore.setItem(`metadata_${index.current}`, metadata);
}
  ```

2. Cursor Tracking Implementation
A. Create a CursorTracker class:
```
class CursorTracker {
  private cursorData: CursorMetadata[] = [];
  private isTracking: boolean = false;
  private lastPosition: {x: number, y: number} = {x: 0, y: 0};
  
  interface CursorMetadata {
    timestamp: number;
    chunkIndex: number;
    position: {
      x: number;
      y: number;
      screenX: number; // Absolute screen coordinates
      screenY: number;
      normalizedX: number; // 0-1 range
      normalizedY: number;
    };
    movement: {
      deltaX: number;
      deltaY: number;
      velocity: number;
    };
    state: {
      isClicked: boolean;
      button: number;
      pressure: number; // For pressure-sensitive input
      tilt: {x: number, y: number}; // For stylus input
    };
    target: {
      element: string;
      className: string;
      id: string;
      href?: string;
      inputValue?: string;
      boundingRect: DOMRect;
      zIndex: number;
    };
  }

  startTracking() {
    this.isTracking = true;
    this.attachEventListeners();
  }

  private attachEventListeners() {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('click', this.handleClick);
    document.addEventListener('contextmenu', this.handleContextMenu);
    document.addEventListener('wheel', this.handleWheel);
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isTracking) return;
    
    const cursorData = this.createCursorMetadata(e);
    this.cursorData.push(cursorData);
    this.lastPosition = {x: e.clientX, y: e.clientY};
  }
}

```
3. Viewport & Scroll Tracking
A. Create a ViewportTracker class:
```
class ViewportTracker {
  private viewportData: ViewportMetadata[] = [];
  private isTracking: boolean = false;
  private lastScrollPosition: {x: number, y: number} = {x: 0, y: 0};
  
  interface ViewportMetadata {
    timestamp: number;
    chunkIndex: number;
    viewport: {
      width: number;
      height: number;
      devicePixelRatio: number;
      orientation: string;
      visualViewport: {
        offsetLeft: number;
        offsetTop: number;
        pageLeft: number;
        pageTop: number;
        width: number;
        height: number;
        scale: number;
      };
    };
    scroll: {
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
      direction: 'horizontal' | 'vertical' | 'none';
      velocity: number;
    };
    visibility: {
      isVisible: boolean;
      visibilityState: DocumentVisibilityState;
      isFullscreen: boolean;
      activeElement: string;
    };
    performance: {
      fps: number;
      memory: MemoryInfo;
      timing: PerformanceTiming;
    };
  }

  startTracking() {
    this.isTracking = true;
    this.attachEventListeners();
    this.startPerformanceMonitoring();
  }

  private attachEventListeners() {
    document.addEventListener('scroll', this.handleScroll);
    window.addEventListener('resize', this.handleResize);
    window.visualViewport?.addEventListener('resize', this.handleVisualViewportChange);
    window.visualViewport?.addEventListener('scroll', this.handleVisualViewportChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }
}
  ```

B. Integration with Existing Code:
Modify the handleDataAvailable function to include metadata:

```
const handleDataAvailable = async (e) => {
  if (e.data.size > 0) {
    const timestamp = e.timecode;
    
    // Get current metadata from trackers
    const cursorMetadata = cursorTracker.getCurrentMetadata();
    const viewportMetadata = viewportTracker.getCurrentMetadata();
    
    // Store chunk with metadata
    await chunksStore.setItem(`chunk_${index.current}`, {
      index: index.current,
      chunk: e.data,
      timestamp,
      metadata: {
        cursor: cursorMetadata,
        viewport: viewportMetadata,
        recording: recordingMetadata
      }
    });
  }
};
```
Add metadata tracking initialization to startStreaming:

```
async function startStreaming(data) {
  // Existing initialization code...
  
  // Initialize trackers
  metadataTracker.startTracking();
  cursorTracker.startTracking();
  viewportTracker.startTracking();
  
  // Add cleanup on stop
  recorder.current.onstop = () => {
    metadataTracker.stopTracking();
    cursorTracker.stopTracking();g
    viewportTracker.stopTracking();
    // Existing cleanup code...
  };
}
```


Steps to implement:
1. Create the base MetadataTracker class
2. Implement the CursorTracker with all event listeners
3. Implement the ViewportTracker with performance monitoring
4. Modify the existing recording code to integrate the trackers
5. Add the metadata storage and retrieval system


Further improvements to cursor tracking:
1. Add throttling/debouncing to optimize performance further?
2. Add batch storage to reduce IndexedDB operations?
3. Add more element tracking capabilities?
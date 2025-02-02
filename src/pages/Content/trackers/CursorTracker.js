// CursorTracker.js
import localforage from "localforage";

class CursorTracker {
  constructor() {
    console.log('[CursorTracker] Initializing');
    this.isTracking = false;
    this.lastPosition = { x: 0, y: 0 };
    this.lastTimestamp = 0;
    this.throttleDelay = 16; // ~60fps tracking
    this.lastMoveTime = 0;
    this.batchSize = 50; // Reduced batch size for more frequent streaming
    this.currentBatch = [];
    this.currentBatchIndex = 0;
    
    // In-memory storage for better performance
    this.events = [];
    
    // Set default streaming endpoint
    this.streamEndpoint = 'http://localhost:8000/streaming-events';
  }

  async startTracking() {
    try {
      console.log('[CursorTracker] Starting tracking');
      this.isTracking = true;
      this.lastPosition = { x: 0, y: 0 };
      this.lastTimestamp = 0;
      this.currentBatch = [];
      this.currentBatchIndex = 0;
      this.events = [];
      this.attachEventListeners();
      console.log('[CursorTracker] Event listeners attached');
    } catch (err) {
      console.error('[CursorTracker] Error starting cursor tracking:', err);
    }
  }

  async stopTracking() {
    try {
      console.log('[CursorTracker] Stopping tracking');
      this.isTracking = false;
      this.detachEventListeners();
      
      // Store any remaining events
      if (this.currentBatch.length > 0) {
        await this.storeBatch();
      }
      
      // Get event counts for logging
      const eventCounts = this.events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('[CursorTracker] Final event counts:', eventCounts);
      console.log(`[CursorTracker] Stopped tracking. Total events captured: ${this.events.length}`);
      
      // Store all events in chrome.storage.local
      await chrome.storage.local.set({
        cursorEvents: this.events,
        cursorEventCounts: eventCounts,
        totalCursorEvents: this.events.length
      });
      
      // Send message about tracking completion
      chrome.runtime.sendMessage({
        type: 'tracking-data',
        data: {
          cursorEvents: this.events,
          totalCursorEvents: this.events.length,
          eventCounts: eventCounts
        }
      });
      
    } catch (err) {
      console.error('[CursorTracker] Error stopping cursor tracking:', err);
    }
  }

  attachEventListeners() {
    console.log('[CursorTracker] Attaching event listeners');
    // Bind the event handlers to this instance
    this.boundMouseMove = this.handleMouseMoveThrottled.bind(this);
    this.boundClick = this.handleClick.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundWheel = this.handleWheel.bind(this);
    this.boundContextMenu = this.handleContextMenu.bind(this);

    // Add event listeners with capture phase to ensure we get all events
    document.addEventListener('mousemove', this.boundMouseMove, { capture: true });
    document.addEventListener('click', this.boundClick, { capture: true });
    document.addEventListener('mousedown', this.boundMouseDown, { capture: true });
    document.addEventListener('mouseup', this.boundMouseUp, { capture: true });
    document.addEventListener('wheel', this.boundWheel, { capture: true });
    document.addEventListener('contextmenu', this.boundContextMenu, { capture: true });
    
    console.log('[CursorTracker] Event listeners attached with capture phase');
  }

  detachEventListeners() {
    console.log('[CursorTracker] Detaching event listeners');
    document.removeEventListener('mousemove', this.boundMouseMove, { capture: true });
    document.removeEventListener('click', this.boundClick, { capture: true });
    document.removeEventListener('mousedown', this.boundMouseDown, { capture: true });
    document.removeEventListener('mouseup', this.boundMouseUp, { capture: true });
    document.removeEventListener('wheel', this.boundWheel, { capture: true });
    document.removeEventListener('contextmenu', this.boundContextMenu, { capture: true });
  }

  handleMouseMoveThrottled = (e) => {
    if (!this.isTracking) return;
    
    const now = Date.now();
    if (now - this.lastMoveTime < this.throttleDelay) {
      return;
    }
    
    this.lastMoveTime = now;
    this.handleMouseMove(e);
  }

  handleMouseDown = (e) => {
    if (!this.isTracking) return;
    this.addEvent({
      t: Date.now(),
      x: e.clientX,
      y: e.clientY,
      type: 'mousedown',
      button: e.button,
      target: this.getTargetInfo(e.target)
    });
  }

  handleMouseUp = (e) => {
    if (!this.isTracking) return;
    this.addEvent({
      t: Date.now(),
      x: e.clientX,
      y: e.clientY,
      type: 'mouseup',
      button: e.button,
      target: this.getTargetInfo(e.target)
    });
  }

  handleWheel = (e) => {
    if (!this.isTracking) return;
    this.addEvent({
      t: Date.now(),
      x: e.clientX,
      y: e.clientY,
      type: 'wheel',
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      target: this.getTargetInfo(e.target)
    });
  }

  handleContextMenu = (e) => {
    if (!this.isTracking) return;
    this.addEvent({
      t: Date.now(),
      x: e.clientX,
      y: e.clientY,
      type: 'contextmenu',
      target: this.getTargetInfo(e.target)
    });
  }

  handleMouseMove = (e) => {
    const now = Date.now();
    const dx = e.clientX - this.lastPosition.x;
    const dy = e.clientY - this.lastPosition.y;
    const dt = now - this.lastTimestamp;
    const speed = Math.sqrt(dx * dx + dy * dy) / (dt || 1);

    this.addEvent({
      t: now,
      x: e.clientX,
      y: e.clientY,
      type: 'move',
      movement: {
        dx,
        dy,
        speed
      },
      target: this.getTargetInfo(e.target)
    });

    this.lastPosition = { x: e.clientX, y: e.clientY };
    this.lastTimestamp = now;
  }

  handleClick = (e) => {
    if (!this.isTracking) return;
    
    // Get more detailed click information
    const clickInfo = {
      t: Date.now(),
      x: e.clientX,
      y: e.clientY,
      type: 'click',
      button: e.button,
      buttons: e.buttons, // Current buttons being pressed
      detail: e.detail,   // Number of clicks (single, double, triple)
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
      target: this.getTargetInfo(e.target)
    };

    console.log('[CursorTracker] Click event:', clickInfo);
    this.addEvent(clickInfo);
  }

  getTargetInfo(target) {
    if (!target || !(target instanceof Element)) return null;

    const rect = target.getBoundingClientRect();
    return {
      tagName: target.tagName.toLowerCase(),
      className: target.className,
      id: target.id,
      href: target instanceof HTMLAnchorElement ? target.href : undefined,
      value: target instanceof HTMLInputElement ? target.value : undefined,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      },
      text: target.textContent?.slice(0, 100),
      xpath: this.getFullXPath(target),
      attributes: this.getElementAttributes(target)
    };
  }

  getFullXPath(element) {
    if (!element) return '';
    if (element.id) return `//*[@id="${element.id}"]`;
    
    const paths = [];
    while (element) {
      let index = 1;
      let sibling = element;
      
      // Count preceding siblings with same tag
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName === element.tagName) index++;
      }
      
      const tagName = element.tagName.toLowerCase();
      const pathIndex = (index > 1) ? `[${index}]` : '';
      paths.unshift(`${tagName}${pathIndex}`);
      
      element = element.parentElement;
    }
    
    return `/${paths.join('/')}`;
  }

  getElementAttributes(element) {
    const attributes = {};
    for (const attr of element.attributes) {
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  async addEvent(event) {
    try {
      if (!this.isTracking) return;
      
      // Add to in-memory array
      this.events.push(event);
      this.currentBatch.push(event);
      
      console.log(`[CursorTracker] Added ${event.type} event at (${event.x}, ${event.y}), total events: ${this.events.length}`);
      
      // When batch is full, store it
      if (this.currentBatch.length >= this.batchSize) {
        await this.storeBatch();
      }
    } catch (err) {
      console.error('[CursorTracker] Error adding cursor event:', err);
    }
  }

  async storeBatch() {
    if (this.currentBatch.length === 0) return;
    
    try {
      // Store batch in chrome.storage.local
      await chrome.storage.local.set({
        [`cursor_batch_${this.currentBatchIndex}`]: this.currentBatch
      });

      // Stream to local FastAPI server
      try {
        const response = await fetch(this.streamEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            batchIndex: this.currentBatchIndex,
            events: this.currentBatch,
            timestamp: Date.now(),
            totalEvents: this.events.length
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`[CursorTracker] Successfully streamed batch ${this.currentBatchIndex} to server:`, result);
      } catch (err) {
        console.error('[CursorTracker] Error streaming batch to server:', err);
        // Continue execution even if streaming fails
      }
      
      console.log(`[CursorTracker] Stored batch ${this.currentBatchIndex} with ${this.currentBatch.length} events`);
      this.currentBatchIndex++;
      this.currentBatch = [];
    } catch (err) {
      console.error('[CursorTracker] Error storing cursor batch:', err);
    }
  }

  // Method to set remote streaming endpoint
  setStreamEndpoint(url) {
    this.streamEndpoint = url;
  }

  // Get all events (now returns from memory)
  getAllEvents() {
    return this.events;
  }

  async clearData() {
    this.events = [];
    this.currentBatch = [];
    this.currentBatchIndex = 0;
    // Clear from chrome.storage.local
    const keys = ['cursorEvents', 'cursorEventCounts', 'totalCursorEvents'];
    await chrome.storage.local.remove(keys);
  }
}

export default CursorTracker; 
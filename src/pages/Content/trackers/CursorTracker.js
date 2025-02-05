// CursorTracker.js
import localforage from "localforage";

class CursorTracker {
  constructor() {
    console.log('[CursorTracker] Initializing');
    this.isTracking = false;
    this.lastPosition = { x: 0, y: 0 };
    this.lastTimestamp = 0;
    this.throttleDelay = 16; // ~60fps tracking Here are the values to set for FPS 16->60 fps, 33 -> 30 fps, 50 -> 20 fps, 100 -> 10 fps
    this.lastMoveTime = 0;
    this.batchSize = 50;
    this.currentBatch = new Set(); // Use Set to prevent duplicates
    this.currentBatchIndex = 0;
    this.sentBatches = new Set(); // Track sent batch IDs
    this.streamingQueue = []; // Queue for batches waiting to be sent
    this.isStreaming = false; // Flag to track if we're currently streaming
    
    // In-memory storage for better performance
    this.events = [];
    
    // Set default streaming endpoint
    this.streamEndpoint = 'http://localhost:8000/streaming-events';

    // Get current tab information
    this.getCurrentTabInfo();

    // Listen for messages from background script
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'start-recording') {
        this.startTracking();
        sendResponse({ success: true });
      } else if (request.type === 'stop-recording') {
        this.stopTracking();
        sendResponse({ success: true });
      }
      return true; // Keep message channel open for async response
    });
  }

  async getCurrentTabInfo() {
    try {
      // Get current tab URL and title
      this.currentUrl = window.location.href;
      this.currentTitle = document.title;

      // Send tab info to background script
      chrome.runtime.sendMessage({
        type: 'cursor-tracker-tab-info',
        data: {
          url: this.currentUrl,
          title: this.currentTitle,
          timestamp: Date.now()
        }
      });

      console.log('[CursorTracker] Updated tab info:', {
        url: this.currentUrl,
        title: this.currentTitle
      });
    } catch (err) {
      console.error('[CursorTracker] Error getting tab info:', err);
    }
  }

  async startTracking() {
    try {
      console.log('[CursorTracker] Starting tracking');
      this.isTracking = true;
      this.lastPosition = { x: 0, y: 0 };
      this.lastTimestamp = 0;
      this.currentBatch = new Set();
      this.currentBatchIndex = 0;
      this.sentBatches = new Set();
      this.streamingQueue = [];
      this.events = [];
      
      // Get initial tab info
      await this.getCurrentTabInfo();
      
      this.attachEventListeners();
      console.log('[CursorTracker] Event listeners attached');

      // Listen for URL changes
      this.setupUrlChangeListener();

      // Send ready message to background script
      chrome.runtime.sendMessage({
        type: 'cursor-tracker-ready',
        data: {
          url: this.currentUrl,
          title: this.currentTitle
        }
      });
    } catch (err) {
      console.error('[CursorTracker] Error starting cursor tracking:', err);
    }
  }

  setupUrlChangeListener() {
    // Listen for URL changes using the History API
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.getCurrentTabInfo();
    };
    
    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.getCurrentTabInfo();
    };
    
    // Listen for regular navigation
    window.addEventListener('popstate', () => {
      this.getCurrentTabInfo();
    });

    // Listen for URL changes via MutationObserver
    const observer = new MutationObserver(() => {
      if (this.currentUrl !== window.location.href) {
        this.getCurrentTabInfo();
      }
    });

    observer.observe(document, {
      subtree: true,
      childList: true
    });
  }

  async stopTracking() {
    try {
      console.log('[CursorTracker] Stopping tracking');
      this.isTracking = false;
      
      // Queue any remaining events
      if (this.currentBatch.size > 0) {
        await this.queueBatchForStreaming();
      }
      
      // Wait for all batches to be sent
      while (this.streamingQueue.length > 0) {
        await this.streamBatches();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.detachEventListeners();
      
      // Get event counts for logging
      const eventCounts = this.events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('[CursorTracker] Final event counts:', eventCounts);
      console.log(`[CursorTracker] Stopped tracking. Total events captured: ${this.events.length}`);
      
      // Clear tracking state
      this.currentBatch.clear();
      this.streamingQueue = [];
      this.sentBatches.clear();
      this.isStreaming = false;
      
      // Store final data
      await chrome.storage.local.set({
        cursorEvents: this.events,
        cursorEventCounts: eventCounts,
        totalCursorEvents: this.events.length
      });
      
      // Send completion message
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
    this.boundScroll = this.handleScroll.bind(this);

    // Add event listeners with capture phase to ensure we get all events
    document.addEventListener('mousemove', this.boundMouseMove, { capture: true });
    document.addEventListener('click', this.boundClick, { capture: true });
    document.addEventListener('mousedown', this.boundMouseDown, { capture: true });
    document.addEventListener('mouseup', this.boundMouseUp, { capture: true });
    document.addEventListener('wheel', this.boundWheel, { capture: true });
    document.addEventListener('contextmenu', this.boundContextMenu, { capture: true });
    document.addEventListener('scroll', this.boundScroll, { capture: true });
    
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
    document.removeEventListener('scroll', this.boundScroll, { capture: true });
  }

  handleScroll = (e) => {
    if (!this.isTracking) return;
    this.addEvent({
      t: Date.now(),
      type: 'scroll',
      scrollX: window.scrollX,
      scrollY: window.scrollY
    });
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
      
      // Generate a unique event ID using timestamp and event properties
      const eventId = `${event.type}_${event.t || Date.now()}_${event.x || 0}_${event.y || 0}`;
      
      // Enrich event with tab information
      const enrichedEvent = {
        ...event,
        id: eventId,
        url: this.currentUrl,
        title: this.currentTitle,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        },
        timestamp: Date.now()
      };
      
      // Add to in-memory array and current batch
      this.events.push(enrichedEvent);
      this.currentBatch.add(enrichedEvent);
      
      // When batch is full, queue it for streaming
      if (this.currentBatch.size >= this.batchSize) {
        await this.queueBatchForStreaming();
      }
    } catch (err) {
      console.error('[CursorTracker] Error adding cursor event:', err);
    }
  }

  async queueBatchForStreaming() {
    if (this.currentBatch.size === 0) return;

    // Convert Set to Array and create batch object
    const batchEvents = Array.from(this.currentBatch);
    const batchId = `${this.currentBatchIndex}_${Date.now()}`;
    
    const batch = {
      id: batchId,
      batchIndex: this.currentBatchIndex,
      events: batchEvents,
      timestamp: Date.now(),
      totalEvents: this.events.length
    };

    // Add to queue and clear current batch
    this.streamingQueue.push(batch);
    this.currentBatch.clear();
    this.currentBatchIndex++;

    // Start streaming if not already streaming
    if (!this.isStreaming) {
      this.streamBatches();
    }
  }

  async streamBatches() {
    if (this.isStreaming || !this.isTracking) return;
    
    this.isStreaming = true;
    
    try {
      while (this.streamingQueue.length > 0 && this.isTracking) {
        const batch = this.streamingQueue.shift();
        
        // Skip if this batch was already sent
        if (this.sentBatches.has(batch.id)) {
          continue;
        }

        try {
          const response = await fetch(this.streamEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(batch)
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Mark batch as sent
          this.sentBatches.add(batch.id);
          
          // Log success
          console.log(`[CursorTracker] Successfully streamed batch ${batch.batchIndex} with ${batch.events.length} events`);
          
        } catch (err) {
          console.error('[CursorTracker] Error streaming batch:', err);
          // Put batch back in queue for retry
          this.streamingQueue.unshift(batch);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } finally {
      this.isStreaming = false;
      
      // If there are still events in the current batch, queue them
      if (this.currentBatch.size > 0) {
        await this.queueBatchForStreaming();
      }
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
    this.currentBatch = new Set();
    this.currentBatchIndex = 0;
    this.sentBatches = new Set();
    this.streamingQueue = [];
    // Clear from chrome.storage.local
    const keys = ['cursorEvents', 'cursorEventCounts', 'totalCursorEvents'];
    await chrome.storage.local.remove(keys);
  }
}

export default CursorTracker; 
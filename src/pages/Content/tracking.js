// Content script for cursor tracking
import CursorTracker from './trackers/CursorTracker';
import MetadataTracker from './trackers/MetadataTracker';

console.log('[Tracking] Content script loaded and initialized');

// Initialize trackers
let cursorTracker = null;
let metadataTracker = null;

// Initialize tracking immediately if we're in a recording session
chrome.storage.local.get(['recording'], (result) => {
  if (result.recording) {
    initializeTracking();
  }
});

function initializeTracking() {
  try {
    console.log('[Tracking] Initializing trackers');
    cursorTracker = new CursorTracker();
    metadataTracker = new MetadataTracker();
    
    // Start tracking immediately
    cursorTracker.startTracking();
    metadataTracker.startTracking();
    
    console.log('[Tracking] Trackers initialized and started');
  } catch (err) {
    console.error('[Tracking] Error initializing trackers:', err);
  }
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Tracking] Received message:', request.type);
  
  if (request.type === 'start-recording') {
    console.log('[Tracking] Initializing trackers for recording');
    try {
      if (!cursorTracker) {
        initializeTracking();
      } else {
        cursorTracker.startTracking();
        metadataTracker?.startTracking();
      }
      
      console.log('[Tracking] Successfully started tracking');
      sendResponse({ success: true });
    } catch (err) {
      console.error('[Tracking] Error starting tracking:', err);
      sendResponse({ success: false, error: err.message });
    }
  } else if (request.type === 'stop-recording') {
    console.log('[Tracking] Stopping recording and collecting tracking data');
    try {
      // Stop tracking when recording ends
      if (cursorTracker) {
        cursorTracker.stopTracking();
      }
      if (metadataTracker) {
        metadataTracker.stopTracking();
      }
      
      // Get tracking data
      Promise.all([
        cursorTracker?.getAllEvents(),
        metadataTracker?.getRecordingMetadata()
      ]).then(([cursorEvents, metadata]) => {
        console.log('[Tracking] Collected tracking data:', {
          cursorEventsCount: cursorEvents?.length || 0,
          hasMetadata: !!metadata
        });
        
        // Send tracking data back to the extension
        chrome.runtime.sendMessage({
          type: 'tracking-data',
          data: {
            cursorEvents,
            metadata
          }
        });
      });
      
      console.log('[Tracking] Successfully stopped tracking');
      sendResponse({ success: true });
    } catch (err) {
      console.error('[Tracking] Error stopping tracking:', err);
      sendResponse({ success: false, error: err.message });
    }
  } else if (request.type === 'check-tracking-status') {
    // Respond with current tracking status
    sendResponse({
      isTracking: cursorTracker?.isTracking || false,
      hasTrackers: !!cursorTracker
    });
  }
  
  return true; // Keep message channel open for async response
}); 
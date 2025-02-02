// Content script for cursor tracking
import CursorTracker from './trackers/CursorTracker';
import MetadataTracker from './trackers/MetadataTracker';

console.log('[Tracking] Content script loaded and initialized');

// Initialize trackers
let cursorTracker = null;
let metadataTracker = null;

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Tracking] Received message:', request.type);
  
  if (request.type === 'start-recording') {
    console.log('[Tracking] Initializing trackers for recording');
    try {
      // Initialize trackers when recording starts
      cursorTracker = new CursorTracker();
      metadataTracker = new MetadataTracker();
      
      // Start tracking
      cursorTracker.startTracking();
      metadataTracker.startTracking();
      
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
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
}); 
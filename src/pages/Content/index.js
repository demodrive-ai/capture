import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/app.scss";
import Content from "./Content";
import { printLine } from './modules/print';
import CursorTracker from './trackers/CursorTracker';
import MetadataTracker from './trackers/MetadataTracker';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React>
    <Content />
  </React>
);

console.log('Content script works!');
console.log('Must reload extension for modifications to take effect');

console.log('[Content] Script loaded and initialized');

// Initialize trackers
let cursorTracker = null;
let metadataTracker = null;

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Received message:', request.type);
  
  if (request.type === 'start-recording') {
    console.log('[Content] Initializing trackers for recording');
    try {
      // Initialize trackers when recording starts
      cursorTracker = new CursorTracker();
      metadataTracker = new MetadataTracker();
      
      // Start tracking
      cursorTracker.startTracking();
      metadataTracker.startTracking();
      
      console.log('[Content] Successfully started tracking');
      sendResponse({ success: true });
    } catch (err) {
      console.error('[Content] Error starting tracking:', err);
      sendResponse({ success: false, error: err.message });
    }
  } else if (request.type === 'stop-recording') {
    console.log('[Content] Stopping recording and collecting tracking data');
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
        console.log('[Content] Collected tracking data:', {
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
      
      console.log('[Content] Successfully stopped tracking');
      sendResponse({ success: true });
    } catch (err) {
      console.error('[Content] Error stopping tracking:', err);
      sendResponse({ success: false, error: err.message });
    }
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

printLine("Using the 'printLine' function from the Print Module");

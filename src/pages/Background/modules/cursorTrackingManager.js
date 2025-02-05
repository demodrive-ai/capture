// cursorTrackingManager.js

let isRecording = false;
let recordingWindowId = null;
let cursorEvents = [];
let activeTabId = null;

// Initialize tracking for a window
export const startWindowTracking = async (windowId) => {
  isRecording = true;
  recordingWindowId = windowId;
  cursorEvents = [];
  
  // Set recording state in storage
  await chrome.storage.local.set({ recording: true });
  
  // Get all tabs in the recording window
  const tabs = await chrome.tabs.query({ windowId });
  
  // Inject tracking script into all tabs
  for (const tab of tabs) {
    await injectTrackingScript(tab.id);
  }

  // Listen for tab updates during recording
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.tabs.onActivated.addListener(({ tabId }) => handleTabActivated(tabId));
  chrome.tabs.onCreated.addListener(handleNewTab);

  console.log('[CursorTrackingManager] Started tracking in window:', windowId);
};

// Stop tracking and return collected events
export const stopWindowTracking = async () => {
  isRecording = false;
  
  // Update recording state in storage
  await chrome.storage.local.set({ recording: false });
  
  const events = [...cursorEvents];
  cursorEvents = [];
  recordingWindowId = null;
  
  // Remove tab listeners
  chrome.tabs.onUpdated.removeListener(handleTabUpdated);
  chrome.tabs.onActivated.removeListener(handleTabActivated);
  chrome.tabs.onCreated.removeListener(handleNewTab);
  
  console.log('[CursorTrackingManager] Stopped tracking, collected events:', events.length);
  return events;
};

// Handle new tab creation
const handleNewTab = async (tab) => {
  if (!isRecording || tab.windowId !== recordingWindowId) return;
  
  console.log('[CursorTrackingManager] New tab created:', tab.id);
  
  // Wait for tab to complete loading before injecting scripts
  const checkAndInject = async () => {
    const updatedTab = await chrome.tabs.get(tab.id);
    if (updatedTab.status === 'complete') {
      await injectTrackingScript(tab.id);
    } else {
      // Retry after a short delay
      setTimeout(checkAndInject, 100);
    }
  };
  
  await checkAndInject();
};

// Inject tracking script into a new tab
export const injectTrackingScript = async (tabId) => {
  try {
    // Check if we're recording and if the tab is in the recording window
    if (!isRecording) return;
    
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId !== recordingWindowId) return;

    // Skip chrome:// and chrome-extension:// URLs
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }

    console.log(`[CursorTrackingManager] Injecting scripts into tab ${tabId}`);

    // Check if tracking is already initialized
    try {
      const [response] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return window.hasOwnProperty('cursorTracker');
        }
      });

      if (response?.result) {
        console.log(`[CursorTrackingManager] Tracking already initialized in tab ${tabId}`);
        return;
      }
    } catch (err) {
      // Ignore errors, proceed with injection
    }

    // Inject all necessary content scripts in order
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScript.bundle.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['tracking.bundle.js']
    });

    // Wait a moment for scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Start tracking in the tab
    chrome.tabs.sendMessage(tabId, { type: 'start-recording' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`[CursorTrackingManager] Error starting tracking in tab ${tabId}:`, chrome.runtime.lastError);
        return;
      }
      
      if (response?.success) {
        console.log(`[CursorTrackingManager] Successfully started tracking in tab ${tabId}`);
      } else {
        console.error(`[CursorTrackingManager] Failed to start tracking in tab ${tabId}`);
      }
    });

  } catch (err) {
    console.error(`[CursorTrackingManager] Error injecting tracking script into tab ${tabId}:`, err);
  }
};

// Handle cursor events from tabs
export const handleCursorEvent = (tabId, event) => {
  if (!isRecording || !event) return;

  // Get tab info
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error('[CursorTrackingManager] Error getting tab info:', chrome.runtime.lastError);
      return;
    }

    // Add tab information to the event
    const enrichedEvent = {
      ...event,
      tabId,
      tabUrl: tab.url,
      tabTitle: tab.title,
      timestamp: Date.now()
    };

    cursorEvents.push(enrichedEvent);
    
    // Log for debugging
    console.log(`[CursorTrackingManager] Received ${event.type} event from tab ${tabId}`);
  });
};

// Handle tab activation
export const handleTabActivated = async (tabId) => {
  if (!isRecording) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId !== recordingWindowId) return;

    activeTabId = tabId;
    console.log(`[CursorTrackingManager] Tab activated: ${tabId}`);

    // Check if tracking is active in this tab
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'check-tracking-status' });
      if (!response?.isTracking) {
        console.log(`[CursorTrackingManager] Tracking not active in tab ${tabId}, injecting scripts`);
        await injectTrackingScript(tabId);
      }
    } catch (err) {
      // If we can't communicate with the tab, inject the scripts
      console.log(`[CursorTrackingManager] No tracking in tab ${tabId}, injecting scripts`);
      await injectTrackingScript(tabId);
    }
  } catch (err) {
    console.error(`[CursorTrackingManager] Error handling tab activation:`, err);
  }
};

// Handle tab updates (URL changes, etc.)
export const handleTabUpdated = async (tabId, changeInfo, tab) => {
  if (!isRecording) return;
  if (tab.windowId !== recordingWindowId) return;

  // Only reinject when the page has completed loading
  if (changeInfo.status === 'complete') {
    console.log(`[CursorTrackingManager] Tab ${tabId} updated, reinjecting tracking scripts`);
    await injectTrackingScript(tabId);
  }
};

// Get all collected cursor events
export const getAllCursorEvents = () => {
  return cursorEvents;
};

// Clear all cursor events
export const clearCursorEvents = () => {
  cursorEvents = [];
}; 
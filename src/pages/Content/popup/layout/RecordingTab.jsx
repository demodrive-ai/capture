import React, { useEffect, useState, useContext } from "react";
import * as Tabs from "@radix-ui/react-tabs";

import RecordingType from "./RecordingType";
import {
  ScreenTabOn,
  ScreenTabOff,
  RegionTabOn,
  RegionTabOff,
  MockupTabOn,
  MockupTabOff,
  CameraTabIconOn,
  CameraTabIconOff,
} from "../../images/popup/images";

// Context
import { contentStateContext } from "../../context/ContentState";

const RecordingTab = (props) => {
  const [contentState, setContentState] = useContext(contentStateContext);

  const onValueChange = (tab) => {
    setContentState((prevContentState) => ({
      ...prevContentState,
      recordingType: tab,
    }));
    chrome.storage.local.set({ recordingType: tab });

    if (tab === "camera") {
      chrome.runtime.sendMessage({ type: "camera-only-update" });
    } else {
      chrome.runtime.sendMessage({ type: "screen-update" });
    }
  };

  return (
    <div className="recording-ui">
      <Tabs.Root
        className="TabsRoot"
        defaultValue="screen"
        onValueChange={onValueChange}
        value={contentState.recordingType}
      >
        <Tabs.List
          className="TabsList"
          aria-label="Manage your account"
          tabIndex={0}
        >
          <Tabs.Trigger className="TabsTrigger" value="screen" tabIndex={0}>
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "screen"
                      ? ScreenTabOn
                      : ScreenTabOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("screenType")}</span>
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger className="TabsTrigger" value="region" tabIndex={0}>
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "region"
                      ? RegionTabOn
                      : RegionTabOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("tabType")}</span>
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger className="TabsTrigger" value="camera" tabIndex={0}>
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "camera"
                      ? CameraTabIconOn
                      : CameraTabIconOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("cameraType")}</span>
            </div>
          </Tabs.Trigger>
          <Tabs.Trigger
            className="TabsTrigger"
            value="mockup"
            tabIndex={0}
            disabled
            style={{ pointerEvents: "none", opacity: 0.5 }}
          >
            <div className="TabsTriggerLabel">
              <div className="TabsTriggerIcon">
                <img
                  src={
                    contentState.recordingType === "mockup"
                      ? MockupTabOn
                      : MockupTabOff
                  }
                />
              </div>
              <span>{chrome.i18n.getMessage("MockupType")}</span>
            </div>
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content className="TabsContent" value="screen">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="region">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="camera">
          <RecordingType shadowRef={props.shadowRef} />
        </Tabs.Content>
        <Tabs.Content className="TabsContent" value="mockup">
          WIP
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

export default RecordingTab;

<style>
{`
.recording-ui {
  background-color: hsl(240 10% 3.9%);
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

.TabsRoot {
  display: flex;
  flex-direction: column;
}

.TabsList {
  display: flex;
  justify-content: space-between;
  background-color: hsl(240 6% 10%);
  border-bottom: 1px solid hsl(240 3.7% 15.9%);
  padding: 4px;
}

.TabsTrigger {
  all: unset;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  font-size: 14px;
  line-height: 1;
  color: hsl(240 5% 64.9%);
  user-select: none;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.TabsTrigger:hover {
  color: hsl(0 0% 98%);
  background-color: hsl(240 5% 26%);
}

.TabsTrigger[data-state="active"] {
  color: hsl(0 0% 98%);
  background-color: hsl(240 3.7% 15.9%);
}

.TabsTriggerLabel {
  display: flex;
  align-items: center;
  gap: 8px;
}

.TabsTriggerIcon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.TabsTriggerIcon img {
  width: 16px;
  height: 16px;
  opacity: 0.9;
}

.TabsContent {
  flex-grow: 1;
  padding: 16px;
  background-color: hsl(240 10% 3.9%);
  outline: none;
}

.TabsContent[data-state="inactive"] {
  display: none;
}
`}
</style>

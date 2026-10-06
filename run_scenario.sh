#!/bin/bash
# usage: run_scenario.sh <button text substring> [udid]   (run from a dir with an agent-device session on the simulator)
U=${2:-511CE0CC-AA60-403B-BD36-2D2DD8D8E295}
APP=org.reactjs.native.example.RNSPushTwiceRepro
agent-device open $APP --platform ios --relaunch >/dev/null 2>&1
agent-device logs clear --restart >/dev/null 2>&1
sleep 6
L=$(agent-device logs path 2>/dev/null | tail -1)
agent-device find "$1" >/dev/null 2>&1
sleep 4
echo "--- $1: exception=$(grep -c 'pushing the same view controller instance' "$L") alive=$(xcrun simctl spawn $U launchctl list | grep -c RNSPushTwiceRepro)"

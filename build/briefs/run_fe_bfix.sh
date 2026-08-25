#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-frontend
opencode run --agent midas "$(cat ../build/briefs/fe_blocker_fix.md)"

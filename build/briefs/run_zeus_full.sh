#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-backend
opencode run --agent zeus "$(cat ../build/briefs/zeus_handoff_run.md)"

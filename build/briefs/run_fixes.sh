#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-backend
opencode run --agent zeus "$(cat ../build/briefs/defect_fixes.md)"

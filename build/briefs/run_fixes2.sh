#!/bin/bash
sleep 90
cd /home/santhosh/projects/ClanMind/clanmind-backend
opencode run --agent zeus "$(cat ../build/briefs/deep_audit_fixes.md)"

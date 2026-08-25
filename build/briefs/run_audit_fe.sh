#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-frontend
opencode run --agent midas "$(cat ../build/briefs/audit_fe_todo.md)"

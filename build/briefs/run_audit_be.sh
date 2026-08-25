#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-backend
opencode run --agent zeus "$(cat ../build/briefs/audit_be_todo.md)"

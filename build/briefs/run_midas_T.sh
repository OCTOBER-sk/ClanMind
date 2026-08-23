#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-frontend
opencode run --agent midas "$(cat ../build/briefs/midas_T1T3.md)"

#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-frontend
opencode run --agent midas "$(cat ../build/briefs/midas_p12.md)"

#!/usr/bin/env bash
# Seed real tasks/decisions/artifacts into the QA group's project (frontendqa).
set -uo pipefail
cd /home/santhosh/projects/ClanMind/clanmind-backend
SUP=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-); SBP=$(grep -oE '^SBP_MANAGEMENT_TOKEN=.*' apps/worker/.dev.vars | cut -d= -f2-)
ANON=$(curl -s -m 12 -H "Authorization: Bearer $SBP" https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/api-keys 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print([k['api_key'] for k in d if k['name']=='anon'][0])")
TOK=$(curl -s -m 12 -X POST "$SUP/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"email":"frontendqa@clanmind.io","password":"ClanMind#QA#2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
GID="85b2dcff-1d25-4b02-9066-ea5d10dac06c"; B="http://localhost:8787"
AUTH="Authorization: Bearer $TOK"
# find project id
PID=$(curl -s -m 10 "$B/api/v1/groups/$GID/projects" -H "$AUTH" | python3 -c "import sys,json;d=json.load(sys.stdin);it=d.get('items') or d if isinstance(d,list) else d.get('items',[]);print(it[0]['id'] if it else '')")
echo "PID=$PID"
echo "### tasks"
curl -s -m 10 -X POST "$B/api/v1/projects/$PID/tasks" -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"Implement STM32 SPI1 DMA TX driver","description":"Wire SPI1 TX to DMA1 channel 3 with correct NVIC priority and circular mode for continuous telemetry."}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('task1',d.get('id') or d.get('error'))"
curl -s -m 10 -X POST "$B/api/v1/projects/$PID/tasks" -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"Document IRQ priority + gotcha for F446","priority":"HIGH"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('task2',d.get('id') or d.get('error'))"
echo "### decision"
DID=$(curl -s -m 10 -X POST "$B/api/v1/projects/$PID/decisions" -H "$AUTH" -H "Content-Type: application/json" -d '{"title":"Adopt SPI+DMA-1 channel 3 over interrupt-driven TX","context":"DMA cuts per-transfer CPU time and enables circular mode; reduces latency vs interrupt TX."}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id') or d.get('error'))")
echo "decision id=$DID"
echo "### artifacts (multiple types)"
for t in "DOCUMENT|STM32 SPI-DMA technical brief|# SPI-DMA on F446\\n\\n## Mapping\\nSPI1_TX -> DMA1 ch3 (APB2).\\n## IRQ\\nNVIC: DMA1_Stream priority low, no preempt clash with timing ISRs.\\n## Gotcha\\nWait for transfer complete before re-arming; else corruption." "TABLE|TELEMETRY_FIELDS|field,type,unit\\nvoltage,uint16,mV\\ncurrent,uint16,mA\\ntemp,int16,C" "CHART|TELEMETRY_TIMELINE|{\"series\":[{\"name\":\"cpu_load\",\"points\":[12,31,42,38,54]},{\"name\":\"buffer_free\",\"points\":[98,95,88,91,80]}]}" "CODE|dma_init.c|static void spi1_tx_dma_init(void) { DMA1_Stream3->CR &= ~DMA_SxCR_EN; DMA1_Stream3->PAR = (uint32_t)&SPI1->DR; DMA1_Stream3->M0AR = (uint32_t)tx_buf; DMA1_Stream3->NDTR = len; DMA1_Stream3->CR = ccr; DMA1_Stream3->CR |= DMA_SxCR_EN; }" "DIAGRAM|SPI1_TX_DATAFLOW|flow start -> SPI_DMA_Map -> NVIC_prio -> transfer_complete -> next_packet" ; do
  IFS='|' read -r TYP NAME CONTENT <<< "$t"
  R=$(curl -s -m 10 -X POST "$B/api/v1/projects/$PID/artifacts" -H "$AUTH" -H "Content-Type: application/json" -d "$(python3 -c "import json,sys;print(json.dumps({'name':sys.argv[1],'artifact_type':sys.argv[2],'content_type':'text/markdown' if sys.argv[2] not in ('TABLE','CHART') else 'application/json','content':sys.argv[3]}))" "$NAME" "$TYP" "$CONTENT")")
  echo "artifact[$TYP] $(echo $R | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('artifact')or{}).get('id') or d.get('error'))" 2>/dev/null)"
done
echo "GID=$GID PID=$PID" > /tmp/seed_refs.txt
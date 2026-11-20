"""Optional local bridge: reads public finale signal, invokes a LOCAL Streamer.bot action.
Python 3 standard library only. Set env vars per README. No inbound server is opened.
"""
import json, os, time, urllib.request, urllib.parse
url=os.environ.get('ISLAND_SUPABASE_URL','').rstrip('/')
key=os.environ.get('ISLAND_PUBLIC_KEY','')
action=os.environ.get('ISLAND_SB_ACTION','Dani Island Finale')
port=int(os.environ.get('ISLAND_SB_PORT','7474'))
if not url.startswith('https://') or not key or not 1<=port<=65535: raise SystemExit('Set ISLAND_SUPABASE_URL and ISLAND_PUBLIC_KEY first.')
headers={'apikey':key}
if not key.startswith('sb_publishable_'): headers['Authorization']='Bearer '+key
last=None
print('Listening for new finale tokens. Start before the event. Ctrl+C to stop.',flush=True)
while True:
    try:
        req=urllib.request.Request(url+'/rest/v1/island_event?singleton=eq.true&select=revealed,finale_token',headers=headers)
        with urllib.request.urlopen(req,timeout=8) as r: event=json.load(r)[0]
        token=event.get('finale_token') or ''
        if last is not None and event.get('revealed') and token and token!=last:
            # Mark seen before sending: avoid replaying a possibly executed action on ambiguous HTTP failures.
            last=token
            body=json.dumps({'action':{'name':action},'args':{'islandFinaleToken':token}}).encode()
            req=urllib.request.Request(f'http://127.0.0.1:{port}/DoAction',data=body,headers={'Content-Type':'application/json'},method='POST')
            with urllib.request.urlopen(req,timeout=8) as r: print('Action request completed:',r.status,flush=True)
        last=token
    except KeyboardInterrupt: break
    except Exception as exc: print('Poll/action failed:',exc,flush=True)
    time.sleep(2)

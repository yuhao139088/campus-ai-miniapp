"""Process ONLY original CampusPilot assets through the installed upstream HTTP service.
Does not claim to remove pixel or statistical watermarks. Keeps prompt/source audit.
"""
import base64,json,os,sys,urllib.request
from pathlib import Path
base=os.environ.get('WATERMARKS_SERVICE_URL','http://127.0.0.1:8765').rstrip('/')
def call(route,body=None):
    req=urllib.request.Request(base+route,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)
call('/health')
reports=[]
for name in sys.argv[1:]:
    p=Path(name).resolve();workspace=Path(__file__).resolve().parents[2]
    if not p.is_relative_to(workspace/'assets') and not p.is_relative_to(workspace/'miniapp'/'assets'):
        raise SystemExit('Only original project asset directories are permitted')
    payload={'file':base64.b64encode(p.read_bytes()).decode(),'name':p.name}
    inspection=call('/inspect',payload)
    result=call('/clean',{**payload,'options':{'strip_all_metadata':True}})
    if not result.get('ok') or not result.get('cleaned'):raise SystemExit('Cleaning failed')
    p.write_bytes(base64.b64decode(result['cleaned']))
    reports.append({'asset':str(p.relative_to(workspace)),'inspection':inspection,'report':result.get('report')})
report_path=Path('AI交接/asset-cleaning.json')
existing=json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else []
report_path.write_text(json.dumps(existing+reports,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Inspected and processed {len(reports)} original assets; source records retained.')

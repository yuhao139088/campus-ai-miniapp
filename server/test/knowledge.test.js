import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { crc32 } from "node:zlib";
import { extractFile, resolvePublicUrl, publicAddress, makeKnowledgeDocument, chunkDocument } from "../src/knowledge.js";
import { GroundedAgent } from "../src/grounded-agent.js";
import { createApp } from "../src/app.js";
import { LocalStore } from "../src/store.js";

function zip(filename, content) {
  const name = Buffer.from(filename), bytes = Buffer.from(content), crc = crc32(bytes);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt32LE(crc,14); header.writeUInt32LE(bytes.length,18); header.writeUInt32LE(bytes.length,22); header.writeUInt16LE(name.length,26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt32LE(crc,16); central.writeUInt32LE(bytes.length,20); central.writeUInt32LE(bytes.length,24); central.writeUInt16LE(name.length,28);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1,8); end.writeUInt16LE(1,10); end.writeUInt32LE(central.length+name.length,12); end.writeUInt32LE(header.length+name.length+bytes.length,16);
  return Buffer.concat([header,name,bytes,central,name,end]);
}
function pdf(text) {
  const objects = ['<</Type/Catalog/Pages 2 0 R>>','<</Type/Pages/Kids[3 0 R]/Count 1>>','<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 800]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>','<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'];
  const stream=`BT /F1 12 Tf 30 700 Td (${text}) Tj ET`; objects.push(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
  let result='%PDF-1.4\n'; const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(result));result+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const at=Buffer.byteLength(result);result+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map((x)=>String(x).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${at}\n%%EOF`;
  return Buffer.from(result);
}
const text = "奖学金申请通知：申请人绩点须达到3.5。须提交成绩单。申请表填写姓名、学院和申请理由。截止日期为2026年11月18日。";
const doc = makeKnowledgeDocument({schoolId:"s",title:"测试通知（虚构）",sourceType:"text"},{sections:[{label:"通知正文",text}]},"u");
const source = chunkDocument(doc)[0];
function groundedOutput(sourceId = source.sourceId) {
  const evidence=(quote)=>[{sourceId,quote}];
  return {title:"奖学金申请",intent:"scholarship",answer:"请核对绩点，准备成绩单并填写表单。",questions:[],
    criteria:[{rule:"绩点达到3.5",status:"met",explanation:"按提供信息初步符合",profileKeys:["绩点"],evidence:evidence("申请人绩点须达到3.5")}],
    materials:[{name:"成绩单",required:true,guidance:"准备成绩单",evidence:evidence("须提交成绩单")}],
    steps:[{title:"提交成绩单",description:"按通知准备材料",evidence:evidence("须提交成绩单")}],
    formFields:[{key:"姓名",required:true,type:"text",evidence:evidence("申请表填写姓名、学院和申请理由")}],
    deadline:{date:"2026-11-18",explanation:"通知日期",evidence:evidence("截止日期为2026年11月18日")}};
}
test("URL importing blocks loopback, mapped IPv6, mixed DNS, credentials and non-web protocols", async () => {
  for(const ip of ["127.0.0.1","10.1.2.3","192.168.5.5","169.254.169.254","::1","::ffff:127.0.0.1","fc00::1","192.0.2.1"]) assert.equal(publicAddress(ip),false,ip);
  const resolver=async()=>[{address:"8.8.8.8",family:4}];
  await assert.rejects(resolvePublicUrl("file:///etc/passwd",resolver));
  await assert.rejects(resolvePublicUrl("http://user:pw@example.com",resolver));
  await assert.rejects(resolvePublicUrl("https://example.com:444",resolver));
  await assert.rejects(resolvePublicUrl("https://example.com",async()=>[{address:"8.8.8.8",family:4},{address:"10.0.0.1",family:4}]));
  assert.equal((await resolvePublicUrl("https://example.com/notice",resolver)).addresses[0].address,"8.8.8.8");
});
test("TXT, DOCX and PDF extract actual text and page; invalid and oversized files fail", async()=>{
  assert.match((await extractFile(Buffer.from(text),"notice.txt")).sections[0].text,/绩点/);
  const docx=zip("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>奖学金申请通知：绩点须达到3.5，材料为成绩单。</w:t></w:r></w:p></w:body></w:document>');
  assert.match((await extractFile(docx,"notice.docx")).sections[0].text,/成绩单/);
  const parsed=await extractFile(pdf("Scholarship GPA >= 3.5. Deadline 2026-11-18."),"notice.pdf");
  assert.equal(parsed.sections[0].page,1);assert.match(parsed.sections[0].text,/Scholarship/);
  await assert.rejects(extractFile(Buffer.from("fake pdf"),"notice.pdf"));
  await assert.rejects(extractFile(zip("other.xml","wrong file"),"notice.docx"));
  await assert.rejects(extractFile(Buffer.alloc(8*1024*1024+1),"notice.txt"));
});
test("grounded conclusions need exact citations and personal facts; missing facts never become eligibility", async()=>{
  const model={available:true,completion:async()=>({content:JSON.stringify(groundedOutput())})};
  const agent=new GroundedAgent(model),context={message:"申请奖学金",school:{id:"s",name:"学校"},docs:[doc]};
  const result=await agent.plan({...context,profile:{绩点:"3.85"}});
  assert.equal(result.mode,"live");assert.equal(result.criteria[0].status,"met");assert.equal(result.materials[0].status,"missing");assert.equal(result.deadline.date,"2026-11-18");assert.equal(result.steps[0].status,"todo");
  assert.equal((await agent.plan(context)).criteria[0].status,"need_info");
  const invalid=groundedOutput();invalid.criteria[0].evidence[0].quote="不存在的条件";invalid.materials[0].evidence[0].sourceId="another-user-document";invalid.deadline.date="2026-12-31";
  const bad=await new GroundedAgent({available:true,completion:async()=>({content:JSON.stringify(invalid)})}).plan({...context,profile:{绩点:"3.85"}});
  assert.equal(bad.criteria[0].status,"need_info");assert.equal(bad.materials.length,0);assert.equal(bad.deadline,null);assert.ok(bad.warning);
  assert.equal((await agent.plan({...context,docs:[]})).steps.length,0);
});
test("private school imports, search, plans, archive and form export enforce ownership",async(t)=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"campus-library-"));
  const store=await new LocalStore(dir).init();
  const model={available:true,completion:async(messages)=>{
    const input=JSON.parse(messages.at(-1).content); const output=groundedOutput(input.sources[0].sourceId);
    return {content:JSON.stringify(output)};
  }};
  const app=await createApp({demo:true,secret:"private-library-test-secret-thirty-two-long",origins:[],ai:{mode:"offline"},storage:"local"},store,model);
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(url,method="GET",body,token)=>{const r=await fetch(base+url,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();return {status:r.status,body:r.headers.get("content-type")?.includes("application/json")?JSON.parse(raw):raw};};
  const a=(await request("/api/auth/demo","POST",{})).body.token,b=(await request("/api/auth/demo","POST",{})).body.token;
  const identity=(await request("/api/auth/demo","POST",{})).body;
  const restored=(await request("/api/auth/demo","POST",{resumeKey:identity.resumeKey})).body;
  assert.equal(restored.userId,identity.userId);
  assert.notEqual(restored.userId,(await request("/api/auth/demo","POST",{})).body.userId);
  assert.equal((await request("/api/auth/demo","POST",{resumeKey:"a".repeat(64)})).status,401);
  const school=(await request("/api/schools","POST",{name:"资料隔离测试学校",campus:"主校区"},a)).body;
  const imported=(await request("/api/library/import","POST",{schoolId:school.id,title:"测试通知（虚构）",text},a)).body;
  assert.ok(imported.id);
  assert.equal((await request("/api/library/documents/"+imported.id,"GET",undefined,b)).status,404);
  assert.equal((await request("/api/knowledge/search","POST",{query:"奖学金",schoolId:school.id},b)).status,404);
  assert.ok(!(await request("/api/knowledge/search","POST",{query:"资料隔离测试学校"},b)).body.items.some(item=>item.id===imported.id));
  const run=(await request("/api/agent/plan","POST",{message:"申请奖学金",schoolId:school.id,profile:{绩点:"3.85"}},a)).body;
  assert.equal(run.mode,"live");assert.equal(run.citations[0].documentId,imported.id);
  assert.equal((await request("/api/agent/runs/"+run.id,"GET",undefined,b)).status,404);
  const form=(await request("/api/forms/generate","POST",{runId:run.id,serviceId:run.intent,fields:{姓名:"林晓"}},a)).body;
  assert.deepEqual(Object.keys(form.fields),["姓名"]);
  assert.equal((await request(`/api/forms/${form.id}/export`,"GET",undefined,b)).status,404);
  assert.match((await request(`/api/forms/${form.id}/export`,"GET",undefined,a)).body,/林晓/);
  await request(`/api/library/documents/${imported.id}/archive`,"POST",{},a);
  const after=(await request("/api/agent/plan","POST",{message:"申请奖学金",schoolId:school.id},a)).body;
  assert.equal(after.steps.length,0);assert.equal(after.mode,"offline");
});

const config=require('./config');
let token='',pending=null,cloudInited=false;
function raw(path,method='GET',data,auth){
 return new Promise((resolve,reject)=>wx.request({url:config.apiBase+path,method,data,timeout:120000,header:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},success:r=>{if(r.statusCode>=200&&r.statusCode<300)resolve(r.data);else reject(new Error(r.data.error?.message||'服务请求失败'));},fail:()=>reject(new Error('网络连接失败，请检查服务端地址及合法域名'))}));
}
async function ensureLogin(){
 if(token)return token;
 if(!pending)pending=(async()=>{
  console.info('[ai-mode] identity request');let data;
  if(config.authMode==='cloudbase'){
   if(!cloudInited){wx.cloud.init({env:config.envId,traceUser:false});cloudInited=true;}
   const result=await wx.cloud.callFunction({name:'campuspilot-session'});data=await raw('/api/auth/cloudbase','POST',result.result.ticket);
  }else if(config.authMode==='wechat'){
   const result=await wx.login();data=await raw('/api/auth/wechat','POST',{code:result.code});
  }else data=await raw('/api/auth/demo','POST',{});
  token=data.token;console.info('[ai-mode] identity ready');return token;
 })().finally(()=>{pending=null;});return pending;
}
async function request(path){return raw(path,'GET',undefined,await ensureLogin());}
module.exports={request};

const cloud=require('wx-server-sdk');
const {createHmac}=require('node:crypto');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
exports.main=async()=>{
 const {OPENID,APPID}=cloud.getWXContext();
 if(!OPENID||APPID!==process.env.WX_APPID)throw new Error('Invalid native caller');
 if(!process.env.WX_BRIDGE_SECRET||process.env.WX_BRIDGE_SECRET.length<32)throw new Error('Identity bridge is not configured');
 const timestamp=Date.now();
 const signature=createHmac('sha256',process.env.WX_BRIDGE_SECRET).update(`${OPENID}|${APPID}|${timestamp}`).digest('hex');
 return{ticket:{openid:OPENID,appid:APPID,timestamp,signature}};
};

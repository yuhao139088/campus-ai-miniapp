const {request}=require('../utils/request');
const {successResult,errorResult}=require('../utils/util');
async function getServiceCatalog(){
 console.info('[ai-mode] getServiceCatalog entry');
 try{
  console.info('[ai-mode] getServiceCatalog request');
  const result=await request('/api/services');
  console.info('[ai-mode] getServiceCatalog response',{count:(result.items||[]).length});
  return successResult('已获取演示校园服务目录；具体办理以学校正式通知为准。',{items:result.items||[],knowledgeMode:result.knowledgeMode});
 }catch(error){console.info('[ai-mode] getServiceCatalog error',{message:error.message});return errorResult(error.message);}
}
module.exports=getServiceCatalog;

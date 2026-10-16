function successResult(text,structuredContent){return{isError:false,content:[{type:'text',text}],structuredContent};}
function errorResult(text){return{isError:true,content:[{type:'text',text}]};}
module.exports={successResult,errorResult};

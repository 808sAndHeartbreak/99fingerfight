import {chooseCommand} from './ai.js';
self.onmessage=({data})=>{
 try{
  if(data.difficulty!=='easy')self.postMessage({id:data.id,provisional:true,command:chooseCommand(data.state,'easy')});
  self.postMessage({id:data.id,command:chooseCommand(data.state,data.difficulty)});
 }catch(error){self.postMessage({id:data.id,error:error.message});}
};

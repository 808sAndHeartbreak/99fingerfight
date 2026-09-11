import {chooseCommand} from './ai.js';
self.onmessage=({data})=>{
 try{self.postMessage({id:data.id,command:chooseCommand(data.state,data.difficulty)});}
 catch(error){self.postMessage({id:data.id,error:error.message});}
};

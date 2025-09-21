'use strict'
const log = require('logger')
const queue = require('async/queue')
const gemini = require('src/gemini')
let POD_INDEX = +(process.env.POD_INDEX || 0), NUM_PODS = +(process.env.NUM_PODS || 1)

const getPodId = (sId)=>{
  return (Number(BigInt(sId) >> 22n) % (NUM_PODS))
}
const sleep = (ms = 5000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const que = queue(async(task)=>{
  try{
    await gemini.process(task)
  }catch(e){
    log.error(e)
  }
}, 1)

module.exports = async( data = {}, reply) =>{
   if(data?.cmd !== 'ai_message' || !data?.msg?.sId) return;
   let podId = getPodId(data?.msg?.sId)
   if(podId !== POD_INDEX) return
   que.push(data.msg)
}

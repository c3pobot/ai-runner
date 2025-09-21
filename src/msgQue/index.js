'use strict'
const log = require('logger')
const client = require('../rabbitmq/client')
const cmdProcessor = require('./cmdProcessor')
const gemini = require('src/gemini')

let POD_NAME = process.env.POD_NAME || 'ai-runner'
let QUE_NAME = `ai-runner-msg.${POD_NAME}`, consumerStatus = false, NAME_SPACE = process.env.NAME_SPACE || 'default'
let AI_RUNNER_EXCHANGE = `${NAME_SPACE}.msg.ai-runner`

let exchanges = [{ exchange: AI_RUNNER_EXCHANGE, type: 'topic' }]
let queueBindings = [{ exchange: AI_RUNNER_EXCHANGE, queue: QUE_NAME }]

const processCmd = async(msg = {}, reply)=>{
  try{
    if(!msg.body) return
    await cmdProcessor(msg.body, reply)
  }catch(e){
    log.error(e)
  }
}

let consumer = client.createConsumer({
  consumerTag: POD_NAME,
  queue: QUE_NAME,
  lazy: true,
  exchanges: exchanges,
  queueBindings: queueBindings,
  queueOptions: { queue: QUE_NAME, durable: false, arguments: { 'x-message-ttl': 5 * 60 * 1000 } }
}, processCmd)

consumer.on('error', (err)=>{
  log.error(err)
})
consumer.on('ready', ()=>{
  log.info(`${POD_NAME} ${QUE_NAME} consumer created...`)
})

const stopConsumer = async()=>{
  try{
    await consumer.close()
  }catch(e){
    log.error(e)
  }
}
const startConsumer = async()=>{
  try{
    await stopConsumer()
    let status = client.ready
    if(!status) return
    await consumer.start()
    return true
  }catch(e){
    log.error(e)
  }
}
const watch = async() =>{
  try{
    if(client.ready && gemini.status()){
      if(!consumerStatus){
        consumerStatus = await startConsumer()
        if(consumerStatus){
          log.info(`${POD_NAME} ${QUE_NAME} consumer started...`)
        }
      }
    }else{
      if(consumerStatus){
        consumerStatus = await stopConsumer()
        if(!consumerStatus) log.info(`${POD_NAME} ${QUE_NAME} consumer stopped...`)
      }
    }
    setTimeout(watch, 5000)
  }catch(e){
    log.error(e)
    setTimeout(watch, 5000)
  }
}
module.exports.start = () =>{
  try{
    watch()
  }catch(e){
    log.error(e)
  }
}

'use strict'
const log = require('logger')
const client = require('./client')

let POD_NAME = process.env.POD_NAME || 'ai-runner', NAME_SPACE = process.env.NAME_SPACE || 'default'
let DEFAULT_EXCHANGE = `${NAME_SPACE}.cmds`

let exchanges = [{ exchange: DEFAULT_EXCHANGE, type: 'topic', maxAttempts: 5 }, { exchange: 'bot.msg', type: 'topic', maxAttempts: 5 }]

const publisher = client.createPublisher({ exchanges: exchanges })
publisher.on('close', ()=>{
  log.info(`${POD_NAME} topic exchange publisher disconnected...`)
})
log.info(`${POD_NAME} topic exchange publisher created...`)

module.exports = {
  get status(){
    return client?.ready
  }
}

module.exports.notify = async( data, routingKey, exchange )=>{
  try{
    if(!data || !client.ready) return
    if(!exchange) exchange = DEFAULT_EXCHANGE
    await publisher.send({ exchange: exchange, routingKey: routingKey }, data)
    return true
  }catch(e){
    log.error(e)
  }
}

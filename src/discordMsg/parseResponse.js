'use strict'
const headers2get = ['x-ratelimit-bucket', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-reset-after']
module.exports = async(res)=>{
  if(res){
    if (res?.status?.toString().startsWith('5')) {
      throw('Bad status code '+res.status)
    }
    let body, headers = {}

    if (res?.status === 204) {
      body = null
    } else if (res?.headers?.get('Content-Type')?.includes('application/json')) {
      body = await res?.json()
    } else {
      body = await res?.text()
    }
    if(res.headers){
      for(let i in headers2get){
        headers[headers2get[i]] = await res.headers?.get(headers2get[i])
      }
    }
    return {
      status: res?.status,
      body: body,
      headers: headers
    }
  }
}

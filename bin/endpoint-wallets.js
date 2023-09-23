#!/usr/bin/env node

const {spawn} = require('child_process')
const { resolve } = require('dns')
const fs = require('fs')

const model_file = "wallet-service.conf"
const conf_file = process.argv[2]
const conf = (conf_file == undefined) ? JSON.parse(fs.readFileSync(model_file).toString()) : JSON.parse(fs.readFileSync(conf_file).toString())

function spawn_node_file(endpoint_args) {
    let p = new Promise((resolve,reject) => {
        let proc = spawn("node",endpoint_args)
        proc.on('spawn',() => {
            resolve(true)
        })
        proc.on('error',() => {
            reject(false)
        })
        proc.on('close',(code) => {
            console.log(`child process closed with code ${code}`)
        })
        proc.stderr.on('data',(chunk) => {
            console.log(chunk.toString())
        })
        proc.stdout.on('data',(chunk) => {
            console.log(chunk.toString())
        })    
    })
    return p
}

let endpoint_procs = conf.launch_endpoints

/*
"launch_endpoints" : {
    "contact_endpoint" : [ "endpoints/contact_contract_server", "contact-service.conf" ], 
    "wallet_endpoint" : [ "endpoints/wallet_contract_server", "wallet-service.conf" ], 
}

ws-wallet-service.conf
*/

let ws_server = [ "endpoints/wallety_ws_server", "ws-wallet-service.conf" ]
ws_server[0] = __dirname + '/../' + ws_server[0]
console.dir(ws_server)
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

let endpoint = "wallet_endpoint"
let endpoint_args = endpoint_procs[endpoint]
let conf_index = endpoint_args.indexOf(model_file)
if ( conf_index > 0 ) {
    endpoint_args[conf_index] = conf_file ? conf_file : model_file
}

endpoint_args[0] = __dirname + '/../' + endpoint_args[0]
console.dir(endpoint_args)


async function startup() {
    await spawn_node_file(ws_server)
    await spawn_node_file(endpoint_args)
}

startup()
//
const {ServeMessageEndpoint} = require("message-relay-services")
const TreasureInterceptCache = require('treasure-intercept-cache')
//
const fs = require('fs')


// connect to a relay service...
// set by configuration (only one connection, will have two paths.)


class MediaConsumerMap {

    constructor() {
        this.media_to_wallets = {}
    }

    add_wallet_to_media(media_link,wallet) {
        let wallet_map = this.media_to_wallets[media_link]
        if ( wallet_map === undefined ) {
            wallet_map = {}
            this.media_to_wallets[media_link] = wallet_map
        }
        wallet_map[wallet._tracking] = wallet
    }


    get_wallet_for_media(media_link,w_tracking) {
        let wallet_map = this.media_to_wallets[media_link]
        if ( wallet_map ) {
            let wallet_usage = wallet_map[w_tracking]
            return wallet_usage ? wallet_usage : false  // not undefined
        }
        return false
    }

    del_wallet_for_media(media_link,w_tracking) {
        let wallet_map = this.media_to_wallets[media_link]
        if ( wallet_map ) {
            delete wallet_map[w_tracking]
            if ( Object.keys(this.media_to_wallets[media_link]).length === 0 ) {
                delete this.media_to_wallets[media_link]
            }
            return true
        }
        return false
    }

}

// -- -- -- --
// -- -- -- --
//
class TransitionsWalletEndpoint extends ServeMessageEndpoint {

    //
    constructor(conf) {
        super(conf)
        //
        this.entries_file = `${conf.wallets_directory}/${Date.now()}.json`
        this.entries_sep = ""
        this.app_handles_subscriptions = true
        this.app_can_block_and_respond = true
        //
        this.path = `${conf.address}:${conf.port}`
        this.client_name = this.path
        //
        //  meta_publication not used for wallets
        //
        this.app_subscriptions_ok = true
        // ---------------->>  topic, client_name, relayer  (when relayer is false, topics will not be written to self)
        this.add_to_topic("publish-wallet",'self',false)           // allow the client (front end) to use the pub/sub pathway to send state changes
        this.add_to_topic("delete-wallet",'self',false)           // allow the client (front end) to use the pub/sub pathway to send state changes
        //
        this.topic_producer = this.topic_producer_user
        if ( conf.system_wide_topics ) {
            this.topic_producer = this.topic_producer_system
        }
        //
        this.contracts = new TreasureInterceptCache(conf.treasure) // this will start watching files (in this case contract descriptors)
        //
        this.link_to_wallets = new MediaConsumerMap()

        this.server_id = conf.server_id
        this.ip = conf.address
    }





    /**
     * 
     * @param {object}} payflow_req 
     * @returns 
     */
    async expect_pay_request(payflow_req) {
        // a wallet is the media injected by this mini link extension
        let wallet = this.contracts.has_contract_meta(payflow_req._tracking)
        if ( wallet ) {
            //
            let usage = {
                "links" : payflow_req.links,
                "_tracking" : payflow_req._tracking,
                "payer" : payflow_req.payer,
                "pay_contract" : payflow_req.pay_contract,
                "wallet" : wallet // meta descriptor of a wallet plus any executable component references
            }
            //
            // identify by what is being paid for
            this.link_to_wallets.add_wallet_to_media(payflow_req.links.source.link,usage)
            return "OK"
        }
        return "ERR"
    }


    /**
     * 
     * @param {object} payflow_confirm 
     */
    async confirm_payflow(payflow_confirm) {
        //
        // a wallet is the media injected by this mini link extension
        let wallet = this.contracts.has_contract_meta(payflow_confirm._tracking)
        if ( wallet ) {
            let wallet_usage = this.link_to_wallets.get_wallet_for_media(payflow_confirm.links.source.link,wallet._tracking)
            if ( wallet_usage ) {
                let wallet = wallet_usage.wallet
                if ( wallet ) {
                    //
                    let asset_key = wallet.chain_service_key   // which blockchain is in use
                    let resource_identifier = pay_req.links.source.link  // pay for this
                    let ucwid_to_limits_table = {}
                    ucwid_to_limits_table[wallet.ccwid] = wallet_usage.pay_contract.amount
                    let session_key = wallet.session  // this is reset each time the user logs in and this server receives publication...
                    //
                    let accepted = await this.contracts.state_transition(asset_key,resource_identifier,this.server_id,session_key)
                    if ( accepted ) {
                        return true
                    }
                }
            }
        }
        return false
    }


    async pay_for_streaming(pay_req) {
        if ( !(this.contracts) ) return "ERR"
        //
        let wallet = this.contracts.has_contract_meta(payflow_confirm._tracking) // a wallet is the media injected by this mini link extension
        if ( wallet ) {
            let wallet_usage = this.link_to_wallets.get_wallet_for_media(pay_req.links.source.link,wallet._tracking)
            if ( wallet_usage ) {
                let wallet = wallet_usage.wallet
                if ( wallet ) {
                    //
                    let asset_key = wallet.chain_service_key   // which blockchain is in use
                    let resource_identifier = pay_req.links.source.link  // pay for this
                    let ucwid_to_limits_table = {}
                    ucwid_to_limits_table[wallet.ccwid] = wallet_usage.pay_contract.amount
                    let session_key = wallet.session  // this is reset each time the user logs in and this server receives publication...
                    //
                    let fundable = await this.contracts.reserve_target_resources(asset_key,resource_identifier,ucwid_to_limits_table,this.server_id,session_key)
                    if ( fundable ) {
                        let from_ucwid_to_ucwid_table = {}
                        from_ucwid_to_ucwid_table[wallet.ccwid] = pay_contract.ucwid
                        // this transfer should have been already authorized ... 
                        // this payment model starts with reserved funds and engages a contract that allow for metered release until depletion
                        await this.contracts.resource_transfer(asset_key,resource_identifier,from_ucwid_to_ucwid_table,this.server_id,session_key)
                    }
                    //
                    return { "ip" : this.ip, "server_id" : this.server_id }
                }
            }
        }
        //
        return false
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // ----
    app_generate_tracking(p_obj) {
        if ( p_obj._tracking === undefined ) {
            p_obj._tracking = p_obj.ucwid + '-' + Date.now()
        }
        return p_obj._tracking
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    // app_subscription_handler
    //  -- Handle state changes...
    // this is the handler for the topics added directory above in the constructor  -- called post publication by endpoint in send_to_all
    app_subscription_handler(topic,msg_obj) {
        //
        if ( topic === 'publish-wallet' ) {
            msg_obj._tx_op = 'P'
        } else if ( topic === 'delete-wallet' ) {
            msg_obj._tx_op = 'U'
        }
        //
        if ( topic === 'publish-wallet' ) {
            let op = 'C' // change one field
            let field = "ucwid"
            this.user_action_keyfile(op,msg_obj,field,false)
        } else if (topic === 'delete-wallet' ) {
            let op = 'D' // change one field
            let field = "ucwid"
            this.user_action_keyfile(op,msg_obj,field,false)
        }
    }


    app_publication_pre_fan_response(topic,msg_obj,ignore) {
        if ( topic === 'publish-wallet' ) {
            this.user_manage_date('C',msg_obj)
            this.app_generate_tracking(msg_obj)
        } else if ( topic === 'delete-wallet' ) {
            this.user_manage_date('U',msg_obj) 
        }
    }

    // ----
    application_data_update(u_obj,data) {
        return(data)
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    async put_entries(entries_file,entries_record) {
        let entries_record_str = this.entries_sep + JSON.stringify(entries_record) +'\n'    // STORE AS STRING
        this.entries_sep = ','
        await this.write_append_string(entries_file,entries_record_str,false)
        return entries_record_str
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


    async app_message_handler(msg_obj) {  // items coming from the editor  (change editor information and publish it back to consumers)
        //
        let asset_info = u_obj[field]   // dashboard+striking@pp.com  profile+striking@pp.com
        let result = "OK"
        let data = false
        //
        switch ( op ) {
            case 'S' : {   // add a wallet to the ledger
                //
                switch ( u_obj._m_path ) {
                    case 'withdraw' : {
                        //
                        let status = await this.pay_for_streaming(u_obj)
                        if ( status === "false" ) {
                            result = "ERR"
                        } else {
                            data = status
                        }
                        //                        
                        break;
                    }
                    case 'payflow' : {
                        //
                        result = await this.expect_pay_request(u_obj)
                        //
                        break;
                    }
                    case 'payflow-confirm' : {
                        let status = await this.confirm_payflow(u_obj)
                        if ( status === "false" ) {
                            result = "ERR"
                        }
                        break;
                    }
                    default : {
                        break;
                    }
                }

                break;
            }
            case 'G' : {
                switch ( u_obj._m_path ) {
                    case 'wallets' : {
                        let wallet = this.contracts.has_contract_meta(u_obj._tracking) // a wallet is the media injected by this mini link extension
                        if ( wallet ) {
                            data = wallet
                        } else {
                            result = "ERR"
                        }
                        break;
                    }
                    case 'payflow' : {
                        let wallet = this.contracts.has_contract_meta(u_obj._tracking) // a wallet is the media injected by this mini link extension
                        if ( wallet ) {
                            let wallet_usage = this.link_to_wallets.get_wallet_for_media(u_obj.links.source.link,wallet._tracking)
                            if ( wallet_usage ) {
                                let wallet = wallet_usage.wallet
                                if ( wallet ) {
                                    data = wallet_usage   // all public information
                                }
                            }
                        }
                        if ( !data ) {
                            result = "ERR"
                        }
                        break;
                    }
                    default : {
                        break;
                    }
                }
                break;
            }
            case 'D' : {        // add a delete action to the ledger
                //
                switch ( u_obj._m_path ) {
                    case 'wallets' : {
                        let nowtime =  Date.now()
                        data = nowtime
                        let wallet = this.contracts.has_contract_meta(u_obj._tracking) // a wallet is the media injected by this mini link extension
                        if ( wallet === undefined ) break
                        else {
                            let usage = this.get_wallet_for_media(u_obj.links.source,u_obj.payer)
                            if ( usage ) {
                                this.link_to_wallets.del_wallet_for_media(u_obj.links.source,usage.wallet._tracking)
                            }
                            this.contracts.remove_contract_service(u_obj._tracking)
                        }
                        break;
                    }
                    case 'payflow' : {
                        if ( this.link_to_wallet ) {
                            let usage = this.link_to_wallet.get_wallet_for_media(u_obj.pay_contract,u_obj._tracking)
                            if ( usage ) {
                                this.link_to_wallet.del_wallet_for_media(u_obj.pay_contract,u_obj._tracking)
                            }
                        }
                        break;
                    }
                    default : {
                        break;
                    }
                }

                break;
            }
        }
        return({ "status" : result, "explain" : `${op} performed`, "when" : Date.now(), "data" : data ? data : undefined })
    }
}


// ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- -------
// ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- -------


let conf_file = 'wallet-service.conf'
let conf_par = process.argv[2]
if ( conf_par !== undefined ) {
    conf_file = conf_par
}

let conf = JSON.parse(fs.readFileSync(conf_file).toString())
let endpoint = conf

console.log(`wallet Server: PORT: ${endpoint.port} ADDRESS: ${endpoint.address}`)

new TransitionsWalletEndpoint(endpoint)

// ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- -------
// (end file)

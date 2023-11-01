//
const {ServeMessageEndpoint,MultiPathRelayClient,MessageRelayManager} = require("message-relay-services")
const TreasureInterceptCache = require('treasure-intercept-cache')

const DEFAULT_CHAIN_WALLET = 'WALLET'

//
const fs = require('fs')

class MediaSellerMap {

    constructor() {
        this.media_to_contracts = {}
    }

    /**
     * 
     * @param {*} media_link 
     * @param {*} contract 
     */
    add_contract_to_media(media_link,contract) {
        let contract_map = this.media_to_contracts[media_link]
        if ( contract_map === undefined ) {
            contract_map = {}
            this.media_to_contracts[media_link] = contract_map
        }
        let c_tracking = wallet._tracking
        contract_map[c_tracking] = contract
    }

    /**
     * 
     * @param {*} media_link 
     * @param {*} c_tracking 
     * @returns 
     */
    get_contract_for_media(media_link,c_tracking) {
        let contract_map = this.media_to_contracts[media_link]
        if ( contract_map ) {
            let contract_usage = contract_map[c_tracking]
            return contract_usage ? contract_usage : false  // not undefined
        }
        return false
    }

    /**
     * 
     * @param {*} media_link 
     * @param {*} c_tracking 
     * @returns 
     */
    del_contract_for_media(media_link,c_tracking) {
        let contract_map = this.media_to_contracts[media_link]
        if ( contract_map ) {
            delete contract_map[c_tracking]
            if ( Object.keys(this.media_to_contracts[media_link]).length === 0 ) {
                delete this.media_to_contracts[media_link]
            }
            return true
        }
        return false
    }

}



// connect to a relay service...
// set by configuration (only one connection, will have two paths.)

// -- -- -- --
// -- -- -- --
//
/**
 * TransitionsCounterEndpoint
 */
class TransitionsCounterEndpoint extends ServeMessageEndpoint {

    //
    constructor(conf) {
        super(conf)
        //
        this.entries_file = `${conf.counters_directory}/${Date.now()}.json`
        this.entries_sep = ""
        this.app_handles_subscriptions = true
        this.app_can_block_and_respond = true
        //
        this.path = `${conf.address}:${conf.port}`
        this.client_name = this.path
        //
        //  meta_publication not used for counters
        //
        this.app_subscriptions_ok = true
        // ---------------->>  topic, client_name, relayer  (when relayer is false, topics will not be written to self)
        this.add_to_topic("publish-counter",'self',false)   // allow the client (front end) to use the pub/sub pathway to send state changes
        this.add_to_topic("delete-counter",'self',false)    // allow the client (front end) to use the pub/sub pathway to send state changes
        //
        this.topic_producer = this.topic_producer_user
        if ( conf.system_wide_topics ) {
            this.topic_producer = this.topic_producer_system
        }
        //
        this.relay_manager = new MessageRelayManager(conf.wallet_relayer.manager)

        conf.wallet_relayer._connection_manager = this.relay_manager
        conf.wallet_relayer._connect_label =  conf.wallet_relayer.wallet_cache_relay ?  conf.wallet_relayer._connect_label : DEFAULT_CHAIN_WALLET

        //
        this.wallet_relay = new MultiPathRelayClient(conf.wallet_relayer)   // wallet server will run first
        //
        this.contracts = new TreasureInterceptCache(conf.treasure)  // this will start watching files (in this case contract descriptors)
        //
        this.link_to_contracts = new MediaSellerMap()
    }


    /**
     * store this payflow for 
     * @param {object} flow_request 
     * @returns 
     */
    async payflow(flow_request) { // 
        let contract = this.contracts.has_contract_meta(flow_request.pay_contract)
        if ( contract ) {
            let usage = {
                "links" : payflow_req.links,
                "_tracking" : payflow_req.tracking,
                "payer" : payflow_req.payer,
                "pay_contract" : payflow_req.pay_contract,
                "contract" : contract // meta descriptor of a contract plus any executable component references
            }
            this.link_to_contracts.add_contract_to_media(flow_request.pay_contract,usage)
            let result = await this.wallet_relay.set_on_path(usage,'payflow-confirm')
            if ( result.status === "OK" ) return true
        }
        return false
    }



    /**
     * 
     * @param {count_req} count_req 
     */
    async run_count(count_req) {
        if ( this.link_to_contracts ) {
            let usage = this.link_to_contracts.get_contract_for_media(count_req.pay_contract,contract._tracking)
            if ( usage ) {
                let contract = usage.contract
                if ( contract ) {
                    let {timestamp,asset_key,ucwid,server_id,session_key} = count_req
                    if ( await this.contracts.check_initialization(asset_key,ucwid,server_id,session_key) ) {
                        await this.contracts.count_it(timestamp,asset_key,ucwid,server_id,session_key)
                    }    
                }
            }
        }
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    /**
     * 
     * @param {*} p_obj 
     * @returns 
     */
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
    /**
     * 
     * @param {*} topic 
     * @param {*} msg_obj 
     */
    app_subscription_handler(topic,msg_obj) {
        //
        if ( topic === 'publish-counter' ) {
            msg_obj._tx_op = 'P'
        } else if ( topic === 'delete-counter' ) {
            msg_obj._tx_op = 'U'
        }
        //
        if ( topic === 'publish-counter' ) {
            let op = 'C' // change one field
            let field = "ucwid"
            this.user_action_keyfile(op,msg_obj,field,false)
        } else if (topic === 'delete-counter' ) {
            let op = 'D' // change one field
            let field = "ucwid"
            this.user_action_keyfile(op,msg_obj,field,false)
        }
    }


    /**
     * 
     * @param {*} topic 
     * @param {*} msg_obj 
     * @param {*} ignore 
     */
    app_publication_pre_fan_response(topic,msg_obj,ignore) {
        if ( topic === 'publish-counter' ) {
            this.user_manage_date('C',msg_obj)
            this.app_generate_tracking(msg_obj)
        } else if ( topic === 'delete-counter' ) {
            this.user_manage_date('U',msg_obj) 
        }
    }

    // ----
    /**
     * 
     * @param {*} u_obj 
     * @param {*} data 
     * @returns 
     */
    application_data_update(u_obj,data) {
        return(data)
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    /**
     * 
     * @param {*} entries_file 
     * @param {*} entries_record 
     * @returns 
     */
    async put_entries(entries_file,entries_record) {
        let entries_record_str = this.entries_sep + JSON.stringify(entries_record) +'\n'    // STORE AS STRING
        this.entries_sep = ','
        await this.write_append_string(entries_file,entries_record_str,false)
        return entries_record_str
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


    /**
     * 
     * @param {object} msg_obj - message relay service message object
     * @returns {object}  - this is the status object expected by server processes and/or the browser client page
     */
    async app_message_handler(u_obj) {  // items coming from the editor  (change editor information and publish it back to consumers)
        //
        let asset_info = u_obj[field]   // dashboard+striking@pp.com  profile+striking@pp.com
        let op = u_obj._tx_op
        let result = "OK"
        let data = false
        //
        switch ( op ) {
            case 'S' : {   // set a propery
                switch ( u_obj._m_path ) {
                    case 'count' : {
                        await this.run_count(u_obj)
                        break;
                    }
                    case 'contract' : {
                        break;
                    }
                    case 'payflow' : {
                        let status = await this.payflow(u_obj)
                        result = status ? "OK" : "ERR"
                        break;
                    }
                    default : {
                        break;
                    }
                }
                break;
            }
            case 'G' : {  // get the properties of an item with respect to a path
                switch ( u_obj._m_path ) {
                    case 'contract' : {
                        // search_for_creative
                        if ( this.link_to_contracts ) {
                            data = this.contracts.has_contract_meta(u_obj._tracking)
                        } else {
                            result = "ERR"
                        }
                        break;
                    }
                    case 'payflow' : {
                        if ( this.link_to_contracts ) {
                            let usage = this.link_to_contracts.get_contract_for_media(count_req.pay_contract,contract._tracking)
                            if ( usage ) {
                                data = usage
                            } else {
                                result = "ERR"
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
            case 'D' : {        // add a delete action to the ledger
                let nowtime =  Date.now()
                u_obj.deleted = nowtime
                switch ( u_obj._m_path ) {
                    case 'count' : {
                        break;
                    }
                    case 'contract' : {
                        if ( this.contracts.has_contract_meta(u_obj._tracking) === undefined ) break
                        else {
                            this.contracts.remove_contract_service(u_obj._tracking)
                        }
                        break;
                    }
                    case 'payflow' : { // should establish counting allowance for a media asset with respect to a contract\
                        if ( this.link_to_contracts ) {
                            let usage = this.link_to_contracts.get_contract_for_media(u_obj.pay_contract,u_obj._tracking)
                            if ( usage ) {
                                this.link_to_contracts.del_contract_for_media(u_obj.pay_contract,u_obj._tracking)
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
        //
        return({ "status" : result, "explain" : `${op} performed`, "when" : Date.now(), "data" : data ? data : undefined })
    }
    
}


// ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- -------
// ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- -------


let conf_file = 'counter-service.conf'
let conf_par = process.argv[2]
if ( conf_par !== undefined ) {
    conf_file = conf_par
}

let conf = JSON.parse(fs.readFileSync(conf_file).toString())
let endpoint = conf

console.log(`Counter Server: PORT: ${endpoint.port} ADDRESS: ${endpoint.address}`)

new TransitionsCounterEndpoint(endpoint)

// ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- ------- -------
// (end file)

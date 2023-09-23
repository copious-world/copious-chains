//
const {TransitionsODBEndpoint} = require("odb-services")
const TreasureInterceptCache = require('treasure-intercept-cache')
//
const fs = require('fs')


// connect to a relay service...
// set by configuration (only one connection, will have two paths.)

// -- -- -- --
// -- -- -- --
//
class TransitionsCounterEndpoint extends TransitionsODBEndpoint {

    //
    constructor(conf) {
        super(conf)
        //
        this.all_counters = {}
        this.all_contracts = {}
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
        this.add_to_topic("publish-counter",'self',false)           // allow the client (front end) to use the pub/sub pathway to send state changes
        this.add_to_topic("delete-counter",'self',false)           // allow the client (front end) to use the pub/sub pathway to send state changes
        //
        this.topic_producer = this.topic_producer_user
        if ( conf.system_wide_topics ) {
            this.topic_producer = this.topic_producer_system
        }
        //
        this.contracts = new TreasureInterceptCache(conf.treasure)  // this will start watching files (in this case contract descriptors)
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    async app_message_handler(msg_obj) {
        let op = msg_obj._tx_op
        let result = "OK"
        let user_id = msg_obj._user_dir_key ? msg_obj[msg_obj._user_dir_key] : msg_obj._id
        if ( (user_id === undefined) && (msg_obj._id !== undefined) ) {
            user_id = msg_obj._id
        }
        msg_obj._id = user_id
        //
        return({ "status" : result, "explain" : `${op} performed`, "when" : Date.now() })
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


    app_publication_pre_fan_response(topic,msg_obj,ignore) {
        if ( topic === 'publish-counter' ) {
            this.user_manage_date('C',msg_obj)
            this.app_generate_tracking(msg_obj)
        } else if ( topic === 'delete-counter' ) {
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

    async user_action_keyfile(op,u_obj,field,value) {  // items coming from the editor  (change editor information and publish it back to consumers)
        //
        let asset_info = u_obj[field]   // dashboard+striking@pp.com  profile+striking@pp.com
        //
        switch ( op ) {
            case 'C' : {   // add a counter to the ledger
                switch ( u_obj._m_path ) {
                    case 'count' : {
                        break;
                    }
                    case 'contract' : {
                        let nowtime =  Date.now()
                        u_obj.when = nowtime
                        if ( this.all_contracts[asset_info] === undefined ) this.all_contracts[asset_info] = {}
                        let keyed_assets = this.all_contracts[asset_info]
                        keyed_assets[nowtime] = u_obj
                        //
                        await this.put_entries(this.entries_file,u_obj)
                        break;
                    }
                    case 'payflow' : {
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
                    case 'count' : {
                        break;
                    }
                    case 'contract' : {
                        break;
                    }
                    case 'payflow' : {
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
                        if ( this.all_counters[asset_info] === undefined ) break
                        else {
                            let keyed_assets = this.all_counters[asset_info]
                            keyed_assets[nowtime] = u_obj
                            await this.put_entries(this.entries_file,u_obj)    
                        }
                        break;
                    }
                    case 'payflow' : { // should establish counting allowance for a media asset with respect to a contract
                        break;
                    }
                    default : {
                        break;
                    }
                }
                break;

                //
                break;
            }
        }
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

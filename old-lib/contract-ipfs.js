const IPFS = require('ipfs')

class ContractManager {

    //
    constructor(conf) {
        this.creative_to_asset = {}
        this.asset_to_creative = {}
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        this.account_verification_service = conf.account_verification_service
        let b = async (conf) => {
            if ( conf.ipfs ) {
                this.node = await IPFS.create(conf.ipfs)
            } else {
                this.node = await IPFS.create()
            }
        }
        // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
        b(conf)
    }

    // 
    async valid_format(creatives_contract) {
        let total = 0.0
        for ( let cid in creatives_contract ) {
            // check cid of real person  (cid leads to contact page and payable account)
            let real_person = await this.account_verification_service.request_verification(cid)
            if ( real_person ) {
                let percent = creatives_contract[cid]
                if ( typeof percent !== 'number' ) return false
                total += percent
            } else return false
        }
        if ( total !== 1.0 ) return false
        return true
    }

    map_asset(asset_cid,creative_cid)  {
        this.creative_to_asset[creative_cid] = asset_cid
        this.asset_to_creative[asset_cid] = creative_cid
    }

    retrieve_creative(asset_cid) {
        return this.asset_to_creative[asset_cid]
    }

    async store_contract(creatives_contract) {
        if ( typeof creatives_contract !== 'string' ) {
            creatives_contract = JSON.stringify(creatives_contract)
        }
        try {
            let ipfs = this.node
            const file = await ipfs.add(creatives_contract)
            let cid = file.cid.toString()
            return cid      
        } catch (e) {
            return false
        }
    }

    //
    async get_complete_file_from_cid(cid) {
        let ipfs = this.node
        let chunks = []
        for await ( const chunk of ipfs.cat(cid) ) {
            chunks.push(chunk)
        }
        let buff = Buffer.concat(chunks)
        let data = buff.toString()
        return data
    }


    //
    async fetch_contract_json(cid_creative) {
        try {
            let data = this.get_complete_file_from_cid(cid_creative)
            let contract = JSON.parse(data)
            return contract
        } catch(e) {
            return false
        }
    }


}


module.exports = ContractManager
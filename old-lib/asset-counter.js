


class Consumption {

    constructor(consumer,streamer,linker) {
        this.count = 0
        this.accounted = false
        this.consumer = consumer   // e.g. listener, viewer, reader
        this.streamer = streamer
        this.link_provider = linker
    }

    reset() {
        if ( this.accounted ) {
            this.count = 0;     // call when previous counts have been handler
            this.accounted = false
        }
    }

    account() {
        this.accounted = true
        return this.count
    }

    incr(delta) {
        if ( delta && (typeof delta === 'number') ) {
            this.counter += delta
        } else {
            this.count++;
        }
    }

}

class PayoutKeeper {

    //
    constructor(id) {
        this.accounted = false
        this.count = 0;
        this.accet_cid = id
        this.consumer_map = {}   // 
        this.locked = false
        this.lock_promise = false
        this.serialization = []
        this.all_resolvers = []
    }

    //
    consume(consumer,streamer,linker,delta) {
        //
        this.count++;
        //
        if ( this.consumer_map[consumer] === undefined ) {
            this.consumer_map[consumer] = {}
        }
        if ( this.consumer_map[consumer][streamer] === undefined ) {
            this.consumer_map[consumer][streamer] = {}
        }
        if ( this.consumer_map[consumer][streamer][linker] === undefined ) {
            this.consumer_map[consumer][streamer][linker] = new Consumption(consumer,streamer,linker)
        }
        //
        let consumption = this.consumer_map[consumer][streamer][linker]
        if ( delta === undefined ) delta = 0
        consumption.incr(delta)
        //
    }

    reset() {
        if ( this.accounted ) {
            this.count = 0;     // call when previous counts have been handler
            this.accounted = false
        }
    }

    serialize() {
        this.serialization = []
        let aa = this.accet_cid
        for ( let c in this.consumer_map ) {
            let cc = this.consumer_map[cc]
            for ( let s in cc ) {
                let ss = cc[s]
                for ( let l in ss ) {
                    let consumer = ss[l]
                    this.serialization.push([a_cid,c,s,l,consumer.account()])
                }
            }
        }
        return this.serialization
    }


    lock() {
        this.locked = true
        this.all_resolvers = []
    }

    enqueue(consumer_path) {
        if ( this.locked ) {
            let self = this
            let p = new Promise((resolve,reject) => {
                let resolver = () => {
                    self.locked = false
                    resolve(consumer_path)
                }
                self.all_resolvers.push(resolver)
            })
            return p
        }
    }

}


class AssetCounter {

    constructor(conf) {
        this.counters = {}  // keys to payout list
        this.conf = conf
        this.payments = conf.payments
        this.contracts = conf.contracts
        this.check_always = conf.counter.check_always
    }

    add(asset_id) {
        if ( this.counters[asset_id] === undefined ) {
            this.counters[asset_id] = new PayoutKeeper(asset_id,this.conf)
            return true
        }
        return false
    }

    async consume(asset_id,consumer,streamer,linker) {
        if ( this.counters[asset_id] === undefined ) {
            this.add(asset_id)
        }
        let payout_keeper = this.counters[asset_id]
        if ( payout_keeper ) {
            if ( this.check_always ) {
                let pass = await this.payments.check(consumer,asset_id)
                if ( !pass ) return false
            }
            if ( payout_keeper.locked  )  {
                let lock_promise = payout_keeper.enqueue([consumer,streamer,linker])
                let [p_consumer,p_streamer,p_linker] = await lock_promise
                consumer = p_consumer
                streamer = p_streamer
                linker = p_linker
            }
            payout_keeper.consume(consumer,streamer,linker)
        }
        return true
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    count_assets() {
        this._curren_asset_keys = Object.keys(this.counters)
        return this._curren_asset_keys.length
    }

    copy_counters(start,span) {
        let n = this._curren_asset_keys.length
        let all_counts = []
        for ( let i = start; (i < (start + span)) && (i < n) ; i++ ) {
            let ky = this._curren_asset_keys[i]
            let payout_keeper = this.counters[ky]
            let count_list = payout_keeper.serialize()
            all_counts = all_counts.concat(count_list)
        }
        return all_counts
    }

    reset_counters(start,span) {
        let n = this._curren_asset_keys.length
        for ( let i = start; (i < (start + span)) && (i < n) ; i++ ) {
            let payout_keeper = this.counters[ky]
            payout_keeper.reset()
        }
    }

    lock_counters(start,span) {
        let n = this._curren_asset_keys.length
        for ( let i = start; (i < (start + span)) && (i < n) ; i++ ) {
            let ky = this._curren_asset_keys[i]
            let payout_keeper = this.counters[ky]
            payout_keeper.lock()
        }
    }

    unlock_counters(start,span) {
        let n = this._curren_asset_keys.length
        for ( let i = start; (i < (start + span)) && (i < n) ; i++ ) {
            let ky = this._curren_asset_keys[i]
            let payout_keeper = this.counters[ky]
            let resolver_list = payout_keeper.all_resolvers
            for ( let resolver of resolver_list ) {
                resolver()
            }
        }
    }

    restore_on_error(all_counters) {
        for ( let count_rec of all_counters ) {
            let [a_cid,c,s,l,count] = count_rec
            let payout_keeper = this.counters[a_cid]
            payout_keeper.consume(c,s,l,count)
        }
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

}




module.exports = AssetCounter
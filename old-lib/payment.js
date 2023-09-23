
class PaymentProcessor {

    constructor(conf) {
        this.contracts = conf.contracts
        this.streamer_percent = conf.payments.streamer_percent
        this.linker_percent = conf.payments.linker_percent
        this.pay_per_play = conf.payments.pay_per_play
        this.payment_processor = conf.payment_processor
    }

    async capture_funds(funds_expected,consumer_payments) {
        let payment_promises = []
        for ( let consumer in consumer_payments ) {
            let payment = consumer_payments[consumer]
            let p = this.payment_processor.decrement_balance(consumer,payment)
            payment_promises.push(p)
        }
        try {
            let results = await Promise.all(payment_promises)
            return results
        } catch (e) {
            // payments not made
        }
        return []
    }

    async release_funds(payee_table,pay_stash) {
        let payout = 0.0
        for ( let payee in payee_table ) {
            let amount = payee_table[payee]
            payout += amount
            await this.payment_processor.send(payee,amount)
        }
        return payout
    }

    log_pay(symbol,amount) {

    }

    check(consumer,asset_id) {   // a chance to look in some ledger to see if the consumer has funds for his ticket.
        // logic for accounting may be kept here...
        return(true)
    }

    async pay_all(all_counters) {
        //
        let creatives_pay = {}
        let streamers_pay = {}
        let linkers_pay = {}
        let consumer_payment = {}
        //
        let sp = this.streamer_percent
        let lp = this.linker_percent
        let pubs = sp + lp
        let creative_p = 1 - pubs
        //
        for ( let counter in all_counters ) {
            let [asset_cid,consumer,streamer,linker,plays] = counter
            let creative_cid = this.contracts.retrieve_creative(asset_cid)
            if ( creative_cid ) {
                //
                if ( creatives_pay[creative_cid] === undefined ) creatives_pay[creative_cid] = {}
                if ( streamers_pay[streamer] === undefined ) streamers_pay[streamer] = 0
                if ( linkers_pay[linker] === undefined ) linkers_pay[linker] = 0
                if ( consumer_payment[consumer] === undefined ) consumer_payment[consumer] = 0
                //
                let contract = await this.contracts.fetch_contract_json(creative_cid)
                if ( contract ) {
                    //
                    streamers_pay[streamer] += plays*sp
                    linkers_pay[linker] += plays*lp
                    consumer_payment[consumer] += plays
                    //
                    for ( let cid in contract ) {
                        if ( consumer_payment[creative_cid][cid] === undefined ) consumer_payment[consumer][cid] = 0
                        let percent = contract[cid]
                        let pp = percent*creative_p
                        creatives_pay[creative_cid][cid] += pp*plays
                    }
                }
            }
        }

        let total_funds_in = 0.0
        for ( let consumer in consumer_payment ) {
            let payment = consumer_payment[consumer] * this.pay_per_play
            consumer_payment[consumer] = payment
            total_funds_in += payment
        }

        let pay_stash = await this.capture_funds(total_funds_in,consumer_payment)

        if ( typeof pay_stash === 'boolean' ) {
            return pay_stash
        }

        this.log_pay("IN",pay_stash)

        if ( pay_stash ) {      // some event causing this to break or actually banks shutdown...
            let all_creators = {}
            for ( let creative_cid in creatives_pay ) {
                let creative_contract = creatives_pay[creative_cid]
                for ( let cid in creative_contract ) {
                    if ( all_creators[cid] === undefined ) all_creators[cid] = 0.0
                    creative_contract[cid] = creative_contract[cid] * this.pay_per_play
                    all_creators[cid] += creative_contract[cid]
                }
            }
            let payout = await this.release_funds(all_creators,pay_stash)
            this.log_pay("OUT-creators",payout)
            pay_stash -= payout
            for ( let linker in linkers_pay ) {
                linkers_pay[linker] = linkers_pay[linker] * this.pay_per_play
            }
            payout = await this.release_funds(linkers_pay,pay_stash)
            this.log_pay("OUT-linkers",payout)
            pay_stash -= payout
            for ( let streamer in streamers_pay ) {
                streamers_pay[streamer] = streamers_pay[streamer] * this.pay_per_play
            }
            payout = await this.release_funds(linkers_pay,pay_stash)
            pay_stash -= payout
            this.log_pay("OUT-streamers",payout)
            this.log_pay("ERROR",pay_stash)
        }
    }
}


module.exports = PaymentProcessor



class DataViewProvider {

    constructor(conf) {
        this.business_verification_service = conf.business_verification_service
        this.service_to_keys = {}
    }

    async exposer_is_service(service_cid) {
        let ok = await this.business_verification_service.request_verification(service_cid)
        return ok
    }

    register(service_cid,pub_key) {
        this.service_to_keys[service_cid] = pub_key
    }

    get_wrapper_key(service_cid) {
        this.service_to_keys[service_cid]
    }

}




module.exports = DataViewProvider

const cwraps = require('crypto-wraps')

class KeyStore {

    constructor(conf) {
        this.key_store = conf.key_store
        this.unwapper_key_store = conf.unwrapper_key_store
    }

    async gen_wapper_key() {
        let key_info = await cwraps.galactic_user_starter_keys('wrapper')
        let pub_key = key_info.pk_str
        let priv_key = key_info.priv_key
        //
        return [priv_key,pub_key]
    }

    async generate_signer_keys() {
        let key_info = await cwraps.galactic_user_starter_keys('signer')
        let pub_key = key_info.signer_pk_str
        let priv_key = key_info.signer_priv_key
        //
        return [priv_key,pub_key]
    }
    

    async wrap_key(pub_key,aes) {
        let transport_wrapped = await cwraps.key_wrapper(aes,pub_key)
        return transport_wrapped
    }


    async unwrap_key(wrapped_key,unwrapper_key) {
        let aes_key = await cwraps.key_unwrapper(wrapped_key,unwrapper_key)
        return aes_key
    }


    async sign_wrapper_key(wrapper_key,priv_signer_key) {
        let transport_sig = await cwraps.key_signer(wrapper_key,priv_signer_key)
        return transport_sig
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    store_asset(asset_cid,priv_key,wrapped_aes) {
        this.store_private_unwrapper_key(asset_cid,priv_key)
        this.store_wrapped_key(asset_cid,wrapped_aes)
    }

    store_private_unwrapper_key(asset_cid,priv_key) {
        this.unwapper_key_store.set(asset_cid,priv_key)
    }

    store_wrapped_key(asset_cid,wrapped_aes) {
        this.key_store.set(asset_cid,wrapped_aes)
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    async fetch_private_unwrapper_key(asset_cid) {
        let priv_uwrap_key = await this.unwapper_key_store.get(asset_cid)
        return priv_uwrap_key
    }
    
    async fetch_wrapped_key(asset_cid) {
        let wrapped_aes = await this.key_store.get(asset_cid)
        return wrapped_aes
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    async get_asset_key(asset_cid) {
        let wrapped_key = await this.fetch_wrapped_key(asset_cid)
        let unwrapper_key = await this.fetch_private_unwrapper_key(asset_cid)
        let aes_key = await this.unwrap_key(wrapped_key,unwrapper_key)
        return aes_key
    }


}


module.exports = KeyStore
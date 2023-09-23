

const PRE_REGISTRATION = 0
const WRAPPER_KEY_SEND = 1
const WRAPPED_AES_AND_CID = 2
const WRAPPED_COMPLETE = 3


class Registration {

    constructor(cid) {         // cid of creative is a cid for a list of identity cid's mapped to percentages...
        this.state = PRE_REGISTRATION
        this.creative_cid = cid
        this.asset_cid = false
        this.wrapper_key = false
        this.unwrapper_key = false
        this.private_signer_key = false
    }

    // ----
    async set_wrapper_keys(pub_key,priv_key) {
        if ( this.state === PRE_REGISTRATION ) {
            this.wrapper_key = pub_key
            this.unwrapper_key = priv_key
            this.state = WRAPPER_KEY_SEND
            return pub_key    
        }
        return false
    }

    // ----  reg_uid,wrapped_key,asset_cid
    async expose_key_and_store(wrapped_key,asset_cid,key_store) {
        let unwrapper_key = this.unwrapper_key
        if ( unwrapper_key ) {
            //
            let aes = await key_store.unwrap_key(wrapped_key,unwrapper_key)
            let [priv_key,pub_key] = await key_store.gen_wapper_key() // service's wrapper keys
            let wrapped_aes = await key_store.wrap_key(pub_key,aes) // aes now wrapped for unwrapping when this service pulls it out for others.
            //
            key_store.store_asset(asset_cid,priv_key,wrapped_aes)
            this.state = WRAPPED_AES_AND_CID
            this.asset_cid = asset_cid
            let [public_signer_key,private_signer_key] = await key_store.generate_signer_keys()
            this.private_signer_key = private_signer_key
            return public_signer_key
        }
        return false
    }

    async sign_stored_key(key_store) {
        let signature = await key_store.sign_wrapper_key(this.wrapper_key,this.private_signer_key)
        return signature
    } 

    finalize() {
        this.state = WRAPPED_COMPLETE
    }

}

class RegisterProcesses {

    constructor(conf) {
        this.registrations = {}  /// one id per creative
        this.key_storage = conf.key_storage
    }

    gen_uid() {
        let reg_uid = Math.floor(Math.random()*100000)
        while ( this.registrations[reg_uid] !== undefined ) {
            reg_uid = Math.floor(Math.random()*100000)
        }
        return reg_uid
    }

    async creative_registration(CID_creative) {  // CID of creative and an reg_uid for identifying the asset until it as a CID from the encrypted form
        let reg_uid = this.gen_uid()
        let reg = new Registration(CID_creative)
        this.registrations[reg_uid] = reg
        let [priv_key,pub_key] = await key_storage.gen_wapper_key()
        pub_key = reg.set_wrapper_keys(pub_key,priv_key)
        return [reg_uid,pub_key]
    }

    async asset_stored(reg_uid,wrapped_key,asset_cid) {
        if ( this.registrations[reg_uid] !== undefined ) {
            let reg = this.registrations[reg_uid]
            let public_signer_key = await reg.expose_key_and_store(wrapped_key,asset_cid,this.key_storage)
            return public_signer_key
        }
        return false
    }

    async verify_registration(reg_uid) {       //
        if ( this.registrations[reg_uid] !== undefined ) {
            let reg = this.registrations[reg_uid]
            let creative_cid = reg.creative_cid
            let asset_cid = reg.asset_cid
            let signature = await reg.sign_stored_key(this.key_storage)
            reg.finalize()
            return [asset_cid,creative_cid,signature]    
        }
        return [false,false]
    }
}


module.exports = RegisterProcesses

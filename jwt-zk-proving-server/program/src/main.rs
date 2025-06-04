#![no_main]
sp1_zkvm::entrypoint!(main);

use base64::Engine;
use rsa::{pkcs8::DecodePublicKey, Pkcs1v15Sign, RsaPublicKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// Consider using poseidon hash for performance in zk circuits
type Sha256Hash = [u8; 32];

// The order matters, it should be the same as the verifier program
#[derive(Serialize, Deserialize, Debug)]
pub struct PublicOutputs {
    pub email_hash: Sha256Hash,
    pub pk_hash: Sha256Hash,
    pub nonce: String,
    pub verified: bool,
}

pub fn main() {
    let pk_der = sp1_zkvm::io::read::<Vec<u8>>();
    let mut jwt_header = sp1_zkvm::io::read::<Vec<u8>>();
    let jwt_payload = sp1_zkvm::io::read::<Vec<u8>>();
    let signature = sp1_zkvm::io::read::<Vec<u8>>();

    let public_key = RsaPublicKey::from_public_key_der(&pk_der).unwrap();

    jwt_header.push(b'.');
    jwt_header.extend_from_slice(&jwt_payload);

    let mut hasher = Sha256::new();
    hasher.update(&jwt_header);
    let hashed_msg = hasher.finalize();

    let verification = public_key.verify(Pkcs1v15Sign::new::<Sha256>(), &hashed_msg, &signature);

    let public_outputs = match verification {
        Ok(_) => {
            let (email, nonce) = extract_jwt_claims_from_payload(&jwt_payload).unwrap();
            let pk_hash = hash_with_sha256(&pk_der);
            let email_hash = hash_with_sha256(email.as_bytes());

            PublicOutputs {
                email_hash,
                nonce,
                pk_hash,
                verified: true,
            }
        }
        Err(_) => PublicOutputs {
            email_hash: [0u8; 32],
            nonce: String::new(),
            pk_hash: [0u8; 32],
            verified: false,
        },
    };

    sp1_zkvm::io::commit(&public_outputs);
}

fn hash_with_sha256(data: &[u8]) -> Sha256Hash {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().into()
}

fn extract_jwt_claims_from_payload(jwt_payload: &[u8]) -> Option<(String, String)> {
    let payload_str = core::str::from_utf8(jwt_payload).ok()?;
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_str)
        .ok()?;
    let decoded_str = core::str::from_utf8(&payload_bytes).ok()?;
    let json: serde_json::Value = serde_json::from_str(decoded_str).ok()?;

    let email = json["email"].as_str().unwrap_or("").to_string();
    let nonce = json["nonce"].as_str().unwrap_or("").to_string();

    Some((email, nonce))
}

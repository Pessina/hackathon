#![no_main]
sp1_zkvm::entrypoint!(main);

use p3_baby_bear::BabyBear;
use p3_field::AbstractField;
use rsa::{pkcs8::DecodePublicKey, Pkcs1v15Sign, RsaPublicKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sp1_primitives::poseidon2_hash;

type PoseidonHash = [BabyBear; 8];

#[derive(Serialize, Deserialize, Debug)]
pub struct PublicOutputs {
    pub email: String,
    pub nonce: String,
    pub pk_hash: PoseidonHash,
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
            let (email, nonce) = extract_jwt_claims_from_payload(&jwt_payload);
            let pk_hash = hash_with_poseidon(&pk_der);

            PublicOutputs {
                email,
                nonce,
                pk_hash: pk_hash,
                verified: true,
            }
        }
        Err(_) => PublicOutputs {
            email: String::new(),
            nonce: String::new(),
            pk_hash: [BabyBear::zero(); 8],
            verified: false,
        },
    };

    sp1_zkvm::io::commit(&public_outputs);
}

fn extract_jwt_claims_from_payload(jwt_payload: &[u8]) -> (String, String) {
    if let Ok(payload_bytes) = base64_url_decode(core::str::from_utf8(jwt_payload).unwrap_or("")) {
        if let Ok(payload_str) = core::str::from_utf8(&payload_bytes) {
            let email = extract_json_string_field(payload_str, "email");
            let nonce = extract_json_string_field(payload_str, "nonce");
            return (email, nonce);
        }
    }

    (String::new(), String::new())
}

fn hash_with_poseidon(data: &[u8]) -> PoseidonHash {
    let mut input = Vec::new();

    for byte in data {
        input.push(BabyBear::from_canonical_u8(*byte));
    }

    poseidon2_hash(input)
}

fn base64_url_decode(input: &str) -> Result<Vec<u8>, &'static str> {
    let mut result = Vec::new();
    let chars = input.chars().filter(|&c| c != '=');
    let mut buffer = 0u32;
    let mut bits = 0;

    for c in chars {
        let value = match c {
            'A'..='Z' => (c as u8 - b'A') as u32,
            'a'..='z' => (c as u8 - b'a' + 26) as u32,
            '0'..='9' => (c as u8 - b'0' + 52) as u32,
            '-' => 62,
            '_' => 63,
            _ => return Err("Invalid character"),
        };

        buffer = (buffer << 6) | value;
        bits += 6;

        if bits >= 8 {
            result.push((buffer >> (bits - 8)) as u8);
            bits -= 8;
        }
    }

    Ok(result)
}

fn extract_json_string_field(json: &str, field_name: &str) -> String {
    let field_pattern = format!("\"{}\"", field_name);

    if let Some(field_pos) = json.find(&field_pattern) {
        let search_start = field_pos + field_pattern.len();

        if let Some(colon_pos) = json[search_start..].find(':') {
            let value_start = search_start + colon_pos + 1;

            let trimmed = json[value_start..].trim_start();
            if trimmed.starts_with('"') {
                let quote_start = value_start + (json[value_start..].len() - trimmed.len()) + 1;

                if let Some(quote_end) = json[quote_start..].find('"') {
                    return json[quote_start..quote_start + quote_end].to_string();
                }
            }
        }
    }

    String::new()
}

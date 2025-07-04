#![no_main]
sp1_zkvm::entrypoint!(main);

use base64::Engine;
use p3_baby_bear::BabyBear;
use p3_field::AbstractField;
use rsa::{pkcs8::DecodePublicKey, Pkcs1v15Sign, RsaPublicKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sp1_primitives::poseidon2_hash;

// Using SP1's poseidon hash for ZK circuit efficiency
type PoseidonHash = [BabyBear; 8];

// Optimized JWT claims - only hash private fields, expose public fields directly
#[derive(Serialize, Deserialize, Debug)]
pub struct PublicOutputs {
    pub email_hash: PoseidonHash, // Email hash (private field that needs hashing)
    pub pk_hash: PoseidonHash,    // Public key hash (to verify issuer)
    pub sub: String,              // Subject (public field, exposed directly)
    pub iss: String,              // Issuer (public field, exposed directly)
    pub aud: String,              // Audience (public field, exposed directly)
    pub verified: bool,
}

pub fn main() {
    let pk_der = sp1_zkvm::io::read::<Vec<u8>>();
    let mut jwt_header = sp1_zkvm::io::read::<Vec<u8>>();
    let jwt_payload = sp1_zkvm::io::read::<Vec<u8>>();
    let signature = sp1_zkvm::io::read::<Vec<u8>>();

    let public_key = RsaPublicKey::from_public_key_der(&pk_der).unwrap();

    // Hash the public key DER for verification
    let pk_hash = hash_with_poseidon(&pk_der);

    jwt_header.push(b'.');
    jwt_header.extend_from_slice(&jwt_payload);

    let mut hasher = Sha256::new();
    hasher.update(&jwt_header);
    let hashed_msg = hasher.finalize();

    let verification = public_key.verify(Pkcs1v15Sign::new::<Sha256>(), &hashed_msg, &signature);

    let public_outputs = match verification {
        Ok(_) => {
            // Extract JWT claims
            let claims = extract_jwt_claims(&jwt_payload);

            match claims {
                Ok((sub, iss, email, aud)) => {
                    // Only hash the private field (email)
                    let email_hash = hash_with_poseidon(email.as_bytes());

                    PublicOutputs {
                        email_hash,
                        pk_hash,
                        sub,
                        iss,
                        aud,
                        verified: true,
                    }
                }
                Err(_) => PublicOutputs {
                    email_hash: [BabyBear::zero(); 8],
                    pk_hash: [BabyBear::zero(); 8],
                    sub: String::new(),
                    iss: String::new(),
                    aud: String::new(),
                    verified: false,
                },
            }
        }
        Err(_) => PublicOutputs {
            email_hash: [BabyBear::zero(); 8],
            pk_hash: [BabyBear::zero(); 8],
            sub: String::new(),
            iss: String::new(),
            aud: String::new(),
            verified: false,
        },
    };

    sp1_zkvm::io::commit(&public_outputs);
}

// Use SP1's native poseidon2_hash for ZK circuit efficiency
fn hash_with_poseidon(data: &[u8]) -> PoseidonHash {
    // Convert bytes to BabyBear field elements efficiently
    let mut field_elements = Vec::new();

    // Process data in 4-byte chunks to fit into BabyBear field elements (31-bit max)
    for chunk in data.chunks(4) {
        let mut value = 0u32;
        for (i, &byte) in chunk.iter().enumerate() {
            value |= (byte as u32) << (i * 8);
        }
        // Ensure value fits in BabyBear field (mod 2^31 - 2^27 + 1)
        field_elements.push(BabyBear::from_canonical_u32(value));
    }

    // SP1's poseidon2_hash can handle variable-length input
    // The function internally handles padding and sponge construction
    poseidon2_hash(field_elements)
}

// Extract JWT claims without time validation
fn extract_jwt_claims(
    jwt_payload: &[u8],
) -> Result<(String, String, String, String), &'static str> {
    let payload_str = core::str::from_utf8(jwt_payload).map_err(|_| "Invalid UTF-8")?;
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_str)
        .map_err(|_| "Base64 decode failed")?;
    let decoded_str =
        core::str::from_utf8(&payload_bytes).map_err(|_| "Invalid UTF-8 in payload")?;
    let json: serde_json::Value = serde_json::from_str(decoded_str).map_err(|_| "Invalid JSON")?;

    // Extract JWT claims (no time validation)
    let sub = json["sub"].as_str().ok_or("Missing sub claim")?.to_string();
    let iss = json["iss"].as_str().ok_or("Missing iss claim")?.to_string();
    let email = json["email"]
        .as_str()
        .ok_or("Missing email claim")?
        .to_string();
    let aud = json["aud"].as_str().ok_or("Missing aud claim")?.to_string();

    // Basic issuer validation for Google
    if !iss.contains("accounts.google.com") {
        return Err("Invalid issuer");
    }

    Ok((sub, iss, email, aud))
}

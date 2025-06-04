#![no_main]
sp1_zkvm::entrypoint!(main);

use base64::{engine::general_purpose, Engine as _};
use rsa::{pkcs8::DecodePublicKey, Pkcs1v15Sign, RsaPublicKey};
use sha2::{Digest, Sha256};

use p3_baby_bear::BabyBear;
use p3_field::{AbstractField, PrimeField32};
use sp1_primitives::poseidon2_hash;

type PoseidonHash = [BabyBear; 8];

fn extract_email_and_nonce_lightweight(payload: &str) -> Result<(String, String), &'static str> {
    let decoded_payload = general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| "Failed to decode base64url payload")?;
    let payload_str =
        std::str::from_utf8(&decoded_payload).map_err(|_| "Invalid UTF-8 in payload")?;

    let email_pattern = "\"email\":\"";
    let email_start = payload_str
        .find(email_pattern)
        .ok_or("No email found in JWT claims")?
        + email_pattern.len();
    let email_end = payload_str[email_start..]
        .find('"')
        .ok_or("Email parse error")?
        + email_start;
    let email = &payload_str[email_start..email_end];

    let nonce_pattern = "\"nonce\":\"";
    let nonce_start = payload_str
        .find(nonce_pattern)
        .ok_or("No nonce found in JWT claims")?
        + nonce_pattern.len();
    let nonce_end = payload_str[nonce_start..]
        .find('"')
        .ok_or("Nonce parse error")?
        + nonce_start;
    let nonce = &payload_str[nonce_start..nonce_end];

    Ok((email.to_string(), nonce.to_string()))
}

fn hash_with_poseidon(data: &[u8]) -> PoseidonHash {
    let mut input = Vec::new();

    for byte in data {
        input.push(BabyBear::from_canonical_u8(*byte));
    }

    poseidon2_hash(input)
}

fn verify_jwt_from_parts(
    header: &str,
    payload: &str,
    signature: &[u8],
    public_key: &RsaPublicKey,
) -> Result<(String, String), &'static str> {
    let (email, nonce) = extract_email_and_nonce_lightweight(payload)?;

    let mut hasher = Sha256::new();
    hasher.update(header.as_bytes());
    hasher.update(b".");
    hasher.update(payload.as_bytes());
    let hashed_msg = hasher.finalize();

    public_key
        .verify(Pkcs1v15Sign::new::<Sha256>(), &hashed_msg, signature)
        .map_err(|_| "JWT signature verification failed")?;

    Ok((email, nonce))
}

pub fn main() {
    let public_key_der = sp1_zkvm::io::read::<Vec<u8>>();
    let jwt_header = sp1_zkvm::io::read::<String>();
    let jwt_payload = sp1_zkvm::io::read::<String>();
    let jwt_signature = sp1_zkvm::io::read::<Vec<u8>>();

    let public_key =
        RsaPublicKey::from_public_key_der(&public_key_der).expect("Failed to parse public key");

    let (email, nonce) =
        verify_jwt_from_parts(&jwt_header, &jwt_payload, &jwt_signature, &public_key)
            .expect("JWT verification failed");

    let pk_hash_poseidon = hash_with_poseidon(&public_key_der);
    let email_hash_poseidon = hash_with_poseidon(email.as_bytes());

    let pk_hash_bytes: Vec<u8> = pk_hash_poseidon
        .iter()
        .flat_map(|&x| x.as_canonical_u32().to_le_bytes())
        .collect();

    let email_hash_bytes: Vec<u8> = email_hash_poseidon
        .iter()
        .flat_map(|&x| x.as_canonical_u32().to_le_bytes())
        .collect();

    sp1_zkvm::io::commit(&pk_hash_bytes);
    sp1_zkvm::io::commit(&email_hash_bytes);
    sp1_zkvm::io::commit(&nonce);
}

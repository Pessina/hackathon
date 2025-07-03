use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Result};
use serde::{Deserialize, Serialize};
use sp1_sdk::{ProverClient, SP1ProofWithPublicValues, SP1Stdin, SP1VerifyingKey};
use std::time::{SystemTime, UNIX_EPOCH};

// JWT proof request structure
#[derive(Deserialize)]
struct ProofRequest {
    pub header: String,
    pub payload: String,
    pub signature: String,
    pub public_key: String,
}

// Proof response structure
#[derive(Serialize)]
struct ProofResponse {
    pub proof: String,
    pub verification_key: String,
    pub public_outputs_bytes: String,
    pub proof_size: usize,
}

// SP1 program ELF
const ELF: &[u8] = include_bytes!("../../jwt-zk-proving-server/program/target/riscv32im-succinct-zkvm-elf/release/jwt-zk-proving-server");

struct AppState {
    prover: ProverClient,
    vk: SP1VerifyingKey,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    println!("Starting SP1 proving server...");
    
    // Initialize SP1 prover
    let prover = ProverClient::new();
    let vk = prover.setup(ELF);
    
    println!("SP1 prover initialized");
    
    let app_state = web::Data::new(AppState { prover, vk });
    
    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .wrap(
                Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header()
            )
            .route("/health", web::get().to(health_check))
            .route("/prove", web::post().to(generate_proof))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}

async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "sp1-proving-server"
    })))
}

async fn generate_proof(
    req: web::Json<ProofRequest>,
    app_state: web::Data<AppState>,
) -> Result<HttpResponse> {
    println!("Generating proof for JWT...");
    
    match prove_jwt(&req, &app_state.prover, &app_state.vk).await {
        Ok(response) => {
            println!("Proof generated successfully");
            Ok(HttpResponse::Ok().json(response))
        }
        Err(e) => {
            eprintln!("Error generating proof: {}", e);
            Ok(HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to generate proof: {}", e)
            })))
        }
    }
}

async fn prove_jwt(
    req: &ProofRequest,
    prover: &ProverClient,
    vk: &SP1VerifyingKey,
) -> anyhow::Result<ProofResponse> {
    // Prepare inputs
    let mut stdin = SP1Stdin::new();
    
    // Decode public key from base64
    let pk_der = base64::decode(&req.public_key)?;
    stdin.write(&pk_der);
    
    // JWT header and payload as bytes
    let header_bytes = req.header.as_bytes().to_vec();
    let payload_bytes = req.payload.as_bytes().to_vec();
    stdin.write(&header_bytes);
    stdin.write(&payload_bytes);
    
    // Decode signature from base64
    let signature = base64::decode(&req.signature)?;
    stdin.write(&signature);
    
    // Current timestamp for expiration validation
    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    stdin.write(&current_time);
    
    println!("Generating SP1 proof...");
    
    // Generate proof
    let proof = prover.prove(ELF, stdin).run()?;
    
    // Verify proof
    prover.verify(&proof, vk)?;
    
    println!("Proof verified successfully");
    
    // Convert proof to response format
    let proof_bytes = bincode::serialize(&proof.proof)?;
    let public_outputs_bytes = bincode::serialize(&proof.public_values)?;
    
    Ok(ProofResponse {
        proof: hex::encode(&proof_bytes),
        verification_key: format!("0x{}", hex::encode(vk.bytes32())),
        public_outputs_bytes: hex::encode(&public_outputs_bytes),
        proof_size: proof_bytes.len(),
    })
}
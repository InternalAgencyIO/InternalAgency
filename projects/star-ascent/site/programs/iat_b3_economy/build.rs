use solana_pubkey::Pubkey;
use std::{env, fs, path::PathBuf, str::FromStr};

const LAW_PROGRAM_ID_ENV: &str = "IAT_B3_PRODUCTION_LAW_PROGRAM_ID";
const ECONOMY_PROGRAM_ID_ENV: &str = "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID";
const CANONICAL_MINT_ENV: &str = "IAT_B3_PRODUCTION_CANONICAL_MINT";
const NETWORK_GENESIS_HASH_ENV: &str = "IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH";
const LAW_STATE_SEED: &[u8] = b"law-state";

fn required_bytes32(name: &str) -> Pubkey {
    let raw = env::var(name).unwrap_or_else(|_| {
        panic!("feature `runtime-production-entrypoint` requires the explicit frozen {name} input")
    });
    let value = Pubkey::from_str(&raw)
        .unwrap_or_else(|_| panic!("{name} must be one canonical Base58-encoded 32-byte value"));
    assert_eq!(
        value.to_string(),
        raw,
        "{name} must use the canonical Base58 encoding"
    );
    assert_ne!(
        value,
        Pubkey::default(),
        "{name} must not be the all-zero value"
    );
    value
}

fn bytes(value: &Pubkey) -> String {
    format!("{:?}", value.to_bytes())
}

fn main() {
    for name in [
        LAW_PROGRAM_ID_ENV,
        ECONOMY_PROGRAM_ID_ENV,
        CANONICAL_MINT_ENV,
        NETWORK_GENESIS_HASH_ENV,
    ] {
        println!("cargo:rerun-if-env-changed={name}");
    }

    if env::var_os("CARGO_FEATURE_RUNTIME_PRODUCTION_ENTRYPOINT").is_none() {
        return;
    }

    let law_program_id = required_bytes32(LAW_PROGRAM_ID_ENV);
    let economy_program_id = required_bytes32(ECONOMY_PROGRAM_ID_ENV);
    let canonical_mint = required_bytes32(CANONICAL_MINT_ENV);
    let network_genesis_hash = required_bytes32(NETWORK_GENESIS_HASH_ENV);
    assert_ne!(
        law_program_id, economy_program_id,
        "production law and economy program IDs must be distinct"
    );
    assert_ne!(
        law_program_id, canonical_mint,
        "production law program ID and canonical mint must be distinct"
    );
    assert_ne!(
        economy_program_id, canonical_mint,
        "production economy program ID and canonical mint must be distinct"
    );

    let (law_state, law_state_bump) =
        Pubkey::find_program_address(&[LAW_STATE_SEED, canonical_mint.as_ref()], &law_program_id);
    let generated = format!(
        "pub const LAW_PROGRAM_ID_BYTES: [u8; 32] = {};\n\
         pub const ECONOMY_PROGRAM_ID_BYTES: [u8; 32] = {};\n\
         pub const CANONICAL_MINT_BYTES: [u8; 32] = {};\n\
         pub const NETWORK_GENESIS_HASH_BYTES: [u8; 32] = {};\n\
         pub const LAW_STATE_BYTES: [u8; 32] = {};\n\
         pub const LAW_STATE_BUMP: u8 = {};\n",
        bytes(&law_program_id),
        bytes(&economy_program_id),
        bytes(&canonical_mint),
        bytes(&network_genesis_hash),
        bytes(&law_state),
        law_state_bump,
    );
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo must provide OUT_DIR"))
        .join("iat_b3_production_economy_identity.rs");
    fs::write(output, generated).expect("write frozen production economy identity module");
}

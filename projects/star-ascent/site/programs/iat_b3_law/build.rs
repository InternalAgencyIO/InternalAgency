use solana_pubkey::Pubkey;
use std::{env, fs, path::PathBuf, str::FromStr};

const LAW_PROGRAM_ID_ENV: &str = "IAT_B3_PRODUCTION_LAW_PROGRAM_ID";
const ECONOMY_PROGRAM_ID_ENV: &str = "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID";
const CANONICAL_MINT_ENV: &str = "IAT_B3_PRODUCTION_CANONICAL_MINT";
const ECONOMY_CONFIG_SEED: &[u8] = b"config";
const ECONOMY_STAKE_TOKEN_SEED: &[u8] = b"stake-token";
const ECONOMY_STAKE_INGRESS_AUTHORITY_SEED: &[u8] = b"stake-ingress";

fn required_pubkey(name: &str) -> Pubkey {
    let raw = env::var(name).unwrap_or_else(|_| {
        panic!("feature `production-combined-hook` requires the explicit frozen {name} input")
    });
    let key = Pubkey::from_str(&raw)
        .unwrap_or_else(|_| panic!("{name} must be one canonical Base58 Solana public key"));
    assert_eq!(
        key.to_string(),
        raw,
        "{name} must use the canonical Base58 encoding"
    );
    assert_ne!(
        key,
        Pubkey::default(),
        "{name} must not be the all-zero public key"
    );
    key
}

fn pubkey_array(key: &Pubkey) -> String {
    let bytes = key.to_bytes();
    format!("{bytes:?}")
}

fn main() {
    for name in [
        LAW_PROGRAM_ID_ENV,
        ECONOMY_PROGRAM_ID_ENV,
        CANONICAL_MINT_ENV,
    ] {
        println!("cargo:rerun-if-env-changed={name}");
    }

    if env::var_os("CARGO_FEATURE_PRODUCTION_COMBINED_HOOK").is_none() {
        return;
    }

    let law_program_id = required_pubkey(LAW_PROGRAM_ID_ENV);
    let economy_program_id = required_pubkey(ECONOMY_PROGRAM_ID_ENV);
    let canonical_mint = required_pubkey(CANONICAL_MINT_ENV);
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

    let (config, _) = Pubkey::find_program_address(
        &[ECONOMY_CONFIG_SEED, canonical_mint.as_ref()],
        &economy_program_id,
    );
    let (stake_vault, _) = Pubkey::find_program_address(
        &[ECONOMY_STAKE_TOKEN_SEED, config.as_ref()],
        &economy_program_id,
    );
    let (ingress_authority, _) = Pubkey::find_program_address(
        &[ECONOMY_STAKE_INGRESS_AUTHORITY_SEED, config.as_ref()],
        &economy_program_id,
    );
    assert_ne!(
        config, stake_vault,
        "derived Config and stake vault must differ"
    );
    assert_ne!(
        config, ingress_authority,
        "derived Config and ingress authority must differ"
    );
    assert_ne!(
        stake_vault, ingress_authority,
        "derived stake vault and ingress authority must differ"
    );

    let generated = format!(
        "pub const LAW_PROGRAM_ID_BYTES: [u8; 32] = {};\n\
         pub const ECONOMY_PROGRAM_ID_BYTES: [u8; 32] = {};\n\
         pub const CANONICAL_MINT_BYTES: [u8; 32] = {};\n\
         pub const STAKE_VAULT_BYTES: [u8; 32] = {};\n\
         pub const INGRESS_AUTHORITY_BYTES: [u8; 32] = {};\n",
        pubkey_array(&law_program_id),
        pubkey_array(&economy_program_id),
        pubkey_array(&canonical_mint),
        pubkey_array(&stake_vault),
        pubkey_array(&ingress_authority),
    );
    let output = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo must provide OUT_DIR"))
        .join("iat_b3_production_combined_identity.rs");
    fs::write(output, generated).expect("write frozen production identity module");
}

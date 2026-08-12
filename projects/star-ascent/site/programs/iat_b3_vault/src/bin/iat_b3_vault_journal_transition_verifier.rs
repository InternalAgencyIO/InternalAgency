use std::io::{self, Read, Write};

use iat_b3_vault::journal_transition_codec::{
    decode_journal_transition_receipt, encode_journal_transition_receipt,
    JOURNAL_TRANSITION_RECEIPT_BYTES_LEN,
};

const RESPONSE_MAGIC: [u8; 8] = *b"IATB3JVR";
const RESPONSE_VERSION: u8 = 1;
const RESPONSE_KIND: u8 = 1;
const RESPONSE_HEADER_LEN: usize = 16;
const DIGEST_LEN: usize = 32;
const RESPONSE_PAYLOAD_LEN: usize = JOURNAL_TRANSITION_RECEIPT_BYTES_LEN + DIGEST_LEN * 2;
const RESPONSE_LEN: usize = RESPONSE_HEADER_LEN + RESPONSE_PAYLOAD_LEN;

fn verify_one_frame() -> Result<(), ()> {
    if std::env::args_os().count() != 1 {
        return Err(());
    }

    let mut input = Vec::with_capacity(JOURNAL_TRANSITION_RECEIPT_BYTES_LEN + 1);
    io::stdin()
        .lock()
        .take((JOURNAL_TRANSITION_RECEIPT_BYTES_LEN + 1) as u64)
        .read_to_end(&mut input)
        .map_err(|_| ())?;
    if input.len() != JOURNAL_TRANSITION_RECEIPT_BYTES_LEN {
        return Err(());
    }

    let receipt = decode_journal_transition_receipt(&input).map_err(|_| ())?;
    let canonical = encode_journal_transition_receipt(&receipt).map_err(|_| ())?;
    if canonical.as_slice() != input {
        return Err(());
    }

    let mut response = [0u8; RESPONSE_LEN];
    response[..8].copy_from_slice(&RESPONSE_MAGIC);
    response[8] = RESPONSE_VERSION;
    response[9] = RESPONSE_KIND;
    response[10..12].fill(0);
    response[12..16].copy_from_slice(&(RESPONSE_PAYLOAD_LEN as u32).to_be_bytes());
    response[RESPONSE_HEADER_LEN..RESPONSE_HEADER_LEN + JOURNAL_TRANSITION_RECEIPT_BYTES_LEN]
        .copy_from_slice(&canonical);
    let before_offset = RESPONSE_HEADER_LEN + JOURNAL_TRANSITION_RECEIPT_BYTES_LEN;
    response[before_offset..before_offset + DIGEST_LEN]
        .copy_from_slice(&receipt.before_journal_digest());
    response[before_offset + DIGEST_LEN..].copy_from_slice(&receipt.after_journal_digest());

    let mut stdout = io::stdout().lock();
    stdout.write_all(&response).map_err(|_| ())?;
    stdout.flush().map_err(|_| ())
}

fn main() {
    if verify_one_frame().is_err() {
        eprintln!("IAT_B3_PRIVACY_JOURNAL_TRANSITION_VERIFICATION_FAILED");
        std::process::exit(2);
    }
}

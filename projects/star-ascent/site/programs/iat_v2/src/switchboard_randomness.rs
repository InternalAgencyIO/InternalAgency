use anchor_lang::{prelude::Pubkey, solana_program::instruction::Instruction};

/// Switchboard On-Demand 0.13.0 mainnet program ID.
pub const ON_DEMAND_MAINNET_PID: Pubkey = Pubkey::new_from_array([
    6, 115, 189, 70, 242, 228, 126, 4, 241, 43, 217, 47, 183, 49, 150, 142, 205, 157, 151, 87, 194,
    116, 218, 135, 71, 111, 70, 92, 4, 12, 101, 115,
]);

/// Switchboard On-Demand 0.13.0 devnet program ID.
pub const ON_DEMAND_DEVNET_PID: Pubkey = Pubkey::new_from_array([
    144, 110, 20, 100, 197, 248, 183, 99, 60, 192, 90, 66, 76, 221, 179, 174, 205, 109, 171, 184,
    174, 199, 71, 188, 79, 62, 17, 48, 30, 64, 99, 203,
]);

/// Anchor discriminator declared by Switchboard On-Demand 0.13.0 for
/// `RandomnessAccountData`.
pub const RANDOMNESS_DISCRIMINATOR: [u8; 8] = [10, 66, 229, 135, 220, 239, 217, 114];
/// Anchor discriminator for Switchboard's `randomness_commit` instruction.
pub const RANDOMNESS_COMMIT_DISCRIMINATOR: [u8; 8] = [52, 170, 152, 201, 179, 133, 242, 141];

// Switchboard's `#[repr(C)]` account body is exactly 400 bytes:
// authority(32), queue(32), seed_slothash(32), seed_slot(8), oracle(32),
// reveal_slot(8), value(32), ebuf2(96), ebuf1(128). Anchor prepends 8 bytes.
pub const RANDOMNESS_ACCOUNT_SIZE: usize = 408;
const SEED_SLOT_START: usize = 104;
const REVEAL_SLOT_START: usize = 144;
const VALUE_START: usize = 152;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ParsedRandomness {
    pub seed_slot: u64,
    pub reveal_slot: u64,
    pub value: [u8; 32],
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RevealValidationError {
    RevealNotCurrent,
    CommitSlotMismatch,
    RevealNotAfterCommit,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CommitInstructionValidationError {
    WrongProgram,
    WrongDiscriminator,
    MissingAccounts,
    WrongRandomnessAccount,
    WrongAuthority,
}

impl ParsedRandomness {
    /// Switchboard commits the most recent slot hash, so a commit bundled
    /// immediately before the application instruction has seed_slot =
    /// current_slot - 1. The same-slot reveal guard rejects an already
    /// resolved account.
    pub fn is_fresh_unrevealed_commit(&self, current_slot: u64) -> bool {
        current_slot.checked_sub(1) == Some(self.seed_slot) && self.reveal_slot != current_slot
    }

    pub fn validated_reveal(
        &self,
        current_slot: u64,
        committed_seed_slot: u64,
    ) -> Result<[u8; 32], RevealValidationError> {
        if self.reveal_slot != current_slot {
            return Err(RevealValidationError::RevealNotCurrent);
        }
        if self.seed_slot != committed_seed_slot {
            return Err(RevealValidationError::CommitSlotMismatch);
        }
        if self.reveal_slot <= self.seed_slot {
            return Err(RevealValidationError::RevealNotAfterCommit);
        }
        Ok(self.value)
    }
}

/// Validate that the immediately preceding transaction instruction is the
/// Switchboard `randomness_commit` for this exact account and payer/authority.
/// Switchboard itself validates the queue, oracle and authority relationship.
pub fn validate_commit_instruction(
    instruction: &Instruction,
    randomness_program: Pubkey,
    randomness_account: Pubkey,
    authority: Pubkey,
) -> Result<(), CommitInstructionValidationError> {
    if instruction.program_id != randomness_program {
        return Err(CommitInstructionValidationError::WrongProgram);
    }
    if instruction.data.get(..8) != Some(RANDOMNESS_COMMIT_DISCRIMINATOR.as_slice()) {
        return Err(CommitInstructionValidationError::WrongDiscriminator);
    }
    if instruction.accounts.len() < 5 {
        return Err(CommitInstructionValidationError::MissingAccounts);
    }
    if instruction.accounts[0].pubkey != randomness_account || !instruction.accounts[0].is_writable
    {
        return Err(CommitInstructionValidationError::WrongRandomnessAccount);
    }
    if instruction.accounts[4].pubkey != authority || !instruction.accounts[4].is_signer {
        return Err(CommitInstructionValidationError::WrongAuthority);
    }
    Ok(())
}

/// Parse only the fields IAT consumes from the Switchboard account. Explicit
/// offsets avoid unaligned zero-copy casts and keep the on-chain dependency
/// surface limited to the audited ABI.
pub fn parse_randomness(data: &[u8]) -> Option<ParsedRandomness> {
    if data.len() < RANDOMNESS_ACCOUNT_SIZE
        || data.get(..RANDOMNESS_DISCRIMINATOR.len())? != RANDOMNESS_DISCRIMINATOR
    {
        return None;
    }

    let seed_slot = u64::from_le_bytes(
        data.get(SEED_SLOT_START..SEED_SLOT_START + 8)?
            .try_into()
            .ok()?,
    );
    let reveal_slot = u64::from_le_bytes(
        data.get(REVEAL_SLOT_START..REVEAL_SLOT_START + 8)?
            .try_into()
            .ok()?,
    );
    let value = data.get(VALUE_START..VALUE_START + 32)?.try_into().ok()?;

    Some(ParsedRandomness {
        seed_slot,
        reveal_slot,
        value,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(seed_slot: u64, reveal_slot: u64, value: [u8; 32]) -> Vec<u8> {
        let mut data = vec![0u8; RANDOMNESS_ACCOUNT_SIZE];
        data[..8].copy_from_slice(&RANDOMNESS_DISCRIMINATOR);
        data[SEED_SLOT_START..SEED_SLOT_START + 8].copy_from_slice(&seed_slot.to_le_bytes());
        data[REVEAL_SLOT_START..REVEAL_SLOT_START + 8].copy_from_slice(&reveal_slot.to_le_bytes());
        data[VALUE_START..VALUE_START + 32].copy_from_slice(&value);
        data
    }

    #[test]
    fn parses_the_pinned_switchboard_013_layout() {
        let data = fixture(41, 42, [0xa5; 32]);
        assert_eq!(
            parse_randomness(&data),
            Some(ParsedRandomness {
                seed_slot: 41,
                reveal_slot: 42,
                value: [0xa5; 32],
            })
        );
    }

    #[test]
    fn rejects_short_or_wrong_discriminator_data() {
        assert_eq!(parse_randomness(&[0u8; 407]), None);
        let mut data = fixture(41, 42, [0xa5; 32]);
        data[0] ^= 1;
        assert_eq!(parse_randomness(&data), None);
    }

    #[test]
    fn accepts_forward_compatible_trailing_bytes() {
        let mut data = fixture(41, 42, [0xa5; 32]);
        data.extend_from_slice(&[9, 8, 7]);
        assert_eq!(parse_randomness(&data).unwrap().reveal_slot, 42);
    }

    #[test]
    fn commit_must_bind_the_previous_seed_slot_and_be_unrevealed() {
        let parsed = parse_randomness(&fixture(41, 0, [0; 32])).unwrap();
        assert!(parsed.is_fresh_unrevealed_commit(42));
        assert!(!parsed.is_fresh_unrevealed_commit(41));
        assert!(!parsed.is_fresh_unrevealed_commit(43));
        let already_revealed = parse_randomness(&fixture(41, 42, [0xa5; 32])).unwrap();
        assert!(!already_revealed.is_fresh_unrevealed_commit(42));
    }

    #[test]
    fn reveal_validation_rejects_every_slot_failure_path() {
        let current = parse_randomness(&fixture(41, 42, [0xa5; 32])).unwrap();
        assert_eq!(current.validated_reveal(42, 41), Ok([0xa5; 32]));
        assert_eq!(
            current.validated_reveal(43, 41),
            Err(RevealValidationError::RevealNotCurrent)
        );
        assert_eq!(
            current.validated_reveal(42, 40),
            Err(RevealValidationError::CommitSlotMismatch)
        );
        let not_after = parse_randomness(&fixture(42, 42, [0xa5; 32])).unwrap();
        assert_eq!(
            not_after.validated_reveal(42, 42),
            Err(RevealValidationError::RevealNotAfterCommit)
        );
    }

    #[test]
    fn program_id_constants_match_the_published_addresses() {
        assert_eq!(
            ON_DEMAND_MAINNET_PID.to_string(),
            "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"
        );
        assert_eq!(
            ON_DEMAND_DEVNET_PID.to_string(),
            "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"
        );
    }

    #[test]
    fn commit_instruction_must_be_exact_and_atomic() {
        use anchor_lang::solana_program::instruction::AccountMeta;

        let randomness_program = Pubkey::new_unique();
        let randomness_account = Pubkey::new_unique();
        let authority = Pubkey::new_unique();
        let queue = Pubkey::new_unique();
        let oracle = Pubkey::new_unique();
        let slot_hashes = Pubkey::new_unique();
        let instruction = Instruction {
            program_id: randomness_program,
            accounts: vec![
                AccountMeta::new(randomness_account, false),
                AccountMeta::new_readonly(queue, false),
                AccountMeta::new(oracle, false),
                AccountMeta::new_readonly(slot_hashes, false),
                AccountMeta::new_readonly(authority, true),
            ],
            data: RANDOMNESS_COMMIT_DISCRIMINATOR.to_vec(),
        };
        assert_eq!(
            validate_commit_instruction(
                &instruction,
                randomness_program,
                randomness_account,
                authority,
            ),
            Ok(())
        );

        let mut wrong_discriminator = instruction.clone();
        wrong_discriminator.data[0] ^= 1;
        assert_eq!(
            validate_commit_instruction(
                &wrong_discriminator,
                randomness_program,
                randomness_account,
                authority,
            ),
            Err(CommitInstructionValidationError::WrongDiscriminator)
        );

        let mut wrong_account = instruction.clone();
        wrong_account.accounts[0] = AccountMeta::new(Pubkey::new_unique(), false);
        assert_eq!(
            validate_commit_instruction(
                &wrong_account,
                randomness_program,
                randomness_account,
                authority,
            ),
            Err(CommitInstructionValidationError::WrongRandomnessAccount)
        );

        let mut wrong_authority = instruction.clone();
        wrong_authority.accounts[4] = AccountMeta::new_readonly(Pubkey::new_unique(), true);
        assert_eq!(
            validate_commit_instruction(
                &wrong_authority,
                randomness_program,
                randomness_account,
                authority,
            ),
            Err(CommitInstructionValidationError::WrongAuthority)
        );
    }
}

#![forbid(unsafe_code)]

use solana_pubkey::Pubkey;

const STAKE_INGRESS_BINDING_MAGIC: &[u8; 8] = b"IATB3IG1";
const STAKE_INGRESS_BINDING_VERSION: u8 = 1;
const STAKE_INGRESS_BINDING_LEN: usize = 176;
const ECONOMY_CONFIG_SEED: &[u8] = b"config";
const ECONOMY_STAKE_TOKEN_SEED: &[u8] = b"stake-token";
const ECONOMY_STAKE_INGRESS_AUTHORITY_SEED: &[u8] = b"stake-ingress";

const LAW_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB3; 32]);
const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
const MINT: Pubkey = Pubkey::new_from_array([0x22; 32]);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum StakeIngressSpecError {
    InvalidBinding,
    InvalidMint,
    UnauthorizedStakeIngress,
}

/// Test-only native codec for the immutable address facts a final hook needs.
/// It is intentionally outside `src/lib.rs`, so unfrozen identities cannot
/// change the currently pinned SBF artifact or become a deployable rule.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct StakeIngressBinding {
    config_bump: u8,
    stake_vault_bump: u8,
    ingress_authority_bump: u8,
    economy_program_id: Pubkey,
    mint: Pubkey,
    config: Pubkey,
    stake_vault: Pubkey,
    ingress_authority: Pubkey,
}

impl StakeIngressBinding {
    fn derive(economy_program_id: Pubkey, mint: Pubkey) -> Result<Self, StakeIngressSpecError> {
        if economy_program_id == Pubkey::default() || mint == Pubkey::default() {
            return Err(StakeIngressSpecError::InvalidBinding);
        }
        let (config, config_bump) = Pubkey::find_program_address(
            &[ECONOMY_CONFIG_SEED, mint.as_ref()],
            &economy_program_id,
        );
        let (stake_vault, stake_vault_bump) = Pubkey::find_program_address(
            &[ECONOMY_STAKE_TOKEN_SEED, config.as_ref()],
            &economy_program_id,
        );
        let (ingress_authority, ingress_authority_bump) = Pubkey::find_program_address(
            &[ECONOMY_STAKE_INGRESS_AUTHORITY_SEED, config.as_ref()],
            &economy_program_id,
        );
        Ok(Self {
            config_bump,
            stake_vault_bump,
            ingress_authority_bump,
            economy_program_id,
            mint,
            config,
            stake_vault,
            ingress_authority,
        })
    }

    fn validate(&self) -> Result<(), StakeIngressSpecError> {
        if *self != Self::derive(self.economy_program_id, self.mint)? {
            return Err(StakeIngressSpecError::InvalidBinding);
        }
        Ok(())
    }

    fn pack(&self, output: &mut [u8]) -> Result<(), StakeIngressSpecError> {
        if output.len() != STAKE_INGRESS_BINDING_LEN {
            return Err(StakeIngressSpecError::InvalidBinding);
        }
        self.validate()?;
        output.fill(0);
        output[0..8].copy_from_slice(STAKE_INGRESS_BINDING_MAGIC);
        output[8] = STAKE_INGRESS_BINDING_VERSION;
        output[9] = self.config_bump;
        output[10] = self.stake_vault_bump;
        output[11] = self.ingress_authority_bump;
        output[16..48].copy_from_slice(self.economy_program_id.as_ref());
        output[48..80].copy_from_slice(self.mint.as_ref());
        output[80..112].copy_from_slice(self.config.as_ref());
        output[112..144].copy_from_slice(self.stake_vault.as_ref());
        output[144..176].copy_from_slice(self.ingress_authority.as_ref());
        Ok(())
    }

    fn unpack(input: &[u8]) -> Result<Self, StakeIngressSpecError> {
        if input.len() != STAKE_INGRESS_BINDING_LEN
            || input.get(0..8) != Some(STAKE_INGRESS_BINDING_MAGIC)
            || input[8] != STAKE_INGRESS_BINDING_VERSION
            || input[12..16].iter().any(|byte| *byte != 0)
        {
            return Err(StakeIngressSpecError::InvalidBinding);
        }
        let binding = Self {
            config_bump: input[9],
            stake_vault_bump: input[10],
            ingress_authority_bump: input[11],
            economy_program_id: Pubkey::new_from_array(copy_array(&input[16..48])?),
            mint: Pubkey::new_from_array(copy_array(&input[48..80])?),
            config: Pubkey::new_from_array(copy_array(&input[80..112])?),
            stake_vault: Pubkey::new_from_array(copy_array(&input[112..144])?),
            ingress_authority: Pubkey::new_from_array(copy_array(&input[144..176])?),
        };
        binding.validate()?;
        Ok(binding)
    }
}

/// Reference admission semantics only. A final hook must call the equivalent
/// after its existing Token-2022 ownership and `transferring` checks. The hook
/// sees the authority key as a non-signer by the pinned interface ABI.
fn enforce_stake_ingress(
    binding: &StakeIngressBinding,
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
) -> Result<(), StakeIngressSpecError> {
    binding.validate()?;
    if mint != &binding.mint {
        return Err(StakeIngressSpecError::InvalidMint);
    }
    if destination != &binding.stake_vault {
        return Ok(());
    }
    if authority != &binding.ingress_authority {
        return Err(StakeIngressSpecError::UnauthorizedStakeIngress);
    }
    Ok(())
}

fn copy_array(input: &[u8]) -> Result<[u8; 32], StakeIngressSpecError> {
    input
        .try_into()
        .map_err(|_| StakeIngressSpecError::InvalidBinding)
}

#[test]
fn binding_round_trip_is_canonical_and_address_specific() {
    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    assert_eq!(binding.validate(), Ok(()));
    assert_ne!(binding.config, binding.stake_vault);
    assert_ne!(binding.stake_vault, binding.ingress_authority);

    let mut bytes = [0u8; STAKE_INGRESS_BINDING_LEN];
    binding.pack(&mut bytes).unwrap();
    assert_eq!(StakeIngressBinding::unpack(&bytes), Ok(binding));

    let other_mint =
        StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, Pubkey::new_from_array([0x23; 32]))
            .unwrap();
    let other_program =
        StakeIngressBinding::derive(Pubkey::new_from_array([0xE4; 32]), MINT).unwrap();
    assert_ne!(binding.config, other_mint.config);
    assert_ne!(binding.config, other_program.config);
    assert_ne!(binding.stake_vault, other_mint.stake_vault);
    assert_ne!(binding.ingress_authority, other_program.ingress_authority);
}

#[test]
fn codec_rejects_zero_identities_forgery_and_noncanonical_bytes() {
    assert_eq!(
        StakeIngressBinding::derive(Pubkey::default(), MINT),
        Err(StakeIngressSpecError::InvalidBinding)
    );
    assert_eq!(
        StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, Pubkey::default()),
        Err(StakeIngressSpecError::InvalidBinding)
    );

    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    let mut forged = binding;
    forged.stake_vault = Pubkey::new_from_array([0x55; 32]);
    assert_eq!(
        forged.validate(),
        Err(StakeIngressSpecError::InvalidBinding)
    );
    assert_eq!(
        forged.pack(&mut [0u8; STAKE_INGRESS_BINDING_LEN]),
        Err(StakeIngressSpecError::InvalidBinding)
    );

    let mut bytes = [0u8; STAKE_INGRESS_BINDING_LEN];
    binding.pack(&mut bytes).unwrap();
    for index in [8usize, 12, 112, 144] {
        let mut corrupt = bytes;
        corrupt[index] ^= 1;
        assert_eq!(
            StakeIngressBinding::unpack(&corrupt),
            Err(StakeIngressSpecError::InvalidBinding),
            "byte {index} must be covered by canonical validation"
        );
    }
    assert_eq!(
        StakeIngressBinding::unpack(&bytes[..STAKE_INGRESS_BINDING_LEN - 1]),
        Err(StakeIngressSpecError::InvalidBinding)
    );
}

#[test]
fn rule_rejects_direct_donations_without_affecting_other_destinations() {
    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    let ordinary_destination = Pubkey::new_from_array([0x71; 32]);
    let owner = Pubkey::new_from_array([0x72; 32]);

    assert_eq!(
        enforce_stake_ingress(&binding, &MINT, &ordinary_destination, &owner),
        Ok(())
    );
    assert_eq!(
        enforce_stake_ingress(
            &binding,
            &MINT,
            &binding.stake_vault,
            &binding.ingress_authority,
        ),
        Ok(())
    );
    assert_eq!(
        enforce_stake_ingress(&binding, &MINT, &binding.stake_vault, &owner),
        Err(StakeIngressSpecError::UnauthorizedStakeIngress)
    );
    assert_eq!(
        enforce_stake_ingress(
            &binding,
            &Pubkey::new_from_array([0x73; 32]),
            &ordinary_destination,
            &owner,
        ),
        Err(StakeIngressSpecError::InvalidMint)
    );
}

#[test]
fn pinned_hook_interface_deescalates_authority_to_non_signer() {
    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    let instruction = spl_transfer_hook_interface::instruction::execute(
        &LAW_PROGRAM_ID,
        &Pubkey::new_from_array([0x74; 32]),
        &MINT,
        &binding.stake_vault,
        &binding.ingress_authority,
        1,
    );
    assert_eq!(instruction.accounts[3].pubkey, binding.ingress_authority);
    assert!(!instruction.accounts[3].is_signer);
}

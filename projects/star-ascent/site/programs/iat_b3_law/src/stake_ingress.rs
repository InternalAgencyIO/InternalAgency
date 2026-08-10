//! Immutable stake-ingress address binding and Transfer Hook admission kernel.
//!
//! This module is production source, but it is intentionally not wired into
//! [`crate::process_instruction`] until the law program, economy program, and
//! canonical mint identities are frozen. It has no initializer, update path,
//! account allocation, dispatcher opcode, or caller-provided disposition.

use solana_pubkey::Pubkey;

pub const STAKE_INGRESS_BINDING_MAGIC: &[u8; 8] = b"IATB3IG1";
pub const STAKE_INGRESS_BINDING_VERSION: u8 = 1;
pub const STAKE_INGRESS_BINDING_LEN: usize = 176;
pub const ECONOMY_CONFIG_SEED: &[u8] = b"config";
pub const ECONOMY_STAKE_TOKEN_SEED: &[u8] = b"stake-token";
pub const ECONOMY_STAKE_INGRESS_AUTHORITY_SEED: &[u8] = b"stake-ingress";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StakeIngressBindingError {
    InvalidBinding,
    InvalidMint,
    UnauthorizedStakeIngress,
}

/// Canonical immutable address facts needed by the combined Daily-Law hook.
///
/// All fields are private. Construction and decoding recompute the three PDAs
/// from one nonzero economy program ID and one nonzero mint. The representation
/// contains no administrator, mutable policy, bypass, or transfer disposition.
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
    pub fn derive(
        economy_program_id: Pubkey,
        mint: Pubkey,
    ) -> Result<Self, StakeIngressBindingError> {
        if economy_program_id == Pubkey::default() || mint == Pubkey::default() {
            return Err(StakeIngressBindingError::InvalidBinding);
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

    pub fn validate(&self) -> Result<(), StakeIngressBindingError> {
        if *self != Self::derive(self.economy_program_id, self.mint)? {
            return Err(StakeIngressBindingError::InvalidBinding);
        }
        Ok(())
    }

    pub fn pack(&self, output: &mut [u8]) -> Result<(), StakeIngressBindingError> {
        if output.len() != STAKE_INGRESS_BINDING_LEN {
            return Err(StakeIngressBindingError::InvalidBinding);
        }
        self.validate()?;

        let mut encoded = [0u8; STAKE_INGRESS_BINDING_LEN];
        encoded[0..8].copy_from_slice(STAKE_INGRESS_BINDING_MAGIC);
        encoded[8] = STAKE_INGRESS_BINDING_VERSION;
        encoded[9] = self.config_bump;
        encoded[10] = self.stake_vault_bump;
        encoded[11] = self.ingress_authority_bump;
        encoded[16..48].copy_from_slice(self.economy_program_id.as_ref());
        encoded[48..80].copy_from_slice(self.mint.as_ref());
        encoded[80..112].copy_from_slice(self.config.as_ref());
        encoded[112..144].copy_from_slice(self.stake_vault.as_ref());
        encoded[144..176].copy_from_slice(self.ingress_authority.as_ref());
        output.copy_from_slice(&encoded);
        Ok(())
    }

    pub fn unpack(input: &[u8]) -> Result<Self, StakeIngressBindingError> {
        if input.len() != STAKE_INGRESS_BINDING_LEN
            || input.get(0..8) != Some(STAKE_INGRESS_BINDING_MAGIC)
            || input[8] != STAKE_INGRESS_BINDING_VERSION
            || input[12..16].iter().any(|byte| *byte != 0)
        {
            return Err(StakeIngressBindingError::InvalidBinding);
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

    pub const fn economy_program_id(&self) -> Pubkey {
        self.economy_program_id
    }

    pub const fn mint(&self) -> Pubkey {
        self.mint
    }

    pub const fn config(&self) -> Pubkey {
        self.config
    }

    pub const fn stake_vault(&self) -> Pubkey {
        self.stake_vault
    }

    pub const fn ingress_authority(&self) -> Pubkey {
        self.ingress_authority
    }
}

/// Enforce only the immutable stake-vault admission rule.
///
/// The combined hook must call this after its existing Token-2022 ownership,
/// transfer-context, validation-PDA, law-state, decision-integrity, current-day,
/// and open-day checks. Token-2022 deliberately de-escalates the authority meta
/// to a non-signer before hook execution; this rule binds its pubkey only.
pub fn enforce_stake_ingress(
    binding: &StakeIngressBinding,
    mint: &Pubkey,
    destination: &Pubkey,
    authority: &Pubkey,
) -> Result<(), StakeIngressBindingError> {
    binding.validate()?;
    if mint != &binding.mint {
        return Err(StakeIngressBindingError::InvalidMint);
    }
    if destination != &binding.stake_vault {
        return Ok(());
    }
    if authority != &binding.ingress_authority {
        return Err(StakeIngressBindingError::UnauthorizedStakeIngress);
    }
    Ok(())
}

fn copy_array(input: &[u8]) -> Result<[u8; 32], StakeIngressBindingError> {
    input
        .try_into()
        .map_err(|_| StakeIngressBindingError::InvalidBinding)
}

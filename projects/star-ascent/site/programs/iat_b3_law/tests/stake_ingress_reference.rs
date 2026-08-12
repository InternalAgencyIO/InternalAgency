#![forbid(unsafe_code)]

#[path = "../src/stake_ingress.rs"]
mod stake_ingress;

use solana_pubkey::Pubkey;
use stake_ingress::{
    enforce_stake_ingress, StakeIngressBinding, StakeIngressBindingError, STAKE_INGRESS_BINDING_LEN,
};

const LAW_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xB3; 32]);
const ECONOMY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0xE3; 32]);
const MINT: Pubkey = Pubkey::new_from_array([0x22; 32]);

#[test]
fn binding_round_trip_is_canonical_and_address_specific() {
    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    assert_eq!(binding.validate(), Ok(()));
    assert_eq!(binding.economy_program_id(), ECONOMY_PROGRAM_ID);
    assert_eq!(binding.mint(), MINT);
    assert_ne!(binding.config(), binding.stake_vault());
    assert_ne!(binding.stake_vault(), binding.ingress_authority());

    let mut bytes = [0u8; STAKE_INGRESS_BINDING_LEN];
    binding.pack(&mut bytes).unwrap();
    assert_eq!(StakeIngressBinding::unpack(&bytes), Ok(binding));

    let other_mint =
        StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, Pubkey::new_from_array([0x23; 32]))
            .unwrap();
    let other_program =
        StakeIngressBinding::derive(Pubkey::new_from_array([0xE4; 32]), MINT).unwrap();
    assert_ne!(binding.config(), other_mint.config());
    assert_ne!(binding.config(), other_program.config());
    assert_ne!(binding.stake_vault(), other_mint.stake_vault());
    assert_ne!(
        binding.ingress_authority(),
        other_program.ingress_authority()
    );
}

#[test]
fn codec_rejects_zero_identities_forgery_and_noncanonical_bytes() {
    assert_eq!(
        StakeIngressBinding::derive(Pubkey::default(), MINT),
        Err(StakeIngressBindingError::InvalidBinding)
    );
    assert_eq!(
        StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, Pubkey::default()),
        Err(StakeIngressBindingError::InvalidBinding)
    );

    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    let mut bytes = [0u8; STAKE_INGRESS_BINDING_LEN];
    binding.pack(&mut bytes).unwrap();

    for index in [8usize, 12, 112, 144] {
        let mut corrupt = bytes;
        corrupt[index] ^= 1;
        assert_eq!(
            StakeIngressBinding::unpack(&corrupt),
            Err(StakeIngressBindingError::InvalidBinding),
            "byte {index} must be covered by canonical validation"
        );
    }
    assert_eq!(
        StakeIngressBinding::unpack(&bytes[..STAKE_INGRESS_BINDING_LEN - 1]),
        Err(StakeIngressBindingError::InvalidBinding)
    );
}

#[test]
fn pack_is_transactional_on_every_failure() {
    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    let mut short = [0xA5; STAKE_INGRESS_BINDING_LEN - 1];
    let before = short;
    assert_eq!(
        binding.pack(&mut short),
        Err(StakeIngressBindingError::InvalidBinding)
    );
    assert_eq!(short, before);
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
            &binding.stake_vault(),
            &binding.ingress_authority(),
        ),
        Ok(())
    );
    assert_eq!(
        enforce_stake_ingress(&binding, &MINT, &binding.stake_vault(), &owner),
        Err(StakeIngressBindingError::UnauthorizedStakeIngress)
    );
    assert_eq!(
        enforce_stake_ingress(
            &binding,
            &Pubkey::new_from_array([0x73; 32]),
            &ordinary_destination,
            &owner,
        ),
        Err(StakeIngressBindingError::InvalidMint)
    );
}

#[test]
fn wrong_authority_is_rejected_for_only_the_exact_canonical_vault() {
    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    let wrong_authority = Pubkey::new_from_array([0x81; 32]);
    let adjacent_destination = Pubkey::new_from_array([0x82; 32]);

    assert_eq!(
        enforce_stake_ingress(&binding, &MINT, &binding.stake_vault(), &wrong_authority,),
        Err(StakeIngressBindingError::UnauthorizedStakeIngress)
    );
    assert_eq!(
        enforce_stake_ingress(&binding, &MINT, &adjacent_destination, &wrong_authority),
        Ok(())
    );
}

#[test]
fn pinned_hook_interface_deescalates_authority_to_non_signer() {
    let binding = StakeIngressBinding::derive(ECONOMY_PROGRAM_ID, MINT).unwrap();
    let instruction = spl_transfer_hook_interface::instruction::execute(
        &LAW_PROGRAM_ID,
        &Pubkey::new_from_array([0x74; 32]),
        &MINT,
        &binding.stake_vault(),
        &binding.ingress_authority(),
        1,
    );
    assert_eq!(instruction.accounts[3].pubkey, binding.ingress_authority());
    assert!(!instruction.accounts[3].is_signer);
}

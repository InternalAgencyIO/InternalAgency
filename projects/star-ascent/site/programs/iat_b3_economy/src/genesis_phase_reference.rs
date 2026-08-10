//! Non-executable reference codec for the unresolved Config/Genesis decision.
//!
//! This module is deliberately not imported by the economy crate. Integration
//! tests include it by path so reviewers can pin a canonical decision-record
//! layout without adding a Config account codec, a dispatcher, an entrypoint,
//! or any production authorization surface.
//!
//! A nonzero binding means only that an opaque review artifact was referenced.
//! It does not authenticate that artifact, prove owner acceptance, prove an
//! account or PDA, or authorize a phase transition. Consequently every
//! assessment produced here remains an unconditional Mainnet HOLD, including
//! an assessment whose twelve bindings are all nonzero.

pub const GENESIS_PHASE_REFERENCE_MAGIC: [u8; 8] = *b"IATB3GDR";
pub const GENESIS_PHASE_REFERENCE_VERSION: u8 = 1;
pub const GENESIS_PHASE_REFERENCE_LEN: usize = 416;

pub const DAILY_LAW_BINDING: u16 = 1 << 0;
pub const V2_FEATURE_PARITY_BINDING: u16 = 1 << 1;
pub const EXACT_PHASE_RULE_BINDING: u16 = 1 << 2;
pub const CORE_CUSTODY_BINDING: u16 = 1 << 3;
pub const FACTION_ECONOMICS_BINDING: u16 = 1 << 4;
pub const GENESIS_MANIFEST_BINDING: u16 = 1 << 5;
pub const GENESIS_CONSERVATION_BINDING: u16 = 1 << 6;
pub const PRODUCTION_IDENTITY_BINDING: u16 = 1 << 7;
pub const COMBINED_STAKE_INGRESS_BINDING: u16 = 1 << 8;
pub const TERMINAL_AUTHORITY_SEAL_BINDING: u16 = 1 << 9;
pub const NATIVE_ADAPTER_BINDING: u16 = 1 << 10;
pub const FINAL_PROGRAM_BINARY_BINDING: u16 = 1 << 11;
pub const ALL_GENESIS_BINDINGS: u16 = (1 << 12) - 1;

const HEADER_LEN: usize = 32;
const RESERVED_START: usize = 11;
const BINDING_LEN: usize = 32;

/// The already-frozen high-level phase order. This does not define a Config
/// account field or the still-unresolved transition predicate.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenesisPhase {
    Uninitialized,
    GenesisStaging,
    Active,
}

impl GenesisPhase {
    const fn byte(self) -> u8 {
        match self {
            Self::Uninitialized => 0,
            Self::GenesisStaging => 1,
            Self::Active => 2,
        }
    }

    fn from_byte(value: u8) -> Result<Self, GenesisPhaseReferenceCodecError> {
        match value {
            0 => Ok(Self::Uninitialized),
            1 => Ok(Self::GenesisStaging),
            2 => Ok(Self::Active),
            _ => Err(GenesisPhaseReferenceCodecError::NonCanonicalPhase),
        }
    }
}

/// Opaque digests of review artifacts needed before the Config/Genesis rule
/// can be frozen. None of these bytes carry trust or acceptance semantics.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisPhaseReference {
    pub current_phase: GenesisPhase,
    pub requested_phase: GenesisPhase,
    pub current_open_daily_law: [u8; BINDING_LEN],
    pub v2_feature_parity: [u8; BINDING_LEN],
    pub exact_phase_rule: [u8; BINDING_LEN],
    pub core_custody: [u8; BINDING_LEN],
    pub faction_economics_and_funding: [u8; BINDING_LEN],
    pub genesis_allocation_manifest: [u8; BINDING_LEN],
    pub genesis_conservation: [u8; BINDING_LEN],
    pub production_identity_freeze: [u8; BINDING_LEN],
    pub combined_stake_ingress_binary: [u8; BINDING_LEN],
    pub terminal_authority_seal: [u8; BINDING_LEN],
    pub native_account_adapter: [u8; BINDING_LEN],
    pub final_program_binary: [u8; BINDING_LEN],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenesisPhaseReferenceCodecError {
    InvalidLength,
    WrongTypeMagic,
    UnsupportedVersion,
    ReservedBytesNonZero,
    NonCanonicalPhase,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GenesisPhaseAssessmentError {
    NonCanonicalTransition,
    CurrentOpenDailyLawReferenceMissing,
}

/// A structural inventory only. Every trust and authorization field is a
/// constant fail-closed value because this reference has no owner signature,
/// canonical account adapter, executable transition, or reviewed final bytes.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct GenesisPhaseAssessment {
    pub referenced_bindings: u16,
    pub unresolved_bindings: u16,
    pub external_artifacts_authenticated: bool,
    pub owner_policy_accepted: bool,
    pub genesis_conservation_proved: bool,
    pub config_codec_frozen: bool,
    pub runtime_transition_verified: bool,
    pub transition_authorized: bool,
    pub mainnet_hold: bool,
}

/// Encode the fixed review-only envelope transactionally. This is not a
/// Config account encoder and is not usable as persistent protocol state.
pub fn encode_genesis_phase_reference(
    reference: &GenesisPhaseReference,
    output: &mut [u8],
) -> Result<(), GenesisPhaseReferenceCodecError> {
    if output.len() != GENESIS_PHASE_REFERENCE_LEN {
        return Err(GenesisPhaseReferenceCodecError::InvalidLength);
    }

    let mut encoded = [0u8; GENESIS_PHASE_REFERENCE_LEN];
    encoded[..8].copy_from_slice(&GENESIS_PHASE_REFERENCE_MAGIC);
    encoded[8] = GENESIS_PHASE_REFERENCE_VERSION;
    encoded[9] = reference.current_phase.byte();
    encoded[10] = reference.requested_phase.byte();

    let bindings = bindings(reference);
    let mut offset = HEADER_LEN;
    for binding in bindings {
        encoded[offset..offset + BINDING_LEN].copy_from_slice(binding);
        offset += BINDING_LEN;
    }
    debug_assert_eq!(offset, GENESIS_PHASE_REFERENCE_LEN);

    output.copy_from_slice(&encoded);
    Ok(())
}

/// Decode only the exact review-only envelope. Decoding confers no trust,
/// owner acceptance, phase readiness, or runtime authorization.
pub fn decode_genesis_phase_reference(
    input: &[u8],
) -> Result<GenesisPhaseReference, GenesisPhaseReferenceCodecError> {
    if input.len() != GENESIS_PHASE_REFERENCE_LEN {
        return Err(GenesisPhaseReferenceCodecError::InvalidLength);
    }
    if input[..8] != GENESIS_PHASE_REFERENCE_MAGIC {
        return Err(GenesisPhaseReferenceCodecError::WrongTypeMagic);
    }
    if input[8] != GENESIS_PHASE_REFERENCE_VERSION {
        return Err(GenesisPhaseReferenceCodecError::UnsupportedVersion);
    }
    if input[RESERVED_START..HEADER_LEN]
        .iter()
        .any(|byte| *byte != 0)
    {
        return Err(GenesisPhaseReferenceCodecError::ReservedBytesNonZero);
    }

    let current_phase = GenesisPhase::from_byte(input[9])?;
    let requested_phase = GenesisPhase::from_byte(input[10])?;
    let mut offset = HEADER_LEN;
    let current_open_daily_law = read_binding(input, &mut offset);
    let v2_feature_parity = read_binding(input, &mut offset);
    let exact_phase_rule = read_binding(input, &mut offset);
    let core_custody = read_binding(input, &mut offset);
    let faction_economics_and_funding = read_binding(input, &mut offset);
    let genesis_allocation_manifest = read_binding(input, &mut offset);
    let genesis_conservation = read_binding(input, &mut offset);
    let production_identity_freeze = read_binding(input, &mut offset);
    let combined_stake_ingress_binary = read_binding(input, &mut offset);
    let terminal_authority_seal = read_binding(input, &mut offset);
    let native_account_adapter = read_binding(input, &mut offset);
    let final_program_binary = read_binding(input, &mut offset);
    debug_assert_eq!(offset, GENESIS_PHASE_REFERENCE_LEN);

    Ok(GenesisPhaseReference {
        current_phase,
        requested_phase,
        current_open_daily_law,
        v2_feature_parity,
        exact_phase_rule,
        core_custody,
        faction_economics_and_funding,
        genesis_allocation_manifest,
        genesis_conservation,
        production_identity_freeze,
        combined_stake_ingress_binary,
        terminal_authority_seal,
        native_account_adapter,
        final_program_binary,
    })
}

/// Inventory unresolved review bindings for one of the two already-frozen
/// high-level edges. Activation checks the current-open Daily Law reference
/// before inspecting any later dependency. A successful assessment is still
/// an unconditional HOLD and exposes no phase mutation.
pub fn assess_genesis_phase_reference(
    reference: &GenesisPhaseReference,
) -> Result<GenesisPhaseAssessment, GenesisPhaseAssessmentError> {
    match (reference.current_phase, reference.requested_phase) {
        (GenesisPhase::Uninitialized, GenesisPhase::GenesisStaging) => {}
        (GenesisPhase::GenesisStaging, GenesisPhase::Active) => {
            if is_zero(&reference.current_open_daily_law) {
                return Err(GenesisPhaseAssessmentError::CurrentOpenDailyLawReferenceMissing);
            }
        }
        _ => return Err(GenesisPhaseAssessmentError::NonCanonicalTransition),
    }

    let mut referenced_bindings = 0u16;
    for (index, binding) in bindings(reference).iter().enumerate() {
        if !is_zero(binding) {
            referenced_bindings |= 1u16 << index;
        }
    }

    Ok(GenesisPhaseAssessment {
        referenced_bindings,
        unresolved_bindings: ALL_GENESIS_BINDINGS & !referenced_bindings,
        external_artifacts_authenticated: false,
        owner_policy_accepted: false,
        genesis_conservation_proved: false,
        config_codec_frozen: false,
        runtime_transition_verified: false,
        transition_authorized: false,
        mainnet_hold: true,
    })
}

fn bindings(reference: &GenesisPhaseReference) -> [&[u8; BINDING_LEN]; 12] {
    [
        &reference.current_open_daily_law,
        &reference.v2_feature_parity,
        &reference.exact_phase_rule,
        &reference.core_custody,
        &reference.faction_economics_and_funding,
        &reference.genesis_allocation_manifest,
        &reference.genesis_conservation,
        &reference.production_identity_freeze,
        &reference.combined_stake_ingress_binary,
        &reference.terminal_authority_seal,
        &reference.native_account_adapter,
        &reference.final_program_binary,
    ]
}

fn read_binding(input: &[u8], offset: &mut usize) -> [u8; BINDING_LEN] {
    let mut binding = [0u8; BINDING_LEN];
    binding.copy_from_slice(&input[*offset..*offset + BINDING_LEN]);
    *offset += BINDING_LEN;
    binding
}

fn is_zero(binding: &[u8; BINDING_LEN]) -> bool {
    binding.iter().all(|byte| *byte == 0)
}

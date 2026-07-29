# Security Policy

**Classification:** Internal Use — Security Sensitive  
**Organization:** Internal Agency  
**Location:** REDACTED  
**Policy owner:** Internal Agency  
**Approved by:** Internal Agency  
**Effective date:** REDACTED  
**Review cycle:** At least annually and after any material security incident or regulatory change  
**Version:** 2.0  
**Sole abuse and security contact:** root@internalagency.io  
**Telephone contact:** Prohibited

## 1. Purpose

This policy defines the minimum security requirements for agency personnel, systems, applications, repositories, and information. Its purpose is to protect agency operations and data against unauthorized access, disclosure, alteration, loss, and disruption.

## 2. Scope

This policy applies to:

- All employees, contractors, interns, temporary staff, vendors, and other authorized users;
- All agency-managed or agency-connected devices, networks, cloud services, applications, source-code repositories, and collaboration platforms;
- All information created, received, stored, processed, or transmitted on behalf of the agency; and
- Personal devices or third-party services used for agency business where explicitly authorized.

More restrictive legal, contractual, regulatory, or client requirements take precedence over this policy.

## 3. Security Responsibilities

Security is a shared responsibility.

- **All users** must follow this policy, complete required training, protect credentials and devices, and promptly report suspected security events.
- **Managers and system owners** must approve access based on business need, review access regularly, and ensure that systems under their control meet agency requirements.
- **Information Technology (IT)** must securely configure, maintain, monitor, patch, back up, and recover agency systems.
- **The Security Team** must maintain security standards, assess risk, coordinate vulnerability management and incident response, and advise leadership.
- **Third parties** must meet applicable agency security requirements before receiving access to agency systems or information.

## 4. Acceptable Use

Agency systems and information may be used only for authorized agency business and limited incidental personal use permitted by agency rules.

Users must not:

- Circumvent security controls, monitoring, content filtering, or access restrictions;
- Install unapproved software, browser extensions, hardware, or cloud services;
- Use agency resources for unlawful, abusive, discriminatory, or commercial activities unrelated to agency business;
- Share agency information through personal email, consumer file-sharing services, public repositories, or other unapproved channels; or
- Conduct security testing, scanning, or exploitation without written authorization and an approved scope.

The agency may monitor and audit use of its systems to the extent permitted by applicable law and policy.

## 5. Information Classification and Handling

Information must be classified by its owner and handled according to its sensitivity.

| Classification | Description | Minimum handling requirements |
| --- | --- | --- |
| **Public** | Approved for public release | Verify approval before publication; protect integrity |
| **Internal** | Routine non-public agency information | Share only with authorized personnel; use approved systems |
| **Confidential** | Sensitive operational, personnel, financial, client, legal, or security information | Encrypt in transit and at rest; restrict by business need; do not place in public or personal services |
| **Restricted** | Information whose exposure could cause severe harm or trigger legal or contractual duties | Apply explicit owner approval, strongest available access controls, encryption, logging, retention limits, and approved transfer methods |

Users must:

- Collect and retain only the information needed for a defined business purpose;
- Store information only in agency-approved locations;
- Verify recipients before sending sensitive information;
- Use approved encrypted methods for transferring Confidential or Restricted information;
- Securely dispose of information and media according to the agency retention schedule; and
- Immediately report suspected loss, misdirection, or unauthorized disclosure.

Production data must not be copied into development or test environments unless explicitly approved and appropriately minimized, masked, or anonymized.

## 6. Identity and Access Management

- Every user must have a unique account; shared user accounts are prohibited unless technically necessary, documented, and approved.
- Access must follow least privilege and be granted only for a current business need.
- Multi-factor authentication (MFA) is required for remote access, privileged access, cloud services, source-code repositories, and systems containing Confidential or Restricted information.
- Privileged activities must use separate administrative accounts where supported.
- Passwords must meet the agency password standard and must not be reused across agency and personal services.
- Credentials, authentication tokens, recovery codes, and private keys must not be shared or stored in plaintext.
- Access must be reviewed at least quarterly for privileged and sensitive systems and at least annually for all other systems.
- Access must be removed promptly when employment or engagement ends and adjusted promptly when responsibilities change.

## 7. Devices, Networks, and Remote Work

Only approved and properly managed devices may access agency systems or store agency information.

Agency-managed devices must:

- Use supported operating systems and approved software;
- Enable full-disk encryption, screen locking, endpoint protection, and host firewall controls;
- Install security updates within agency-defined timeframes;
- Prevent unapproved users from gaining local administrative access; and
- Be reported immediately if lost, stolen, or suspected to be compromised.

Remote access must use approved secure access methods. Users must protect screens and conversations from unauthorized observation, avoid untrusted public workstations, and use agency-approved connectivity controls on untrusted networks.

Removable media must be approved, encrypted when carrying non-public information, and scanned before use.

## 8. Secure Development and Change Management

Agency software, automation, infrastructure, and configuration changes must follow a documented development and change-management process.

At a minimum:

- Security requirements must be considered during design and planning;
- Changes must be peer-reviewed and tested before production deployment;
- Branch protections and required reviews must be enabled for critical repositories;
- Automated security checks should include dependency, secret, static-analysis, and infrastructure-configuration scanning where applicable;
- Production access and deployment permissions must be limited and logged;
- Development, test, and production environments must be appropriately separated;
- Security-relevant changes and emergency changes must be documented; and
- Unsupported components and known vulnerable dependencies must be removed, upgraded, mitigated, or formally accepted as risk.

Code and technical documentation created for agency business must be stored in agency-approved repositories.

## 9. Secrets and Cryptographic Material

Passwords, API keys, tokens, certificates, private keys, and other secrets must:

- Be generated and stored using approved password managers, secret managers, or key-management systems;
- Never be committed to source control, embedded in code, included in tickets, or sent through unapproved messaging channels;
- Be scoped to the minimum required permissions and environment;
- Be rotated on a defined schedule and immediately after suspected exposure; and
- Be revoked when no longer required.

Suspected secret exposure must be treated as a security incident. Removing a secret from the latest code revision alone is not sufficient; the secret must be revoked or rotated.

## 10. Cloud Services, AI Tools, and Third Parties

Only agency-approved cloud services, software-as-a-service platforms, artificial intelligence tools, and vendors may process agency information.

Before use, the responsible owner must assess:

- Data classification and permitted data use;
- Access controls, MFA, encryption, logging, retention, deletion, and data residency;
- Contractual confidentiality, breach-notification, and subcontractor terms;
- Regulatory, client, intellectual-property, and records-management obligations; and
- The provider's security posture and business-continuity capabilities.

Confidential or Restricted information, personal data, credentials, unpublished client work, and proprietary source code must not be submitted to public or unapproved AI systems. AI-generated output must be reviewed by a qualified person for accuracy, security, confidentiality, intellectual-property concerns, and inappropriate disclosure before use.

Third-party access must be time-bound where possible, limited to approved purposes, monitored, and removed when no longer required.

## 11. Vulnerability Management

The agency will identify and remediate vulnerabilities based on risk, exploitability, exposure, affected information, and operational impact.

Unless a stricter requirement applies, target remediation times begin when a vulnerability is validated:

| Severity | Target |
| --- | --- |
| **Critical** | Mitigate immediately; remediate within 7 calendar days |
| **High** | Remediate within 30 calendar days |
| **Medium** | Remediate within 90 calendar days |
| **Low** | Remediate through normal maintenance or within 180 calendar days |

Active exploitation, internet exposure, or material business impact may require faster action. Exceptions must be documented, approved by the system owner and Security Team, include compensating controls, and have an expiration date.

## 12. Reporting Security Concerns

Personnel must report suspected or confirmed security concerns immediately, including:

- Phishing, malware, unexpected MFA prompts, or suspicious account activity;
- Lost or stolen devices;
- Misdirected messages or unauthorized disclosure;
- Exposed credentials, secrets, or sensitive repositories;
- Suspected fraud, insider threat, or unauthorized access; and
- Vulnerabilities affecting agency systems or services.

Report concerns through:

- **Sole authorized abuse and security contact:** root@internalagency.io

All abuse reports, vulnerability reports, urgent security reports, and suspected incident notifications must be sent only to `root@internalagency.io`. Internal Agency does not publish, maintain, or accept telephone contacts. No alternate external reporting address, personal account, messaging account, or social-media account is authorized to receive security reports.

Do not investigate beyond what is necessary to report the issue. Preserve relevant messages, timestamps, screenshots, and device details, and follow instructions from IT or the Security Team.

External researchers and members of the public must not receive access to internal systems for testing. Any unsolicited external vulnerability report must be forwarded to the Security Team. Public disclosure, customer notification, law-enforcement contact, and regulatory reporting may be made only by authorized agency representatives.

Good-faith internal reporting is encouraged. Retaliation against a person who reports a concern in good faith is prohibited.

## 13. Incident Response

The agency will maintain and test an incident-response process covering preparation, identification, containment, eradication, recovery, communication, evidence preservation, and lessons learned.

During a suspected incident:

1. Report it immediately using the approved channel.
2. Do not delete files, wipe devices, reset systems, contact a suspected attacker, or communicate externally unless directed.
3. If safe to do so, stop active disclosure without destroying evidence, such as by disconnecting a network cable or pausing a transfer.
4. Follow instructions from the designated incident lead.

Only authorized personnel may communicate about an incident with clients, the public, regulators, insurers, law enforcement, or the media.

## 14. Logging, Monitoring, Backup, and Recovery

Systems must generate and retain security-relevant logs appropriate to their risk, including authentication, privileged activity, administrative changes, and access to sensitive information. Logs must be protected against unauthorized access and alteration.

The agency may monitor systems, accounts, network activity, and stored information for security, operational, compliance, and investigative purposes, subject to applicable law.

Critical systems and data must be backed up according to documented recovery requirements. Backups must be protected, periodically tested, and sufficiently isolated to support recovery from destructive incidents such as ransomware.

## 15. Security Awareness

All personnel must complete security and privacy training upon onboarding and at least annually thereafter. Additional role-based training is required for privileged users, developers, administrators, managers, and personnel handling sensitive information.

Users must participate in authorized security exercises and promptly apply lessons or corrective actions assigned to them.

## 16. Exceptions

Exceptions must be requested before noncompliance occurs and must include:

- The business justification;
- Systems and information affected;
- A risk assessment;
- Proposed compensating controls;
- The responsible owner; and
- A defined expiration and review date.

Exceptions require written approval from the system or information owner and the Security Team. Acceptance of significant residual risk may require executive approval.

## 17. Compliance and Enforcement

Violations may result in removal of access, disciplinary action, contract remedies, or legal action, consistent with applicable law and agency policy.

The agency may audit compliance and require remediation. Suspected violations will be handled fairly, confidentially, and in coordination with appropriate management, Human Resources, Legal, Privacy, and other authorized functions.

## 18. Related Standards and Procedures

This policy should be supported by agency-specific standards and procedures, including:

- Acceptable use and remote-work standards;
- Data classification, retention, and secure-disposal procedures;
- Identity, password, MFA, and privileged-access standards;
- Secure configuration, patching, and vulnerability-management standards;
- Secure development and change-management procedures;
- Incident-response and business-continuity plans;
- Third-party risk-management procedures; and
- Privacy and records-management policies.

## 19. Review and Maintenance

The Policy Owner must review this policy at least annually and after significant changes to agency operations, technology, law, contractual obligations, threat conditions, or incident findings.

Material changes require approval by the designated Approving Authority and must be communicated to affected personnel.

## 20. Security Design Principles and Assurance

No policy, technology, or control can guarantee absolute security. The agency must use defense in depth so that the failure of one person, process, facility, supplier, or technical control does not create an uncontrolled path to critical assets.

The following principles are mandatory:

- **Deny by default:** Access, network paths, integrations, and data sharing must be disabled unless explicitly authorized.
- **Least privilege and least functionality:** Users, services, devices, applications, and facilities receive only the access and capabilities required for their current duties.
- **Need to know:** A valid clearance, employment relationship, or system account does not by itself establish a need to access specific information.
- **Separation of duties:** No single person should be able to initiate, approve, and conceal a sensitive action.
- **Two-person control:** High-consequence actions require independent confirmation by two authorized people.
- **Zero implicit trust:** Identity, device posture, context, and authorization must be evaluated before access and re-evaluated during sensitive sessions.
- **Fail securely:** When a security dependency fails, the system must move to a documented safe state instead of silently granting access or bypassing validation.
- **Assume compromise:** Critical systems must be designed to limit blast radius, detect lateral movement, and permit recovery even when credentials or endpoints are compromised.
- **Minimize and compartmentalize:** Sensitive data, cryptographic keys, administrative functions, and mission-critical workflows must be separated by role, environment, system, and security zone.
- **Verify independently:** High-risk instructions, identity claims, payment changes, data transfers, and emergency requests must be confirmed through a separate trusted channel.
- **Preserve evidence:** Security controls and responders must protect relevant logs, records, and physical evidence in a forensically sound manner.
- **Recoverability:** Critical operations must have tested continuity, manual fallback, and restoration procedures.

### 20.1 Security Control Tiers

System owners must assign each system a control tier based on mission impact, data sensitivity, exposure, and threat profile:

| Tier | Typical use | Minimum expectation |
| --- | --- | --- |
| **Tier 1 — Standard** | Routine internal services with limited sensitive information | Baseline agency controls, MFA, managed devices, logging, patching, and backup |
| **Tier 2 — Sensitive** | Confidential data, externally accessible services, financial or personnel workflows | Tier 1 plus network segmentation, stronger monitoring, quarterly access review, security testing, and enhanced recovery |
| **Tier 3 — High Assurance** | Restricted information, high-impact decisions, privileged infrastructure, cryptographic custody, intelligence-sensitive or mission-critical operations | Tier 2 plus compartmentation, two-person control, dedicated administration paths, continuous monitoring, enhanced personnel and supplier checks where lawful, adversarial testing, and independently tested recovery |

Security Tier assignments, control implementations, accepted risks, recovery objectives, and accountable owners must be documented in the agency system register. A lower tier may not be selected solely to avoid security cost or operational effort.

### 20.2 Evidence and Control Validation

Control owners must retain evidence that required controls operate as intended. Evidence may include configuration records, approval records, access reviews, scan results, test reports, restoration results, training records, and incident exercise reports.

- Tier 1 controls must be reviewed at least annually.
- Tier 2 controls must be reviewed at least semiannually.
- Tier 3 controls must be reviewed at least quarterly and independently assessed at least annually.
- Critical security controls must generate an alert when disabled, bypassed, or materially reconfigured.
- Findings must have an owner, severity, corrective action, target date, and documented closure evidence.
- Repeated or overdue high-risk findings must be escalated to executive leadership and the risk owner.

## 21. Enhanced Cybersecurity Requirements

### 21.1 Asset and Exposure Management

The agency must maintain a continuously updated inventory of:

- Hardware, virtual machines, network devices, mobile devices, operational technology, and Internet of Things devices;
- Applications, APIs, domains, certificates, cloud resources, data stores, and externally exposed services;
- Source-code repositories, software dependencies, build systems, deployment pipelines, and software artifacts;
- Service accounts, machine identities, cryptographic keys, privileged accounts, and third-party connections; and
- Owners, business purpose, security tier, data classification, support status, network location, and recovery requirements.

Unknown, unsupported, unowned, or unapproved assets must be quarantined or removed unless an accountable owner receives a time-limited exception.

Internet-facing assets must be continuously monitored for unintended exposure, expired certificates, abandoned services, default credentials, exploitable vulnerabilities, domain impersonation, and unauthorized changes. The agency must maintain a process for rapidly removing obsolete public endpoints and taking control of abandoned domains or cloud resources.

### 21.2 Secure Architecture and Network Defense

- Separate user, server, development, production, management, guest, physical-security, and high-assurance networks.
- Deny unnecessary east-west traffic and restrict administrative protocols to dedicated management paths.
- Require authenticated, encrypted connections for remote and administrative access.
- Do not expose administrative interfaces directly to the public internet.
- Apply application-aware egress controls to critical systems and alert on unusual destinations, protocols, data volumes, and beaconing behavior.
- Protect public services with appropriate denial-of-service controls, rate limiting, abuse detection, and resilient hosting.
- Use protective DNS, email authentication, malicious-content filtering, and domain-monitoring controls.
- Restrict legacy and insecure protocols. Any unavoidable use must be isolated, monitored, documented, and time-limited.
- Tier 3 systems must use dedicated privileged workstations or equivalent hardened administrative environments.
- Security appliances and identity infrastructure must be managed as Tier 3 systems.

Network diagrams and trust-boundary documentation must be current, access-controlled, and reviewed after material architectural changes.

### 21.3 Endpoint, Mobile, and Peripheral Security

- Endpoint detection and response, anti-malware, host firewall, secure boot, full-disk encryption, and automatic screen locking must be enabled on managed endpoints where technically supported.
- Users must not disable security tooling or connect unapproved peripherals.
- Privileged work must not be performed from unmanaged or personally owned devices.
- Mobile devices must use agency management controls, supported operating systems, remote-lock capability, encrypted storage, and approved application sources.
- Bluetooth, near-field communication, cameras, microphones, wireless radios, and removable storage must be disabled or restricted in designated sensitive zones.
- Charging cables, removable media, conference-room devices, and presentation adapters obtained from untrusted sources must not be connected to agency equipment.
- Suspected rogue devices, unexpected wireless networks, or unknown peripherals must be reported and left undisturbed for authorized investigation.

### 21.4 Email, Messaging, and Collaboration Security

- External messages must be clearly identifiable to recipients.
- High-risk attachment types, macros, scripts, and executable content must be blocked or isolated by default.
- Links and attachments should be inspected in a controlled environment before delivery when risk warrants.
- Automatic forwarding to external or personal accounts is prohibited.
- Sensitive channels and workspaces must restrict membership, external guests, exports, bots, and third-party integrations.
- Requests involving credentials, funds, sensitive files, access grants, or changes to trusted contact details must not be approved solely from an email or chat message.
- Lookalike domains, executive impersonation, supplier impersonation, and compromised conversation threads must be treated as active threats.

### 21.5 Application, API, and Software Supply-Chain Security

For Tier 2 and Tier 3 software:

- Maintain documented architecture, data flows, trust boundaries, abuse cases, and a current threat model.
- Validate authorization on every server-side request; client-side restrictions are not security boundaries.
- Use secure session management, input validation, output encoding, rate limiting, and anti-automation controls appropriate to the threat.
- Protect APIs with strong machine identity, scoped authorization, replay resistance where needed, schema validation, and request logging.
- Maintain a software bill of materials or equivalent dependency inventory for production releases.
- Pin or otherwise control dependencies and verify the provenance and integrity of build inputs.
- Protect source control, package registries, build runners, signing keys, deployment systems, and artifact repositories as production infrastructure.
- Require reproducible or independently verifiable build and release practices where feasible for Tier 3 systems.
- Cryptographically sign high-value releases and verify signatures before deployment.
- Prohibit direct production changes that bypass approved deployment controls except under the emergency-change procedure.
- Commission independent security testing before major releases and after material changes to authentication, authorization, cryptography, payments, or external exposure.

Dependencies with unclear ownership, suspicious maintainer changes, unexpected installation scripts, or unexplained binary content must be isolated and reviewed before use.

### 21.6 Vulnerability and Patch Operations

In addition to Section 11:

- Authenticated scanning must be used where feasible.
- Internet-facing and Tier 3 systems require continuous or at least weekly exposure assessment.
- Emergency action must be considered when credible exploitation is reported, even before a vendor patch is available.
- Mitigation may include disabling a feature, removing exposure, blocking indicators, increasing monitoring, isolating affected assets, or replacing the component.
- Security fixes must be validated after deployment.
- A vulnerability must not be closed solely because a scanner no longer detects it; the owner must verify the underlying exposure and corrective action.
- Penetration tests do not replace routine scanning, secure design, code review, or configuration assessment.

### 21.7 Detection and Security Operations

The agency must define and monitor events that could indicate:

- Account takeover, impossible travel, MFA fatigue, token theft, or privilege escalation;
- Discovery, credential access, lateral movement, persistence, command-and-control activity, or data staging;
- Unusual administrative actions, logging failures, mass access, bulk download, or unauthorized encryption;
- Security-control tampering, unexpected service creation, or changes to trusted configurations;
- Data exfiltration through web, email, cloud storage, removable media, printing, screenshots, covert channels, or approved services used in an unapproved way; and
- Abuse by insiders, suppliers, automation, artificial intelligence agents, or compromised machine identities.

Tier 3 systems require:

- Centralized, tamper-resistant logging with synchronized time;
- Detection coverage mapped to credible attack paths;
- Continuous alerting with a defined response through approved non-telephone internal systems;
- Retention sufficient for investigation and legal obligations;
- Regular threat hunting based on current agency threats; and
- Annual purple-team or equivalent adversarial validation.

Alerts must have severity criteria, response playbooks, escalation timeframes, and a named owner. Critical alerts may not depend on a single communication channel that could be unavailable during an incident.

### 21.8 Ransomware, Destructive Attack, and Recovery Resilience

- Critical data must have multiple backup copies, including at least one copy isolated from normal administrative credentials and destructive production actions.
- Backup deletion, retention changes, and recovery-key changes require heightened authorization and alerting.
- Tier 2 and Tier 3 restoration must be tested at least semiannually; Tier 3 recovery tests must include loss of identity infrastructure or administrative credentials.
- Recovery procedures must address clean-room restoration, malware persistence, compromised credentials, and validation of restored data.
- The agency must maintain offline access to essential incident contacts, system inventories, recovery instructions, and business continuity procedures.
- Critical business processes must have documented manual workarounds where feasible.

## 22. Physical Security and Authorized Physical Penetration Testing

### 22.1 Building-Wide No-Phone Rule

Phones and telephone-capable devices are prohibited everywhere inside every Internal Agency building, without exception for role, seniority, visitor status, or operational convenience. This prohibition includes:

- Mobile phones, cellular phones, smartphones, satellite phones, desk telephones, cordless phones, and Voice over Internet Protocol handsets;
- Computers, tablets, watches, headsets, vehicle systems, or other equipment configured to place or receive telephone calls;
- Personal, agency-owned, contractor-owned, visitor-owned, powered-off, damaged, or partially disassembled phones; and
- Telephone devices carried for photography, recording, authentication, testing, emergency use, or any other purpose.

Phones must be left outside the building before entry. They must not be stored in reception, lockers, vehicles located within an enclosed agency building, secure containers inside the building, or any other interior area.

No agency workflow may require a telephone call, text message, cellular authenticator, telephone-based MFA, telephone number, or telephone recovery channel. Security keys, agency-approved hardware authenticators without telephone capability, authenticated email, and approved non-telephone internal systems must be used instead.

Personnel who discover a phone inside the building must not inspect, activate, connect, unlock, move, or attempt to identify its owner unless required to remove an immediate life-safety hazard. They must secure the surrounding area and notify physical security through the approved non-telephone internal procedure.

Facility emergency and life-safety procedures must use alarms, duress controls, public-address systems that have no telephone capability, in-person response, or other approved non-telephone mechanisms. The prohibition must be disclosed before arrival to personnel, applicants, contractors, visitors, testers, delivery staff, and emergency-planning partners.

### 22.2 Physical Security Zones

Facilities must use layered zones appropriate to their risk:

1. **Public zone:** Areas open to the public with no uncontrolled path to agency workspaces.
2. **Controlled zone:** Staff areas requiring identity verification and access authorization.
3. **Restricted zone:** Sensitive work areas, records rooms, security operations, network rooms, and other limited-access spaces.
4. **High-assurance zone:** Tier 3 operations, key-management areas, highly sensitive archives, or other spaces requiring explicit need-to-enter, enhanced monitoring, and two-person control where designated.

Controls must be selected based on documented physical threat assessment and may include:

- Perimeter barriers, lighting, intrusion detection, security patrols, and monitored entry points;
- Individually assigned badges, anti-passback controls, turnstiles, mantraps, or staffed reception;
- Door-position monitoring, forced-entry alarms, tamper detection, and response procedures;
- Video monitoring with legally compliant placement, retention, access, and audit controls;
- Locked racks, cabinets, cable pathways, utility rooms, network closets, and building-control systems;
- Fire detection and suppression, environmental monitoring, redundant utilities, and emergency power;
- Duress alarms and safe procedures for reception, lone workers, and high-risk interactions; and
- Protected loading docks, mailrooms, waste storage, and delivery routes.

Emergency exits must never be obstructed or configured in a way that endangers life safety.

### 22.3 Personnel, Badges, Visitors, and Deliveries

- Personnel must display or carry agency identification as required and must not lend badges or keys.
- Tailgating and piggybacking are prohibited. Personnel should challenge unknown individuals only when safe and according to training; otherwise they must notify security.
- Lost, stolen, duplicated, or malfunctioning badges and keys must be reported immediately.
- Visitor identity and sponsor authorization must be verified before entry.
- Visitors must be logged, visibly identified, escorted when required, and limited to approved areas and times.
- Visitor badges must expire automatically and be returned or disabled at departure.
- Unannounced maintenance, delivery, inspection, law-enforcement, utility, or vendor personnel must be independently verified using a previously established authenticated email address or approved non-telephone channel.
- Deliveries must be received in designated areas and screened according to risk before entering controlled spaces.
- Access logs must be reviewed for anomalies, including repeated denied access, unusual hours, impossible movement, and access unrelated to assigned duties.

### 22.4 Sensitive Meetings and Work Areas

- Sensitive discussions may occur only in approved spaces appropriate to the information involved.
- The building-wide phone prohibition in Section 22.1 applies in every area. Smart watches without telephone capability, voice assistants, cameras, recording devices, wireless accessories, and other networked equipment must also be excluded from designated device-free areas.
- Whiteboards, flip charts, screens, prototypes, access codes, and documents must be removed or concealed before unauthorized persons enter.
- Confidential and Restricted materials must not be left unattended on desks, printers, meeting-room systems, or common-area displays.
- Windows, shared walls, ventilation paths, and public-adjacent spaces must be considered when discussing or displaying sensitive information.
- Technical surveillance countermeasure activities may be performed only by qualified, authorized specialists under Legal and Security oversight.
- Personnel must not attempt to detect, disable, retain, or analyze a suspected surveillance device unless directed by authorized responders.

### 22.5 Keys, Locks, Alarms, and Physical Security Systems

- Mechanical keys, access cards, alarm codes, override credentials, and physical-security administration privileges must be inventoried and assigned to accountable owners.
- Master keys and emergency overrides require stricter control, documented issuance, and periodic inventory.
- Locks and codes must be changed after suspected compromise, loss, unauthorized duplication, or relevant personnel separation.
- Physical access and video-management systems must be isolated from routine user networks, securely configured, patched, backed up, and monitored.
- Default credentials and remote vendor access are prohibited.
- Alarm disablement, door schedule changes, and video deletion must be logged and restricted.
- Life-safety, fire, and emergency response systems must be protected without interfering with their safety function.

### 22.6 Authorization for Physical Penetration Tests

Physical penetration testing may occur only under a signed authorization approved by the facility owner, Security Team, Legal, and other responsible authorities. The authorization must identify:

- Test purpose, sites, dates, hours, and named testers;
- In-scope and prohibited buildings, rooms, systems, personnel groups, and techniques;
- Permitted social engineering, tailgating, badge cloning, lock testing, delivery pretexts, wireless testing, and evidence collection;
- Safety restrictions, privacy restrictions, protected populations, and prohibited data;
- The `root@internalagency.io` emergency reporting address, a continuously available in-person or approved non-telephone test controller, and an immediate stop word or stop procedure;
- Deconfliction with guards, building management, law enforcement, emergency services, tenants, and critical operations;
- Handling of access devices, photographs, recordings, obtained information, and test artifacts;
- Rules for reporting discovered contraband, imminent threats, safety hazards, or unrelated unlawful activity;
- Liability, insurance, confidentiality, retention, and evidence-destruction requirements; and
- Conditions that immediately terminate the test.

Testers must carry verifiable authorization and a sealed or otherwise controlled non-telephone “get out of test” method, while still preserving the realism agreed in the rules of engagement.

### 22.7 Mandatory Safety Boundaries for Physical Tests

Unless a separately reviewed and legally authorized exercise explicitly permits it, testers must not:

- Bring real or realistic weapons, explosives, hazardous materials, illegal substances, or devices likely to trigger an emergency response;
- Threaten, restrain, touch, intimidate, blackmail, or endanger any person;
- Impersonate police, emergency responders, medical staff, regulators, or other protected authorities;
- Interfere with fire protection, emergency exits, medical care, utilities, elevators, industrial controls, or life-safety systems;
- Force doors, damage locks, cut cables, defeat safety interlocks, or cause permanent physical damage;
- Target private residences, personal family information, children, medical situations, or other protected or highly sensitive circumstances;
- Retain real credentials, personal information, client data, or Restricted information beyond what is necessary to prove the finding;
- Continue after identification by authorized personnel when the rules require the test to stop; or
- Create an uncontrolled risk of arrest, public panic, service interruption, or reputational harm.

Social-engineering exercises must minimize distress, avoid humiliation, protect employee identities in broad reporting, and measure control effectiveness rather than seek to punish individuals.

### 22.8 Conduct and Closeout of Physical Tests

- The test controller must track active testers and be able to stop the exercise immediately.
- Testers must use the least harmful technique capable of demonstrating the weakness.
- Sensitive evidence must be encrypted, access-controlled, and transferred to the agency promptly.
- Any critical exposure that creates immediate danger must be reported without waiting for the final report.
- Test artifacts, cloned badges, temporary devices, dropped media, markings, and access mechanisms must be removed or accounted for at test completion.
- The report must distinguish confirmed access from theoretical paths and include evidence, business impact, reproducible conditions, and prioritized remediation.
- Security must verify closure of critical and high findings through retest.
- Exercise details must remain need-to-know and must not be published without written approval.

## 23. Protection Against State-Sponsored, Military, and Industrial Espionage

The agency must maintain an enhanced threat model when its personnel, clients, technology, research, infrastructure, policy work, or information could be valuable to a state intelligence service, military organization, proxy group, competitor, or organized influence operation.

This section does not authorize independent intelligence gathering, surveillance of personnel, discrimination based on nationality or background, or activity outside applicable law. Counterintelligence-related actions must be coordinated with authorized Security, Legal, Human Resources, Privacy, and government liaison functions.

### 23.1 Crown Jewels and Aggregation Risk

The agency must identify information and capabilities whose theft, manipulation, or disruption would cause exceptional harm. The register must consider not only individual documents but also aggregation risk, where many lower-classification items together reveal:

- Strategy, intent, operational tempo, readiness, or resource constraints;
- Facility layouts, access patterns, travel schedules, or personnel relationships;
- Technical architecture, vulnerabilities, suppliers, cryptographic dependencies, or recovery weaknesses;
- Research direction, source networks, negotiation positions, client plans, or decision-making processes; and
- Metadata, behavioral patterns, or historical records that enable targeting or coercion.

Crown-jewel assets must be assigned Tier 3 protections, explicit owners, approved access groups, monitored data flows, and tested contingency plans.

### 23.2 Compartmentation and Need-to-Know Enforcement

- Access must be divided by mission, project, client, geography, and data sensitivity where practical.
- Broad distribution lists, inherited shared-drive access, and “all staff” repositories must not contain espionage-sensitive information.
- Cross-compartment transfers require owner approval and logging.
- Highly sensitive material must use controlled workspaces that restrict export, printing, external sharing, unmanaged access, and third-party integrations.
- Administrators who operate underlying infrastructure must not automatically receive content access.
- Emergency or break-glass access must be time-limited, alerted, reviewed, and justified after use.
- Access patterns to crown-jewel information must be monitored for unusual search, bulk collection, repeated denials, off-hours use, and access inconsistent with duties.

### 23.3 Operational Security

Personnel must not expose non-public operational details through social media, professional networking sites, conferences, public calendars, automatic out-of-office messages, fitness trackers, photographs, metadata, public code repositories, or informal conversation.

Before publication or external presentation, designated reviewers must assess whether apparently harmless details reveal sensitive information when combined with other sources.

Sensitive schedules, personnel movements, facility information, system changes, incidents, client identities, and capability gaps must be shared only through approved channels and only with those who need them.

Photographs and documents intended for release must be checked for:

- Visible badges, screens, whiteboards, keys, access readers, network equipment, or security controls;
- Embedded location, device, author, revision-history, hidden-layer, comment, or document-property metadata;
- Reflections, backgrounds, cropped content, or high-resolution detail that reveals sensitive information; and
- Names, faces, routines, relationships, and travel details that enable targeting.

### 23.4 Suspicious Approaches and Elicitation

Personnel must promptly report unusual attempts to obtain information, access, influence, or a relationship, including:

- Repeated requests outside a person's normal business need;
- Invitations, gifts, payments, consulting offers, grants, publication opportunities, or travel benefits tied to unusual access;
- Requests to move a conversation to personal accounts, encrypted personal apps, or private meetings;
- Pressure to bypass normal review, classification, visitor, procurement, hiring, or export-control processes;
- Attempts to obtain internal directories, organizational relationships, facility details, technology roadmaps, source code, samples, credentials, or unpublished work;
- Personal threats, coercion, blackmail, debt exploitation, romantic manipulation, or offers to conceal a relationship;
- Requests from purported journalists, researchers, recruiters, investors, clients, officials, or vendors whose identity or purpose cannot be independently verified; and
- Unusual interest in colleagues, travel, clearances, government relationships, military work, or access rights.

Personnel must not confront, entrap, investigate, promise cooperation, or continue the interaction to collect evidence unless directed by authorized officials. They should preserve communications and report the matter discreetly.

### 23.5 Foreign Travel and High-Risk Locations

Where lawful and proportionate to the risk, the agency must provide pre-travel briefing and post-travel reporting for travel involving sensitive work or elevated-threat locations.

Controls may include:

- Loan devices with minimum necessary data and accounts;
- Temporary credentials and rapid credential rotation after return;
- Disabling unnecessary radios, interfaces, administrative rights, and local data;
- Avoiding unknown chargers, cables, removable media, hotel business centers, public workstations, and unapproved networks;
- Keeping devices in personal control and reporting any separation, inspection, unusual behavior, or suspected tampering;
- Prohibiting discussion of sensitive work in taxis, hotels, restaurants, public areas, or unapproved meeting rooms;
- Independent verification of unexpected local contacts, transport, meeting changes, and requests for device access; and
- Inspection, isolation, reimaging, or replacement of devices before reconnecting them to agency systems.

Personnel must comply with lawful border and government directions. Legal counsel must define approved procedures for situations involving device searches, compelled disclosure, detention, or conflicting obligations.

### 23.6 Insider Risk

The agency must operate a lawful, privacy-respecting insider-risk program focused on behavior and access rather than nationality, ethnicity, political belief, or other protected characteristics.

The program must:

- Define indicators based on credible risk, such as unexplained bulk collection, repeated policy bypass, unusual access, concealment, unauthorized external transfer, or attempts to disable controls;
- Correlate technical alerts with authorized business context before drawing conclusions;
- Use limited, trained personnel and documented case-management procedures;
- Protect reporters and subjects from unnecessary disclosure;
- Require Human Resources, Legal, Privacy, and Security coordination for personnel action; and
- Distinguish malicious activity from mistakes, unclear procedures, accessibility needs, and legitimate whistleblowing.

Offboarding for high-risk roles must include prompt access removal, recovery of assets, rotation of shared secrets, review of recent activity when authorized, and reinforcement of continuing confidentiality obligations.

### 23.7 Supply-Chain and Partner Espionage Risk

- Suppliers and partners must receive only the access and information necessary for contracted work.
- High-risk suppliers must disclose relevant ownership, control, subcontractors, hosting locations, support paths, and material security dependencies where legally permissible.
- Remote vendor access must be approved, time-bound, monitored, and disabled by default.
- Hardware and software for Tier 3 use must have documented provenance and tamper-handling procedures appropriate to risk.
- Unexpected component substitutions, maintenance personnel, firmware changes, shipping routes, certificates, or support requests must be verified.
- Sensitive procurement must consider coercion, hidden remote access, counterfeit components, update-channel compromise, and concentration risk.
- Contract termination must trigger verified removal of access, return or destruction of information, and rotation of affected credentials and keys.

### 23.8 Influence, Disinformation, and Information Integrity

The agency must prepare for attempts to manipulate decisions or public trust through forged documents, leaked material, selective alteration, fabricated personas, compromised accounts, deepfakes, or coordinated amplification.

For consequential information:

- Preserve authoritative source records and cryptographic hashes or signatures where appropriate.
- Record provenance, approval history, and distribution.
- Use independent confirmation before acting on surprising, urgent, or strategically consequential material.
- Separate authenticity assessment from policy or reputational judgment.
- Maintain a communications plan for correcting false material without unnecessarily amplifying it.
- Escalate suspected influence activity to authorized leadership, Legal, Communications, and Security personnel.

## 24. Blockchain, Distributed Ledger, and Digital Asset Security

No blockchain, distributed ledger, token, smart contract, digital wallet, non-fungible token, cryptocurrency, stablecoin, decentralized application, or related service may be used for agency business without written approval from Security, Legal, Finance, Privacy, and the accountable business owner.

### 24.1 Risk Assessment and Approved Use

The proposal must document:

- The business need and why a conventional database or payment rail is insufficient;
- Whether the network is public, permissioned, or private;
- Data classification, public permanence, metadata leakage, and the inability to reliably delete on-chain data;
- Applicable financial, records, privacy, tax, procurement, anti-fraud, sanctions, and contractual requirements;
- Governance, validators, administrators, upgrade authorities, and dispute procedures;
- Consensus, finality, availability, transaction fees, congestion, censorship, and reorganization risk;
- Smart contracts, bridges, oracles, custody providers, exchanges, stablecoins, and other critical dependencies;
- Key loss, theft, coercion, insider collusion, counterparty failure, protocol failure, and recovery scenarios; and
- Exit strategy, data migration, asset recovery, and continuity if the network or provider fails.

Restricted information, personal data, credentials, private keys, secret values, or unapproved document content must never be written to a public blockchain. Hashing does not automatically make sensitive or personal data safe to publish.

### 24.2 Wallet and Private-Key Controls

- Agency-controlled assets must use approved institutional custody or an agency-controlled wallet architecture.
- Tier 3 protection applies to seed phrases, private keys, signing devices, recovery material, and custody administration.
- High-value transfers and administrative contract actions require multi-signature, multi-party computation, or an equivalent two-person control.
- Signers must be independent and must verify transaction intent, destination, network, token, amount, fees, contract method, and displayed transaction data.
- Seed phrases and private keys must never be photographed, copied into tickets or chat, stored in ordinary cloud drives, or entered into unverified devices or websites.
- Hardware wallets and signing devices must be acquired through approved channels, inventoried, tamper-checked, securely initialized, and stored separately from recovery material.
- Key backups must be geographically and administratively separated, access-controlled, tamper-evident, and tested through a documented recovery exercise.
- Key ceremonies must be witnessed, logged, and designed so no unauthorized person can reconstruct the key.
- Departures, role changes, suspected compromise, or custody-provider changes require access review and, where feasible, key or wallet migration.

### 24.3 Transaction Controls

- Address allowlists must be used where technically feasible.
- New destinations and changes to trusted addresses require independent, out-of-band verification.
- High-value transactions must begin with a test transaction where practical.
- Transaction simulation and human-readable decoding must be used before signing smart-contract interactions.
- Blind signing is prohibited except under an approved, documented exception.
- Transaction limits, velocity limits, timelocks, withdrawal delays, pause functions, and monitoring must be used where appropriate.
- No transfer may be approved solely from a QR code, copied address, email, chat message, or real-time video session.
- Personnel must verify the network and asset; similar names, wrapped assets, test networks, and address-poisoning transactions must be treated as common attack methods.
- Confirmations and settlement finality must meet the documented risk requirement before an agency process treats a transaction as complete.

### 24.4 Smart Contracts and Decentralized Applications

Before production use:

- Define invariants, privilege boundaries, upgrade paths, pause conditions, financial limits, and failure modes.
- Use established, reviewed components where suitable.
- Perform peer review, automated analysis, testing, fuzzing, and independent security audit proportional to value at risk.
- Test access control, reentrancy, arithmetic and precision, oracle manipulation, front-running, denial of service, governance capture, upgrade safety, signature replay, cross-chain messaging, and unexpected token behavior.
- Separate deployment, upgrade, treasury, pause, and oracle roles.
- Protect administrative keys with Tier 3 custody controls.
- Publish or retain verified source and deployment records appropriate to the network and confidentiality requirements.
- Establish monitoring and a tested emergency pause, migration, or containment procedure where technically possible.

An audit does not guarantee safety. Material changes require reassessment and may require a new independent audit.

### 24.5 Blockchain Incident Response

The response plan must address:

- Key compromise, malicious approval, incorrect transfer, contract exploit, oracle failure, bridge failure, chain reorganization, governance attack, provider insolvency, and fraudulent token interaction;
- Rapid revocation of token approvals and rotation or migration of keys where possible;
- Use of pause, timelock, rate-limit, and allowlist controls;
- Preservation of transaction hashes, signed data, device records, communications, and chain state;
- Immediate coordination with approved custody providers, exchanges, Legal, Finance, insurers, and authorities;
- The practical irreversibility and public visibility of many transactions; and
- Public communications and notification authority.

Personnel must not conduct unauthorized counter-hacking, asset seizure, chain interference, or payment to an attacker.

## 25. Artificial Intelligence and Machine-Learning Security

AI systems include predictive models, generative models, embedded assistants, autonomous or semi-autonomous agents, biometric systems, training pipelines, retrieval systems, and vendor features that use machine learning.

### 25.1 AI Inventory and Risk Classification

Every agency AI use must have a registered owner, purpose, model or service provider, users, data sources, integrations, decision impact, security tier, and retirement plan.

AI uses must be classified:

| AI risk class | Examples | Minimum requirement |
| --- | --- | --- |
| **Limited** | Drafting low-sensitivity text, internal productivity with no consequential action | Approved tool, data controls, user review |
| **Elevated** | Code assistance, sensitive-data analysis, external content, retrieval over internal repositories | Threat assessment, testing, logging, access controls, qualified review |
| **High impact** | Decisions affecting rights, safety, employment, finance, access, investigations, security operations, or critical services | Executive approval, Legal/Privacy review, documented human authority, independent validation, continuous monitoring, appeal or correction process |
| **Prohibited** | Unlawful surveillance, undisclosed manipulation, unauthorized impersonation, uncontrolled autonomous high-consequence action, or processing forbidden data in an unapproved service | Must not be used |

### 25.2 Data Protection for AI

- Do not enter Confidential or Restricted information into an AI service unless the specific service and use are approved for that classification.
- Verify vendor settings and contract terms concerning training, retention, human review, geographic processing, deletion, and subprocessors.
- Minimize prompts and retrieved context to the information required for the task.
- Apply access control before retrieval; an AI interface must not expose documents the requesting user could not access directly.
- Treat prompts, conversation history, embeddings, vector stores, fine-tuning data, model outputs, feedback, and telemetry as agency data.
- Remove or protect secrets, personal data, privileged material, and malicious instructions from training and retrieval sources.
- Maintain provenance and lawful-use records for training, fine-tuning, and evaluation datasets.
- Do not assume de-identification is irreversible; assess linkage and re-identification risk.

### 25.3 AI Threats and Required Controls

AI designs must consider:

- Prompt injection and indirect instructions embedded in documents, websites, images, audio, code, tool output, or retrieved content;
- Data poisoning, retrieval poisoning, backdoors, adversarial examples, and malicious fine-tuning;
- Model extraction, membership inference, training-data leakage, and sensitive memorization;
- Hallucinated facts, citations, identities, permissions, commands, dependencies, and security advice;
- Insecure generated code, fabricated packages, unsafe infrastructure changes, and license or provenance issues;
- Excessive agency granted to models, including tool use, browsing, file access, messaging, payment, code execution, and administrative actions;
- Model or provider compromise, silent model changes, degraded safeguards, and unavailable service;
- Output manipulation through compromised plugins, tools, connectors, agents, or external content; and
- Deepfake, impersonation, influence, fraud, and automated social engineering.

Required controls include:

- Treat model output and retrieved external content as untrusted input.
- Enforce authorization in deterministic systems outside the model.
- Use explicit tool allowlists, narrow permissions, parameter validation, network restrictions, spend or action limits, and sandboxing.
- Require human approval immediately before consequential external actions.
- Prevent a model from authorizing its own access, approving its own output, changing its own safeguards, or concealing its activity.
- Separate instructions, user content, retrieved content, tool output, and secrets using architectural controls rather than prompt wording alone.
- Redact secrets before model access and prevent tools from returning unnecessary secrets to the model.
- Log model version, relevant configuration, tool calls, approvals, and consequential outputs while respecting privacy and retention limits.
- Provide a tested kill switch or rapid disablement method for AI integrations and agents.

### 25.4 AI Agents and Automated Actions

AI agents must operate under a named human owner and a machine identity distinct from human accounts.

- Agent credentials must be short-lived, narrowly scoped, and stored in an approved secret manager.
- Agents must not use a human user's reusable password or MFA session.
- Write, delete, publish, send, purchase, transfer, deploy, approve, or change-access actions require explicit policy checks and, for consequential actions, human confirmation.
- High-impact actions require two-person approval or an equivalent independent control.
- Agents must have rate limits, budget limits, maximum action depth, destination restrictions, and safe termination.
- Tool results must be validated before being passed to another tool or used as authority.
- Memory and conversation state must have classification, retention, access, and deletion controls.
- Chained agents must not expand permissions beyond those granted to the initiating workflow.
- Autonomous modification of production security controls is prohibited unless explicitly designed, tested, approved, monitored, and reversible.

### 25.5 AI Testing, Red Teaming, and Monitoring

Elevated and High-impact AI systems must be tested before release and after material model, prompt, tool, data, or integration changes.

Testing must include, as applicable:

- Prompt and indirect-prompt injection;
- Unauthorized data access and cross-user leakage;
- Tool abuse, privilege escalation, unsafe command generation, and approval bypass;
- Harmful or deceptive output, fabricated evidence, and unreliable citations;
- Deepfake and impersonation resistance;
- Poisoned documents, hostile web content, malformed files, and malicious code;
- Model extraction, denial of service, cost exhaustion, and excessive resource consumption;
- Bias, performance disparity, accessibility, and failure under distribution shift; and
- Safe degradation when the model, provider, identity service, or monitoring system is unavailable.

High-impact AI requires independent validation by personnel not responsible for the original implementation. Owners must define measurable acceptance criteria, known limitations, monitoring thresholds, rollback triggers, and periodic re-evaluation.

### 25.6 Human Accountability and Output Use

- AI output is advisory unless a formally approved system design states otherwise.
- A qualified person remains accountable for decisions and external representations.
- Personnel must verify material facts, citations, calculations, code, legal interpretations, security findings, and identity claims before reliance.
- AI-generated content must be labeled when required by law, contract, agency policy, or risk of deception.
- AI must not be used to fabricate evidence, impersonate real people without authorization, conceal authorship where disclosure is required, or misrepresent agency approval.
- People affected by a High-impact decision must have an appropriate means to obtain human review and correct erroneous data where required.

## 26. Fake, Stolen, and Synthetic Identity Defense

The agency must defend against stolen identities, synthetic identities, fabricated organizations, account farms, deepfake audio and video, forged credentials, compromised trusted accounts, and AI-assisted impersonation.

### 26.1 Identity Proofing

Identity proofing must be proportionate to the requested access and must use more than one independent signal for sensitive roles or transactions.

Controls may include:

- Verification against authoritative records through approved providers;
- Validation of government or organizational credentials where lawful;
- Confirmation through a known employer, sponsor, contracting, or Human Resources contact;
- Document authenticity checks and live comparison where lawful and appropriate;
- Liveness or presence checks designed to resist replay, masks, injection, and deepfake substitution;
- Verified delivery of an activation factor through a separately established channel;
- Review of inconsistent names, addresses, dates, contact details, employment history, payment details, devices, network origins, or repeated identity attributes; and
- Enhanced review for privileged, financial, remote, supplier, executive-support, and Tier 3 roles.

No single document scan, selfie, email address, email domain, social-media profile, displayed identity, voice, face, signature image, or knowledge-based question is sufficient evidence for a high-risk identity claim.

Identity proofing must be accessible, privacy-respecting, documented, and subject to an alternative review process when automated checks fail. Protected characteristics must not be used as adverse indicators.

### 26.2 Account Creation and Lifecycle

- Every human account must map to a verified person and accountable sponsor.
- Service accounts, bots, shared mailboxes, test identities, training personas, and AI agents must be clearly labeled as non-human and assigned an owner.
- Duplicate, dormant, orphaned, anonymous, and generic accounts must be restricted and reviewed.
- Account recovery must be at least as strong as initial authentication and must not rely only on easily researched personal details.
- Changes to legal name, contact method, recovery channel, MFA device, bank details, or privileged role require re-verification appropriate to the risk.
- Newly created or recovered accounts may be subject to temporary limits and heightened monitoring.
- Personnel termination, contract end, sponsor withdrawal, or identity concern must trigger immediate lifecycle review.

### 26.3 Deepfake and Real-Time Impersonation Resistance

Personnel must assume that voice and video can be convincingly fabricated or replayed.

For high-risk requests:

- End the incoming interaction and re-establish contact through a previously trusted authenticated email address or approved non-telephone agency channel.
- Confirm through a second approved non-telephone channel controlled independently of the first.
- Verify the request with the accountable owner or designated alternate.
- Use transaction-specific facts that are not supplied by the requester and are not publicly available.
- Inspect the business context, authorization, destination, timing, and change from normal behavior.
- Require workflow approval; visual familiarity or voice recognition must never replace required controls.

Challenge phrases may support verification only when stored and exchanged securely, rotated after exposure, and combined with other controls. They must not be treated as a sole authentication factor.

Urgency, secrecy, executive status, distress, technical problems, or a request to bypass procedure increases the need for verification; it never reduces it.

### 26.4 Payment, Procurement, and Sensitive Change Fraud

The following require dual control and independent verification using previously established contact information:

- New suppliers or payment recipients;
- Changes to bank account, wallet address, payroll, tax, delivery, or remittance information;
- Unusual invoices, early-payment requests, refunds, gift cards, digital assets, or split transactions;
- Changes to privileged access, MFA, recovery methods, domain ownership, certificates, or signing keys;
- Requests for source code, personnel records, client data, legal material, credentials, or bulk exports; and
- Emergency requests purportedly from executives, clients, officials, law enforcement, vendors, or family members.

The person who enters or requests a sensitive change may not be its sole approver. Approval records must identify what was verified, by whom, through which trusted channel, and when.

### 26.5 External Organization and Supplier Verification

Before onboarding a new organization or granting sensitive access, the agency must verify:

- Legal existence, ownership, business address, domain history, and authorized representatives;
- Banking or wallet information through an independently obtained trusted contact;
- Whether contact details, certificates, invoices, and contractual records are consistent;
- The business rationale and sponsor;
- Relevant conflicts, sanctions, fraud indicators, or adverse ownership concerns through lawful approved processes; and
- The legitimacy of subcontractors and support personnel requiring access.

Free email accounts, recently registered lookalike domains, virtual offices, unverifiable personnel, copied websites, inconsistent corporate records, and pressure to bypass due diligence require enhanced review.

### 26.6 Suspected Identity Fraud Response

When identity fraud or impersonation is suspected:

1. Pause the transaction, access change, onboarding, or information release without alerting the suspected actor to investigative detail.
2. Preserve messages, headers, recordings, account identifiers, timestamps, device information, payment details, and workflow records.
3. Notify Security, Fraud, Legal, Privacy, Human Resources, or Finance as applicable.
4. Verify the legitimate person's safety and account status through a known trusted channel.
5. Revoke or suspend affected sessions, credentials, approvals, and recovery methods as authorized.
6. Review related accounts, transactions, rules, delegates, forwarding, connected applications, and recent changes.
7. Apply required notification, recovery, and evidence-handling procedures.

Personnel must not accuse, publicly identify, threaten, or attempt to trace the suspected actor independently.

## 27. Cross-Domain Exercises and Adversarial Testing

The agency must maintain a risk-based testing program covering cyber, physical, personnel, supplier, AI, identity, and information-integrity controls.

The annual exercise plan for Tier 3 operations should include:

- Tabletop exercises for ransomware, destructive attack, insider theft, state-sponsored intrusion, deepfake executive fraud, identity-provider failure, blockchain key compromise, and AI-agent misuse;
- Technical penetration tests and assumed-breach exercises;
- Physical penetration tests under Section 22;
- Social-engineering simulations with approved safeguards;
- AI red teaming and prompt-injection testing;
- Backup restoration and clean-room recovery;
- Crisis communications and decision-authority testing; and
- Exercises involving critical suppliers and relevant public authorities where appropriate.

Exercises must define objectives and success criteria in advance. Reports must identify systemic causes, detection and decision timelines, control failures, near misses, evidence gaps, and corrective actions. Lessons learned must be tracked to verified closure.

Production testing must use safeguards that prevent uncontrolled service disruption, data loss, privacy violations, or unsafe physical consequences. Destructive techniques require a separate, explicit authorization and a controlled environment.

## 28. High-Consequence Action Matrix

At minimum, the following actions require the stated protections:

| Action | Required protection |
| --- | --- |
| Grant Tier 3 or privileged access | Verified identity, owner approval, MFA, separate admin identity, logged provisioning |
| Change MFA or account recovery for a sensitive account | Strong re-verification, out-of-band confirmation, alert to prior contact method, session review |
| Export Restricted data or perform a bulk sensitive-data transfer | Owner approval, business justification, destination validation, DLP review, logging |
| Change payment or digital-wallet destination | Independent verification through a trusted non-telephone channel, dual approval, destination verification, transaction limits |
| Deploy a critical production release | Peer review, security checks, approved pipeline, signed or verified artifact, rollback plan |
| Change security monitoring, retention, or backup protection | Dual approval, change record, alerting, rollback or recovery validation |
| Use an AI agent for an external or consequential action | Named owner, scoped machine identity, policy validation, human approval, complete action log |
| Upgrade or administer a smart contract | Multi-party approval, simulated transaction, verified code and target, protected signing |
| Admit a visitor to a Restricted or High-assurance zone | Verified identity, authorized sponsor, access logging, escort or explicit unescorted approval |
| Conduct a physical or cyber penetration test | Signed authorization, rules of engagement, safety controls, controller, evidence plan |
| Release sensitive or incident-related information externally | Content owner, Legal/Privacy/Security review, authorized Communications approval |

Emergency procedures may accelerate these steps but may not silently eliminate accountability. Any emergency bypass must be logged, time-limited, independently reviewed, and reversed as soon as the emergency ends.

## 29. Mandatory Security Metrics and Executive Reporting

The Security Team must report meaningful risk and control performance to leadership at least quarterly. Metrics must not be limited to activity counts.

Reporting should include:

- Inventory coverage and unknown or unsupported assets;
- MFA, privileged-access, managed-device, encryption, and logging coverage;
- Internet exposure and critical attack-path findings;
- Vulnerability age, exploited-vulnerability response, and exception aging;
- Time to detect, contain, recover, and notify for incidents and exercises;
- Backup isolation and successful restoration results;
- Access-review completion and removal of inappropriate access;
- Phishing, impersonation, deepfake, and identity-fraud trends;
- Supplier, AI, blockchain, and physical-security risk findings;
- Tier 3 control failures and overdue corrective actions; and
- Material residual risks requiring executive acceptance or funding.

Metrics must be interpreted in context and must not create incentives to suppress reporting, downgrade findings, or close issues without effective remediation.

## 30. Policy Adoption and Assigned Responsibilities

Internal Agency must formally assign and maintain:

- The Policy Owner and Approving Authority;
- The Security Team, incident lead, and 24/7 reporting channel;
- System, information, facility, AI, blockchain, and supplier owners;
- Legal, Privacy, Human Resources, Finance, Communications, Fraud, and records-management contacts;
- Data classifications and any jurisdiction-specific handling requirements;
- Security Tier criteria and the Tier 3 system register;
- Remediation deadlines and any stricter regulatory or contractual requirements;
- Log, evidence, video, identity-proofing, and record-retention periods;
- High-risk travel and counterintelligence escalation procedures;
- Approved technology, AI, custody, identity-proofing, and communication services;
- Physical penetration-testing authorities and rules-of-engagement template;
- Exception approvers and risk-acceptance thresholds; and
- Training, exercise, audit, and independent-assessment schedules.

The agency must also issue supporting technical standards and procedures. This policy alone is not sufficient implementation evidence.

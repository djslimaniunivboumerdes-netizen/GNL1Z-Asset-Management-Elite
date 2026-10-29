# Engineering validation and sign-off checklist

This app is decision support. It is not a control system, SIS, fitness-for-service assessment, approved test procedure, lift plan, or operating authorization.

## Data and telemetry assumptions

- Equipment, P&ID, DCS, and manual metadata are static master/reference data unless a live integration is explicitly added.
- Smart Flow alarms are simulated and are labeled as simulated in the assistant context.
- No real-time plant telemetry, valve position, trip status, or operating authorization is inferred by the assistant.
- OCR/coordinate calibration and AI outputs require human verification against the current approved drawing revision.

## Pressure testing and inspection

- Recorded design/test pressures are reference values, not calculated test setpoints.
- Verify MAWP basis, code edition, design temperature, static head, test medium, gauge calibration, isolation/blinding, relief protection, and approved procedure before any test.
- Review priorities/risk tiers are screening aids derived from incomplete records; they are not probability of failure or remaining-life predictions.
- Confirm inspection intervals against the approved inspection plan, jurisdictional requirements, and competent inspector judgment.

## Lifting and rigging

- Mass × 1.5 and 70% fleet utilization are screening allowances only.
- The app does not know crane radius/configuration, boom length, rigging weight, centre of gravity, sling angles, dynamic effects, ground bearing, or manufacturer derating.
- Out-of-table loads return no recommendation. A competent person must prepare/approve the lift plan and rigging study.
- Shackle WLL references require verification against the actual manufacturer, identification, temperature, side-loading, and connection geometry.

## Insulation

- Missing service temperature returns “not assessed”; equipment type alone is not used to infer a requirement.
- Thickness/material outputs are screening candidates. Verify the approved insulation specification, vapour barrier, personnel protection, condensation risk, fire rating, and cryogenic contract requirements.

## P&ID / process review

Verify before operational use:

- [ ] Current P&ID revision and approval status for each referenced drawing
- [ ] Tag-to-equipment/instrument mapping, including duplicates and legacy tags
- [ ] Line classes, pressure ratings, materials, and insulation/tracing codes
- [ ] Normal/abnormal valve states, ESD/interlock references, and relief paths
- [ ] Operating envelope, alarm/trip setpoints, and control narratives from approved documents
- [ ] Maintenance intervals, derogations, and confirmed due dates against the approved plan
- [ ] Units, gauge/absolute pressure basis, and temperature basis
- [ ] Responsible process, inspection, rigging, and operations sign-off

## Assistant boundaries

The assistant receives bounded static context, treats context as data rather than instructions, and must defer to approved procedures for setpoints, lift plans, torque values, insulation thickness, bypasses, and operating instructions. Provider output requires human review.

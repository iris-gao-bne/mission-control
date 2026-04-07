import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const inDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

async function main() {
  // ─── Wipe ─────────────────────────────────────────────────────────────────
  await prisma.missionAssignment.deleteMany()
  await prisma.missionRequirement.deleteMany()
  await prisma.mission.deleteMany()
  await prisma.availability.deleteMany()
  await prisma.crewSkill.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organisation.deleteMany()

  const pw = await bcrypt.hash('password123', 10)

  // ═══════════════════════════════════════════════════════════════════════════
  // ORG 1 — Artemis Space Agency
  // ═══════════════════════════════════════════════════════════════════════════

  const artemis = await prisma.organisation.create({ data: { name: 'Artemis Space Agency', slug: 'artemis' } })

  // ─── Skills ───────────────────────────────────────────────────────────────
  const [aEva, aOrbital, aNav, aMed, aSys, aProp] = await Promise.all([
    prisma.skill.create({ data: { name: 'EVA Operations',      category: 'Extravehicular', orgId: artemis.id } }),
    prisma.skill.create({ data: { name: 'Orbital Mechanics',   category: 'Navigation',     orgId: artemis.id } }),
    prisma.skill.create({ data: { name: 'Flight Navigation',   category: 'Navigation',     orgId: artemis.id } }),
    prisma.skill.create({ data: { name: 'Mission Medicine',    category: 'Medical',        orgId: artemis.id } }),
    prisma.skill.create({ data: { name: 'Systems Engineering', category: 'Engineering',    orgId: artemis.id } }),
    prisma.skill.create({ data: { name: 'Propulsion Systems',  category: 'Engineering',    orgId: artemis.id } }),
  ])

  // ─── Users ────────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: { email: 'chen@artemis.space', password: pw, name: 'Dr. Chen Wei', role: 'DIRECTOR', orgId: artemis.id },
  })
  const aLead1 = await prisma.user.create({
    data: { email: 'hayes@artemis.space', password: pw, name: 'Sarah Hayes', role: 'MISSION_LEAD', orgId: artemis.id },
  })
  const aLead2 = await prisma.user.create({
    data: { email: 'okafor@artemis.space', password: pw, name: 'James Okafor', role: 'MISSION_LEAD', orgId: artemis.id },
  })

  const [torres, kim, reeves, morgan, patel, webb] = await Promise.all([
    prisma.user.create({ data: { email: 'torres@artemis.space',  password: pw, name: 'Alex Torres',  role: 'CREW_MEMBER', orgId: artemis.id } }),
    prisma.user.create({ data: { email: 'kim@artemis.space',     password: pw, name: 'Sam Kim',       role: 'CREW_MEMBER', orgId: artemis.id } }),
    prisma.user.create({ data: { email: 'reeves@artemis.space',  password: pw, name: 'Jordan Reeves', role: 'CREW_MEMBER', orgId: artemis.id } }),
    prisma.user.create({ data: { email: 'morgan@artemis.space',  password: pw, name: 'Casey Morgan',  role: 'CREW_MEMBER', orgId: artemis.id } }),
    prisma.user.create({ data: { email: 'patel@artemis.space',   password: pw, name: 'Priya Patel',   role: 'CREW_MEMBER', orgId: artemis.id } }),
    prisma.user.create({ data: { email: 'webb@artemis.space',    password: pw, name: 'Marcus Webb',   role: 'CREW_MEMBER', orgId: artemis.id } }),
  ])
  // Edge case: crew member with no skills — matcher must handle gracefully
  await prisma.user.create({ data: { email: 'recruit@artemis.space', password: pw, name: 'New Recruit', role: 'CREW_MEMBER', orgId: artemis.id } })

  // ─── Crew Skills ──────────────────────────────────────────────────────────
  await prisma.crewSkill.createMany({
    data: [
      // Torres: best EVA in the org, solid navigator
      { userId: torres.id, skillId: aEva.id,     proficiencyLevel: 5 },
      { userId: torres.id, skillId: aNav.id,     proficiencyLevel: 4 },
      // Kim: orbital mech + systems — good for deep missions
      { userId: kim.id,    skillId: aOrbital.id, proficiencyLevel: 4 },
      { userId: kim.id,    skillId: aSys.id,     proficiencyLevel: 3 },
      // Reeves: top medic, limited EVA — on leave (edge: unavailable for upcoming missions)
      { userId: reeves.id, skillId: aMed.id,     proficiencyLevel: 5 },
      { userId: reeves.id, skillId: aEva.id,     proficiencyLevel: 2 },
      // Morgan: top navigator + propulsion — currently on active mission
      { userId: morgan.id, skillId: aNav.id,     proficiencyLevel: 5 },
      { userId: morgan.id, skillId: aProp.id,    proficiencyLevel: 4 },
      // Patel: top systems engineer
      { userId: patel.id,  skillId: aSys.id,     proficiencyLevel: 5 },
      { userId: patel.id,  skillId: aOrbital.id, proficiencyLevel: 3 },
      // Webb: propulsion + EVA — currently on active mission
      { userId: webb.id,   skillId: aProp.id,    proficiencyLevel: 4 },
      { userId: webb.id,   skillId: aEva.id,     proficiencyLevel: 3 },
      // recruit has no skills — intentional edge case
    ],
  })

  // ─── Availability (blackout windows) ──────────────────────────────────────
  // Reeves on leave — overlaps with SUBMITTED and APPROVED missions (edge: matcher must exclude)
  await prisma.availability.create({
    data: { userId: reeves.id, startDate: inDays(5), endDate: inDays(35), reason: 'Annual Leave' },
  })

  // ─── Missions ─────────────────────────────────────────────────────────────

  // DRAFT — no requirements yet, just created
  await prisma.mission.create({
    data: {
      name: 'Lunar Gateway Alpha',
      description: 'Initial assessment for Lunar Gateway construction phase. Requirements TBD.',
      startDate: inDays(90),
      endDate: inDays(110),
      status: 'DRAFT',
      orgId: artemis.id,
      createdById: aLead1.id,
    },
  })

  // SUBMITTED — has requirements, awaiting director approval
  //   Edge: headcount 2 for EVA but Reeves (only other EVA-capable) is on leave
  //         Torres (EVA 5) is the only safe pick — tests partial-match scenario
  const mDebris = await prisma.mission.create({
    data: {
      name: 'Orbital Debris Clearance',
      description: 'Clear debris field in LEO sector 7. High EVA demand.',
      startDate: inDays(15),
      endDate: inDays(25),
      status: 'SUBMITTED',
      orgId: artemis.id,
      createdById: aLead1.id,
    },
  })
  await Promise.all([
    prisma.missionRequirement.create({ data: { missionId: mDebris.id, skillId: aEva.id, minProficiency: 4, headcount: 2 } }),
    prisma.missionRequirement.create({ data: { missionId: mDebris.id, skillId: aNav.id, minProficiency: 3, headcount: 1 } }),
  ])

  // APPROVED — waiting for crew assignment, ready to run matcher
  const mMars = await prisma.mission.create({
    data: {
      name: 'Mars Reconnaissance Prep',
      description: 'Simulation and preparation runs ahead of Mars mission.',
      startDate: inDays(60),
      endDate: inDays(80),
      status: 'APPROVED',
      orgId: artemis.id,
      createdById: aLead2.id,
    },
  })
  await Promise.all([
    prisma.missionRequirement.create({ data: { missionId: mMars.id, skillId: aNav.id,     minProficiency: 4, headcount: 1 } }),
    prisma.missionRequirement.create({ data: { missionId: mMars.id, skillId: aSys.id,     minProficiency: 3, headcount: 1 } }),
    prisma.missionRequirement.create({ data: { missionId: mMars.id, skillId: aMed.id,     minProficiency: 4, headcount: 1 } }),
  ])

  // IN_PROGRESS — Morgan and Webb are tied up (edge: matcher must account for their workload)
  const mISS = await prisma.mission.create({
    data: {
      name: 'ISS Maintenance Run',
      description: 'Routine maintenance and systems check on ISS.',
      startDate: inDays(-10),
      endDate: inDays(15),
      status: 'IN_PROGRESS',
      orgId: artemis.id,
      createdById: aLead2.id,
    },
  })
  const [reqISSNav, reqISSProp] = await Promise.all([
    prisma.missionRequirement.create({ data: { missionId: mISS.id, skillId: aNav.id,  minProficiency: 4, headcount: 1 } }),
    prisma.missionRequirement.create({ data: { missionId: mISS.id, skillId: aProp.id, minProficiency: 3, headcount: 1 } }),
  ])
  await prisma.missionAssignment.createMany({
    data: [
      { missionId: mISS.id, userId: morgan.id, missionRequirementId: reqISSNav.id },
      { missionId: mISS.id, userId: webb.id,   missionRequirementId: reqISSProp.id },
    ],
  })

  // COMPLETED — historical record with assignments
  const mSat = await prisma.mission.create({
    data: {
      name: 'Satellite Deployment X1',
      description: 'Successfully deployed comms satellite to GEO orbit.',
      startDate: inDays(-60),
      endDate: inDays(-45),
      status: 'COMPLETED',
      orgId: artemis.id,
      createdById: aLead1.id,
    },
  })
  const reqSatEva = await prisma.missionRequirement.create({
    data: { missionId: mSat.id, skillId: aEva.id, minProficiency: 3, headcount: 1 },
  })
  await prisma.missionAssignment.create({
    data: { missionId: mSat.id, userId: torres.id, missionRequirementId: reqSatEva.id },
  })

  // REJECTED — director turned it down
  await prisma.mission.create({
    data: {
      name: 'Emergency EVA Protocol Drill',
      description: 'Rejected — scheduling conflict with ISS Maintenance Run.',
      startDate: inDays(-5),
      endDate: inDays(10),
      status: 'REJECTED',
      orgId: artemis.id,
      createdById: aLead1.id,
    },
  })

  // CANCELLED — abandoned mid-planning
  await prisma.mission.create({
    data: {
      name: 'Deep Space Probe Test',
      description: 'Cancelled due to budget realignment. Requirements were never finalised.',
      startDate: inDays(30),
      endDate: inDays(40),
      status: 'CANCELLED',
      orgId: artemis.id,
      createdById: aLead2.id,
    },
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // ORG 2 — Helios Orbital Systems
  // ═══════════════════════════════════════════════════════════════════════════

  const helios = await prisma.organisation.create({ data: { name: 'Helios Orbital Systems', slug: 'helios' } })

  // ─── Skills ───────────────────────────────────────────────────────────────
  const [hSolar, hComms, hPsych, hThermal, hEva, hRobotics] = await Promise.all([
    prisma.skill.create({ data: { name: 'Solar Array Engineering', category: 'Engineering',    orgId: helios.id } }),
    prisma.skill.create({ data: { name: 'Communications Systems',  category: 'Engineering',    orgId: helios.id } }),
    prisma.skill.create({ data: { name: 'Crew Psychology',         category: 'Medical',        orgId: helios.id } }),
    prisma.skill.create({ data: { name: 'Thermal Management',      category: 'Engineering',    orgId: helios.id } }),
    prisma.skill.create({ data: { name: 'EVA Operations',          category: 'Extravehicular', orgId: helios.id } }),
    prisma.skill.create({ data: { name: 'Robotics',                category: 'Engineering',    orgId: helios.id } }),
  ])

  // ─── Users ────────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: { email: 'director@helios.orbital', password: pw, name: 'Amara Osei', role: 'DIRECTOR', orgId: helios.id },
  })
  const hLead1 = await prisma.user.create({
    data: { email: 'fischer@helios.orbital', password: pw, name: 'Erik Fischer', role: 'MISSION_LEAD', orgId: helios.id },
  })
  const hLead2 = await prisma.user.create({
    data: { email: 'nakamura@helios.orbital', password: pw, name: 'Yuki Nakamura', role: 'MISSION_LEAD', orgId: helios.id },
  })

  const [brandt, hassan, tanaka, ramirez, walsh, alrashid, johansson] = await Promise.all([
    prisma.user.create({ data: { email: 'brandt@helios.orbital',    password: pw, name: 'Lena Brandt',     role: 'CREW_MEMBER', orgId: helios.id } }),
    prisma.user.create({ data: { email: 'hassan@helios.orbital',    password: pw, name: 'Omar Hassan',     role: 'CREW_MEMBER', orgId: helios.id } }),
    prisma.user.create({ data: { email: 'tanaka@helios.orbital',    password: pw, name: 'Yuki Tanaka',     role: 'CREW_MEMBER', orgId: helios.id } }),
    prisma.user.create({ data: { email: 'ramirez@helios.orbital',   password: pw, name: 'Diego Ramirez',   role: 'CREW_MEMBER', orgId: helios.id } }),
    prisma.user.create({ data: { email: 'walsh@helios.orbital',     password: pw, name: 'Fiona Walsh',     role: 'CREW_MEMBER', orgId: helios.id } }),
    prisma.user.create({ data: { email: 'alrashid@helios.orbital',  password: pw, name: 'Ahmed Al-Rashid', role: 'CREW_MEMBER', orgId: helios.id } }),
    // Edge: Johansson is the only Comms L5 — but she'll be on medical leave
    prisma.user.create({ data: { email: 'johansson@helios.orbital', password: pw, name: 'Mia Johansson',   role: 'CREW_MEMBER', orgId: helios.id } }),
  ])

  // ─── Crew Skills ──────────────────────────────────────────────────────────
  await prisma.crewSkill.createMany({
    data: [
      { userId: brandt.id,    skillId: hSolar.id,    proficiencyLevel: 5 },
      { userId: brandt.id,    skillId: hThermal.id,  proficiencyLevel: 4 },
      { userId: hassan.id,    skillId: hComms.id,    proficiencyLevel: 4 },
      { userId: hassan.id,    skillId: hPsych.id,    proficiencyLevel: 3 },
      { userId: tanaka.id,    skillId: hEva.id,      proficiencyLevel: 5 },
      { userId: tanaka.id,    skillId: hRobotics.id, proficiencyLevel: 4 },
      { userId: ramirez.id,   skillId: hThermal.id,  proficiencyLevel: 5 },
      { userId: ramirez.id,   skillId: hSolar.id,    proficiencyLevel: 3 },
      { userId: walsh.id,     skillId: hRobotics.id, proficiencyLevel: 5 },
      { userId: walsh.id,     skillId: hComms.id,    proficiencyLevel: 3 },
      { userId: alrashid.id,  skillId: hPsych.id,    proficiencyLevel: 4 },
      { userId: alrashid.id,  skillId: hEva.id,      proficiencyLevel: 2 },
      { userId: johansson.id, skillId: hComms.id,    proficiencyLevel: 5 },
      { userId: johansson.id, skillId: hThermal.id,  proficiencyLevel: 3 },
    ],
  })

  // ─── Availability ─────────────────────────────────────────────────────────
  // Johansson on medical leave — she's the only Comms L5, making one mission unmatchable
  await prisma.availability.create({
    data: { userId: johansson.id, startDate: inDays(10), endDate: inDays(50), reason: 'Medical Leave' },
  })
  // Al-Rashid has a training block — overlaps with Crew Rotation mission window
  await prisma.availability.create({
    data: { userId: alrashid.id, startDate: inDays(20), endDate: inDays(35), reason: 'Training Exercise' },
  })

  // ─── Missions ─────────────────────────────────────────────────────────────

  // DRAFT
  await prisma.mission.create({
    data: {
      name: 'Solar Array Retrofit',
      description: 'Retrofit ageing solar panels on platform H-7. Requirements under review.',
      startDate: inDays(70),
      endDate: inDays(85),
      status: 'DRAFT',
      orgId: helios.id,
      createdById: hLead1.id,
    },
  })

  // SUBMITTED — requires Comms L5 (only Johansson) but she's on medical leave
  //   Edge: unmatchable requirement — tests matcher's "no valid candidate" path
  const mRelay = await prisma.mission.create({
    data: {
      name: 'Geosynchronous Relay Repair',
      description: 'Emergency repair of relay satellite in GEO.',
      startDate: inDays(20),
      endDate: inDays(28),
      status: 'SUBMITTED',
      orgId: helios.id,
      createdById: hLead1.id,
    },
  })
  await Promise.all([
    prisma.missionRequirement.create({ data: { missionId: mRelay.id, skillId: hComms.id, minProficiency: 5, headcount: 1 } }),
    prisma.missionRequirement.create({ data: { missionId: mRelay.id, skillId: hEva.id,   minProficiency: 4, headcount: 1 } }),
  ])

  // APPROVED — ready for matcher; Al-Rashid (Psych L4) blocked by training leave in this window
  const mRotation = await prisma.mission.create({
    data: {
      name: 'Crew Rotation Alpha',
      description: 'Scheduled crew rotation with psychological evaluation.',
      startDate: inDays(25),
      endDate: inDays(33),
      status: 'APPROVED',
      orgId: helios.id,
      createdById: hLead2.id,
    },
  })
  await Promise.all([
    prisma.missionRequirement.create({ data: { missionId: mRotation.id, skillId: hPsych.id, minProficiency: 3, headcount: 1 } }),
    prisma.missionRequirement.create({ data: { missionId: mRotation.id, skillId: hComms.id, minProficiency: 3, headcount: 1 } }),
  ])

  // IN_PROGRESS — Brandt and Ramirez assigned (both have high Thermal workload)
  //   Edge: headcount 2 for same skill slot, same requirementId on both assignments
  const mThermal = await prisma.mission.create({
    data: {
      name: 'Thermal Shield Test',
      description: 'Testing new thermal shield material under operational conditions.',
      startDate: inDays(-5),
      endDate: inDays(20),
      status: 'IN_PROGRESS',
      orgId: helios.id,
      createdById: hLead2.id,
    },
  })
  const reqThermal = await prisma.missionRequirement.create({
    data: { missionId: mThermal.id, skillId: hThermal.id, minProficiency: 4, headcount: 2 },
  })
  await prisma.missionAssignment.createMany({
    data: [
      { missionId: mThermal.id, userId: brandt.id,  missionRequirementId: reqThermal.id },
      { missionId: mThermal.id, userId: ramirez.id, missionRequirementId: reqThermal.id },
    ],
  })

  // COMPLETED — historical with full assignment chain
  const mComms = await prisma.mission.create({
    data: {
      name: 'Comms Array Upgrade',
      description: 'Upgraded communications array on orbital platform H-3.',
      startDate: inDays(-90),
      endDate: inDays(-75),
      status: 'COMPLETED',
      orgId: helios.id,
      createdById: hLead1.id,
    },
  })
  const reqCommsUpg = await prisma.missionRequirement.create({
    data: { missionId: mComms.id, skillId: hComms.id, minProficiency: 3, headcount: 2 },
  })
  await prisma.missionAssignment.createMany({
    data: [
      { missionId: mComms.id, userId: hassan.id,    missionRequirementId: reqCommsUpg.id },
      { missionId: mComms.id, userId: johansson.id, missionRequirementId: reqCommsUpg.id },
    ],
  })

  // REJECTED
  await prisma.mission.create({
    data: {
      name: 'Deep Space Robotics Trial',
      description: 'Rejected by director — resource constraints and timeline conflict with Thermal Shield Test.',
      startDate: inDays(15),
      endDate: inDays(25),
      status: 'REJECTED',
      orgId: helios.id,
      createdById: hLead1.id,
    },
  })

  // CANCELLED
  await prisma.mission.create({
    data: {
      name: 'Autonomous Docking Experiment',
      description: 'Cancelled — superseded by next-gen docking protocol initiative.',
      startDate: inDays(50),
      endDate: inDays(60),
      status: 'CANCELLED',
      orgId: helios.id,
      createdById: hLead2.id,
    },
  })

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✓ Seed complete\n')
  console.log('┌─ Artemis Space Agency (' + artemis.id + ')')
  console.log('│  Director     chen@artemis.space')
  console.log('│  Leads        hayes@artemis.space  |  okafor@artemis.space')
  console.log('│  Crew         torres, kim, reeves (on leave), morgan (active), patel, webb (active), recruit (no skills)')
  console.log('│  Missions     DRAFT · SUBMITTED · APPROVED · IN_PROGRESS · COMPLETED · REJECTED · CANCELLED')
  console.log('│')
  console.log('└─ Helios Orbital Systems (' + helios.id + ')')
  console.log('   Director     director@helios.orbital')
  console.log('   Leads        fischer@helios.orbital  |  nakamura@helios.orbital')
  console.log('   Crew         brandt (active), hassan, tanaka, ramirez (active), walsh, alrashid (training), johansson (medical leave + only Comms L5)')
  console.log('   Missions     DRAFT · SUBMITTED (unmatchable) · APPROVED · IN_PROGRESS · COMPLETED · REJECTED · CANCELLED')
  console.log('\n   Password for all accounts: password123\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

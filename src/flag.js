// Heuristic flag pass — pure code, runs over ALL observations after normalize,
// before link. Two safety flags the structured feed doesn't carry itself:
//
//  - injection_suspected: text that tries to instruct the tool/pipeline (prompt
//    injection). The render step ALSO treats all content as data — this is
//    defense in depth, and it surfaces the attempt to the manager rather than
//    hiding it.
//  - unsupported_action: a charge/action proposed without the required evidence
//    or approval (no photos, no manager sign-off).
//
// Kept deterministic on purpose: the injection defense must not itself depend on
// an LLM.

const INJECTION_RES = [
  /ignore\s+(all|any|the|previous|other)/i,
  /disregard\s+(all|any|previous|the)/i,
  /system note to (the|you)/i,
  /mark (it|this|them)\s+(as\s+)?approved/i,
  /report .*all[-\s]?clear/i,
];

const UNSUPPORTED_RES = [
  /\bno photos?\b/i,
  /\bno (manager )?approval/i,
  /\bwithout (manager )?approval/i,
  /\bproposes?\s+(charging|to charge)/i,
];

export function addHeuristicFlags(obs) {
  const text = `${obs.summary || ''} ${obs.source?.raw_text || ''}`;
  const flags = new Set(obs.flags || []);
  if (INJECTION_RES.some((re) => re.test(text))) flags.add('injection_suspected');
  if (UNSUPPORTED_RES.some((re) => re.test(text))) flags.add('unsupported_action');
  return { ...obs, flags: [...flags] };
}

export function flagObservations(observations) {
  return observations.map(addHeuristicFlags);
}

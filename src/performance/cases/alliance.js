// Coordinates are metres on the two performers' action axis. The composition
// target is specified separately from the rail so an empty place can stay in frame.
function shot(fraction,kind,motion,fx,aimRole,screenX,screenY,fov,aimY,start,end=start){
  const [along,side,height]=start;
  const [endAlong,endSide,endHeight]=end;
  return {fraction,kind,motion,fx,composition:{along,side,height,aimRole,aimY,screenX,screenY,fov,endAlong,endSide,endHeight}};
}

export default {
  // Read their decision in the same frame; descend from the shared path to the two shoulders.
  allied:[
    shot(0,'wide','track','none','mid',.46,.53,48,-.45,[-1.1,3.9,2.45],[.22,3.4,1.28]),
    shot(.33,'pair','arc','none','mid',.53,.52,40,-.36,[.2,3.08,.08],[.98,2.78,-.09]),
    shot(.66,'profile','pull','warm','mid',.40,.56,44,-.45,[.96,2.95,-.13],[.52,3.88,.04]),
  ],
  // Begin with the offered place. After the refusal, stay with the proposer at the edge.
  'alliance-declined':[
    shot(0,'shoulderF','still','none','T',.63,.43,40,-.11,[-2.65,1.15,.12]),
    shot(.31,'faceT','pull','none','T',.61,.44,36,-.12,[-1.10,.75,.08],[-1.50,.98,.15]),
    shot(.57,'wide','still','cool','F',.26,.44,55,-.46,[.84,3.94,.63]),
  ],
  // Give space in one sustained lateral move; the final locked master preserves the distance.
  'boundary-respected':[
    shot(0,'profile','track','none','mid',.55,.53,45,-.5,[-1.20,3.0,.02],[.72,3.35,.08]),
    shot(.51,'wide','still','none','mid',.50,.44,51,-.55,[.06,3.99,1.32]),
  ],
  // A high view measures the gap. Cut low to the stop gesture, then confront the response head on.
  'boundary-disagreed':[
    shot(0,'wide','push','none','mid',.52,.55,47,-.52,[.03,2.78,3.05],[.04,2.38,2.58]),
    shot(.26,'pair','still','none','F',.40,.56,47,-.44,[1.24,1.80,-.58]),
    shot(.54,'faceT','push','impact','T',.54,.44,38,-.09,[-1.56,.53,.06],[-1.22,.48,.02]),
    shot(.79,'profile','still','none','mid',.48,.53,43,-.28,[.08,3.00,.14]),
  ],
  // Reconstruct an account: first its teller, then the listening witness, finally both in one plane.
  clarified:[
    shot(0,'faceF','still','none','F',.35,.45,32,-.09,[1.35,.92,.14]),
    shot(.32,'shoulderT','track','none','F',.41,.45,39,-.12,[2.55,1.10,.12],[2.28,1.24,.16]),
    shot(.58,'faceT','still','none','T',.65,.44,32,-.09,[-1.38,.90,.15]),
    shot(.78,'pair','still','none','mid',.50,.50,44,-.36,[.00,3.12,.35]),
  ],
  // Start on the work at hand, rise over the shared workspace, finish from its opposite end.
  'created-together':[
    shot(0,'insert','track','none','hand',.53,.54,39,.02,[.28,.96,.52],[-.20,.85,.37]),
    shot(.27,'wide','arc','none','mid',.47,.52,49,-.74,[.9,1.75,2.35],[-.58,2.08,2.06]),
    shot(.56,'pair','pull','spark','mid',.55,.40,42,-.64,[-.48,2.27,.46],[-.91,3.54,.82]),
  ],
};

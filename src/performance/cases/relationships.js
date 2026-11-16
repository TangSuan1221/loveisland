// Camera positions are measured from the framed performer in the F→T axis.
// Screen coordinates are composition decisions: leave room for an answer,
// the person entering a two-shot, or the space left after the refusal.
function take(fraction, kind, motion, fx, aimRole, start, end, aimY, screen, fov) {
  const [along, side, height] = start;
  const [endAlong, endSide, endHeight] = end;
  const [screenX, screenY] = screen;
  return {fraction, kind, motion, fx, composition:{
    along, side, height, endAlong, endSide, endHeight,
    aimRole, aimY, screenX, screenY, fov
  }};
}

export default {
  // Confession: approach past the speaker's shoulder. The answer gets an
  // uninterrupted portrait; the final arcing two-shot brings both into it.
  'mutual-feeling': [
    take(0,'shoulderF','push','none','T',[-2.8,.93,.07],[-2.45,.85,.07],-.09,[.65,.44],39),
    take(.31,'faceT','still','hearts','T',[-1.30,.44,.04],[-1.30,.44,.04],-.01,[.54,.45],33),
    take(.64,'pair','arc','warm','mid',[-1.20,3.45,.03],[.70,3.0,.19],-.29,[.50,.48],41)
  ],
  // Reject: an unfinished offer. Leave the extender's hand alone in frame
  // before answering. The high wide holds the strip of ground between them.
  'feelings-declined': [
    take(0,'insert','still','none','hand',[.33,1.13,.18],[.33,1.13,.18],0,[.31,.59],37),
    take(.27,'faceT','pull','cool','T',[-1.12,.46,.18],[-1.49,.62,.23],-.04,[.69,.43],31),
    take(.55,'wide','pull','vignette','mid',[.14,3.30,1.79],[.16,5.72,3.08],-.58,[.50,.59],44)
  ],
  // Reconciliation: the first person bends toward the other. Cut on the
  // returned gesture into an almost frontal two-shot and stay there.
  reconciled: [
    take(0,'faceF','push','none','F',[2.05,1.60,.31],[1.70,1.19,.16],-.25,[.30,.46],37),
    take(.41,'pair','arc','warm','mid',[1.89,3.10,.44],[.13,3.16,.09],-.43,[.50,.51],38)
  ],
  // Stalemate: a locked, observational long take. Both actors stay small;
  // the empty upper frame and the long silence carry the scene.
  unresolved: [
    take(0,'wide','still','cool','mid',[-.46,6.60,.36],[-.46,6.60,.36],-.46,[.40,.64],47)
  ],
  // Argument: two face-on interviews cut against each other, then isolate
  // the second interruption before a blunt, high-angle geography reset.
  disagreed: [
    take(0,'faceF','still','none','F',[1.38,.54,-.17],[1.38,.54,-.17],-.10,[.34,.52],34),
    take(.25,'faceT','push','impact','T',[-1.44,.53,-.13],[-1.16,.39,-.15],-.04,[.69,.48],39),
    take(.51,'faceF','still','none','F',[1.08,.49,.03],[1.08,.49,.03],-.01,[.44,.45],38),
    take(.74,'pair','still','none','mid',[.14,2.93,1.53],[.14,2.93,1.53],-.37,[.52,.48],45)
  ],
  // Growing familiarity: a side-on moving master with landscape ahead of
  // the pair, followed by a low, gentle reverse drift as they relax.
  connected: [
    take(0,'profile','track','none','mid',[-1.66,4.55,-.25],[1.42,4.25,-.20],-.49,[.61,.55],45),
    take(.56,'wide','pull','warm','mid',[1.43,3.62,-.19],[1.94,4.51,-.13],-.41,[.38,.56],39)
  ]
};

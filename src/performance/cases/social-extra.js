import {lens,sequence,lineOfAction,pose,phase,travel,stride,glance} from './water.js';

// Each track is authored in the same clock as the edit. For a continuation frame the previous
// gesture, floor mark and turn are reconstructed, even when the editor jumps straight to the cut.
const k=(time,pose,along=0,across=0,turn=0,look=0)=>({time,pose,along,across,turn,look});
function perform(actor,axis,track,s) {
  if(!actor)return;
  const i=Math.max(0,track.findLastIndex(key=>key.time<=s));
  const from=track[i],to=track[i+1]??from;
  const mix=to===from?0:phase(s,from.time,to.time);
  const lerp=key=>from[key]+(to[key]-from[key])*mix;
  pose(actor,from.pose,to.pose,mix,s);
  travel(actor,axis,lerp('along'),lerp('across'),lerp('turn'));
  glance(actor,lerp('look'));
  const walk=Math.hypot(to.along-from.along,to.across-from.across);
  if(walk>.16)stride(actor,mix,Math.ceil(walk/.52),Math.min(.45,.18+walk*.22));
}
function story(rows,lead,partner,props) {
  const edited=sequence(rows,([f,t],s)=>{
    const axis=lineOfAction([f,t]);
    perform(f,axis,lead,s);
    perform(t,axis,partner,s);
  });
  if(props)for(let i=0;i<edited.length;i++)edited[i].prop=props[i];
  return edited;
}
const prop=(kind,role)=>({kind,role});
const bottleF=prop('cup','F'),bottleT=prop('cup','T');
const tokenF=prop('parcel','F'),tokenT=prop('parcel','T');

export const extraTitles={
  enjoyed:'接住节拍','concern-raised':'问题在那边','sharing-unavailable':'没接到水',
  'item-borrowed':'借我看一下','borrow-declined':'留在我这里','item-returned':'物归原主',
  comforted:'坐一会儿','belief-corrected':'原来是这样','belief-unresolved':'各自的说法',
  'promise-discussed':'还记得那天吗','milestone-celebrated':'过了这一关','mediation-offered':'换个角度谈',
  'contest-completed':'最后一拍','mole-question-answered':'话筒递过来','mole-question-refused':'到此为止',
  'last-water-given':'最后一瓶','last-water-split':'各留一半','last-water-kept':'收回去的手'
};

export default {
  enjoyed:story([
    [0,'profile','track','none',lens('mid',-.22,4.5,-.51,-.69,.54,.50,43,-1.40,4.06,-.35)],
    [.40,'wide','arc','spark',lens('mid',1.18,4,.43,-.71,.41,.52,48,-1.6,3.65,.20)],
    [.76,'pair','pull','none',lens('mid',-.71,3.40,.30,-.60,.48,.48,39,-1.3,4.10,.50)]
  ],[k(0,'idle'),k(.22,'dance',.11,.21),k(.41,'clap',.18,.34),k(.63,'dance',.13,-.08),k(.82,'joy',.16,.08),k(1,'nod',.16,.08)],
    [k(0,'look'),k(.24,'nod'),k(.42,'dance',-.11,-.26),k(.61,'clap',-.14,-.29),k(.82,'dance',-.10,.16),k(1,'joy',-.12,.11)]),
  'concern-raised':story([
    [0,'shoulderT','push','none',lens('F',2.13,.84,.31,-.26,.34,.43,39,1.83,.80,.17)],
    [.33,'profile','track','none',lens('mid',-.6,4.52,.79,-.72,.30,.48,47,1.15,4.11,.70)],
    [.69,'faceT','still','none',lens('T',-1.54,1.01,.21,-.20,.62,.40,36)]
  ],[k(0,'ask'),k(.31,'point',.1,.12,.47),k(.64,'point',.2,.27,.88),k(1,'ask',.2,.27,.40)],
    [k(0,'idle'),k(.35,'look',0,0,-.25),k(.68,'inspect',-.11,.30,-.75),k(1,'nod',-.14,.30,-.33)]),
  'sharing-unavailable':story([
    [0,'insert','still','none',lens('hand',.18,1.2,-.58,.01,.56,.49,36)],
    [.42,'faceF','pull','none',lens('F',1.01,1.22,.31,-.17,.39,.47,40,1.7,1.59,.42)],
    [.77,'wide','still','vignette',lens('mid',-.55,5.32,2.10,-.71,.58,.56,40)]
  ],[k(0,'inspect'),k(.23,'take',.21),k(.52,'look',.23,0,.29),k(.83,'shy',-.13,.12),k(1,'mourn',-.13,.12)],
    [k(0,'ask'),k(.32,'take',-.19),k(.62,'look',-.19),k(.88,'retreat',.26,-.15),k(1,'idle',.26,-.15)]),
  'item-borrowed':story([
    [0,'faceF','push','none',lens('F',1.62,.83,.12,-.23,.69,.43,37,1.3,.77,.10)],
    [.29,'profile','track','none',lens('mid',.25,2.51,-.46,-.63,.51,.53,41,-.36,2.31,-.40)],
    [.62,'insert','still','spark',lens('hand',.43,1.22,-.58,0,.49,.51,35)],
    [.82,'pair','pull','none',lens('mid',-.40,3.64,.54,-.58,.52,.52,38,-.86,3.96,.71)]
  ],[k(0,'ask'),k(.34,'take',.28),k(.62,'take',.36,.06),k(.86,'inspect',.28,.15),k(1,'nod',.25,.16)],
    [k(0,'guard'),k(.29,'look'),k(.58,'offer',-.27,-.1),k(.79,'nod',-.16,-.05),k(1,'idle',-.16,-.05)],
    [tokenT,tokenT,tokenF,tokenF]),
  'borrow-declined':story([
    [0,'profile','push','none',lens('T',.24,2.02,-.44,-.57,.57,.55,38,-.01,1.66,-.40)],
    [.43,'shoulderF','still','none',lens('T',-2.06,.73,-.12,-.17,.61,.44,40)],
    [.76,'wide','pull','cool',lens('mid',-1.50,3.91,.82,-.67,.40,.51,43,-2.18,4.63,1.03)]
  ],[k(0,'ask'),k(.32,'take',.24),k(.65,'retreat',-.26,.13),k(1,'idle',-.26,.13)],
    [k(0,'inspect'),k(.29,'carry',.04),k(.53,'guard',.12,-.12,-.62),k(1,'hide',.24,-.19,-.84)],
    [tokenT,tokenT,tokenT]),
  'item-returned':story([
    [0,'insert','track','none',lens('hand',.42,1.08,-.55,0,.34,.54,33,.13,1.34,-.50)],
    [.31,'shoulderF','still','none',lens('T',-2.22,1.82,.27,-.18,.63,.44,37)],
    [.71,'profile','arc','warm',lens('mid',1.67,2.95,.22,-.50,.56,.48,41,.36,3.37,.33)]
  ],[k(0,'carry'),k(.29,'offer',.26,.1),k(.62,'offer',.38,.1),k(.82,'bow',.23,.03),k(1,'idle',.16,0)],
    [k(0,'look'),k(.29,'ask',-.08),k(.61,'take',-.32),k(.78,'inspect',-.26,.03),k(1,'nod',-.23,.05)],
    [tokenF,tokenF,tokenT]),
  comforted:story([
    [0,'faceT','still','cool',lens('T',-1.72,.70,.56,-.22,.33,.57,34)],
    [.34,'profile','track','none',lens('mid',.49,3.68,-.56,-.84,.43,.54,42,-.80,3.13,-.54)],
    [.71,'pair','still','warm',lens('mid',1.20,3.23,-.43,-.78,.64,.50,38)]
  ],[k(0,'look'),k(.31,'step',.31,.27),k(.55,'kneel',.57,.34,.53),k(.79,'sit',.57,.34,.69),k(1,'nod',.55,.34,.63)],
    [k(0,'mourn'),k(.27,'sit',0,-.07),k(.56,'sit',0,-.07,-.26),k(.79,'nod',-.10,-.03,-.43),k(1,'sit',-.11,-.01,-.45)]),
  'belief-corrected':story([
    [0,'shoulderF','still','none',lens('T',-2.3,.65,.32,-.17,.68,.45,35)],
    [.35,'faceF','push','none',lens('F',1.72,1.02,.11,-.15,.34,.42,35,1.45,.75,.04)],
    [.69,'pair','arc','spark',lens('mid',-1.36,3.66,.33,-.55,.56,.48,43,.34,3.36,.23)]
  ],[k(0,'point'),k(.28,'look',.08,.11),k(.55,'inspect',.23,.11),k(.78,'nod',.24,.04),k(1,'ask',.18,.04)],
    [k(0,'guard'),k(.27,'ask',-.08),k(.54,'point',-.13,.1,-.40),k(.76,'nod',-.14,.09),k(1,'idle',-.14,.09)]),
  'belief-unresolved':story([
    [0,'faceT','still','none',lens('T',-1.35,1.06,.27,-.16,.24,.44,34)],
    [.29,'faceF','still','none',lens('F',1.64,.84,.06,-.10,.76,.42,34)],
    [.59,'wide','pull','vignette',lens('mid',-.11,4.32,1.34,-.57,.48,.54,45,-.45,5.35,1.94)]
  ],[k(0,'ask'),k(.38,'point',.07,.13),k(.63,'guard',-.14,.20,.31),k(1,'look',-.33,.25,.50,.22)],
    [k(0,'stop'),k(.38,'guard',.10,-.08),k(.66,'look',.12,-.24,-.44),k(1,'hide',.24,-.31,-.69,-.21)]),
  'promise-discussed':story([
    [0,'insert','pull','none',lens('F',.46,1.60,-.84,-.79,.62,.53,37,.80,2.0,-.65)],
    [.38,'pair','still','none',lens('mid',.51,3.34,.43,-.52,.48,.48,40)],
    [.74,'faceT','still','vignette',lens('T',-1.42,.81,.44,-.23,.35,.52,38)]
  ],[k(0,'inspect'),k(.31,'point',.06),k(.54,'ask',.10,.12),k(.86,'mourn',.03,.12),k(1,'look',.03,.12)],
    [k(0,'idle'),k(.32,'shy',.08,-.08),k(.58,'bow',.05,-.10),k(.82,'ask',-.09,-.12),k(1,'nod',-.09,-.12)]),
  'milestone-celebrated':story([
    [0,'faceF','pull','none',lens('F',1.19,.84,-.19,-.18,.40,.46,37,1.74,1.03,-.12)],
    [.29,'wide','arc','spark',lens('mid',-.56,3.97,-.44,-.80,.46,.48,48,1.36,3.36,-.27)],
    [.66,'profile','track','warm',lens('mid',1.26,3.41,.46,-.50,.57,.47,42,-.13,3.48,.34)]
  ],[k(0,'look'),k(.24,'joy',.12,.17),k(.48,'clap',.20,.20),k(.73,'dance',.27,.04),k(1,'nod',.15,.04)],
    [k(0,'ask'),k(.28,'look',-.09),k(.48,'joy',-.15,-.13),k(.75,'clap',-.27,-.18),k(1,'wave',-.20,-.11)]),
  'mediation-offered':story([
    [0,'wide','track','none',lens('mid',1.27,4.6,1.20,-.61,.32,.51,44,-.62,4.2,1.30)],
    [.39,'profile','still','none',lens('F',-.54,2.41,-.27,-.43,.37,.52,39)],
    [.70,'shoulderF','push','none',lens('T',-2.41,.94,.21,-.19,.68,.43,42,-2.11,.82,.15)]
  ],[k(0,'step'),k(.22,'stop',.26,.35,.4),k(.47,'ask',.36,.49,.5),k(.76,'offer',.32,.44,.35),k(1,'idle',.32,.44,.24)],
    [k(0,'guard'),k(.27,'look',.10,-.05),k(.55,'ask',.06,-.09),k(.82,'nod',-.08,-.09),k(1,'look',-.08,-.09)]),
  'contest-completed':story([
    [0,'wide','still','none',lens('mid',.10,4.31,-.31,-.84,.50,.48,46)],
    [.28,'insert','track','none',lens('mid',-.53,2.99,-1.1,-1.14,.37,.53,36,.7,2.79,-.97)],
    [.55,'pair','push','spark',lens('mid',.25,3.75,.26,-.51,.52,.45,43,.12,3.18,.19)],
    [.80,'profile','pull','none',lens('mid',1.33,3.58,.80,-.62,.55,.53,43,1.82,4.28,.98)]
  ],[k(0,'step'),k(.21,'clap',.04,.26),k(.43,'dance',.16,-.14),k(.66,'clap',.12,.12),k(.82,'joy',.14,.19),k(1,'bow',.13,.14)],
    [k(0,'dance'),k(.24,'step',-.06,-.27),k(.45,'clap',-.11,.12),k(.65,'dance',-.12,-.08),k(.83,'clap',-.09,-.18),k(1,'bow',-.08,-.12)]),
  'mole-question-answered':story([
    [0,'faceF','still','none',lens('F',1.28,.48,.07,-.09,.25,.40,39)],
    [.30,'shoulderF','track','none',lens('T',-2.65,.92,.09,-.27,.65,.45,38,-1.98,1.06,.05)],
    [.62,'faceT','push','none',lens('T',-1.69,.82,.14,-.15,.57,.46,37,-1.38,.64,.11)]
  ],[k(0,'look'),k(.27,'ask',.20,.19),k(.52,'offer',.23,.24),k(.82,'nod',.20,.24),k(1,'look',.18,.24)],
    [k(0,'idle'),k(.25,'look',0,-.06),k(.52,'ask',-.12,-.09),k(.80,'point',-.14,-.08),k(1,'nod',-.10,-.08)]),
  'mole-question-refused':story([
    [0,'shoulderT','push','none',lens('F',2.47,1.02,.26,-.20,.41,.43,38,2.16,.91,.20)],
    [.34,'faceT','still','cool',lens('T',-1.50,.93,-.13,-.17,.71,.46,34)],
    [.67,'wide','still','none',lens('F',.28,4.78,.94,-.65,.29,.53,45)]
  ],[k(0,'ask'),k(.26,'offer',.22,.07),k(.52,'look',.16,.16),k(.76,'retreat',-.15,.17),k(1,'idle',-.15,.17)],
    [k(0,'look'),k(.26,'stop',.02),k(.48,'guard',.21,-.18,-.44),k(.77,'retreat',.48,-.33,-1.2),k(1,'hide',.65,-.43,-1.62)]),
  'last-water-given':story([
    [0,'insert','push','none',lens('hand',.30,1.27,-.48,.03,.53,.53,32,.36,1.05,-.45)],
    [.30,'faceF','still','none',lens('F',1.34,1.10,.20,-.15,.32,.44,38)],
    [.59,'profile','track','none',lens('mid',.92,2.69,-.35,-.59,.48,.54,43,-.70,2.46,-.39)],
    [.81,'faceT','still','warm',lens('T',-1.45,.84,.08,-.22,.60,.42,39)]
  ],[k(0,'inspect'),k(.27,'mourn',.07),k(.55,'offer',.34,.08),k(.78,'offer',.35,.08),k(1,'idle',.13,.12)],
    [k(0,'mourn'),k(.26,'look',-.05),k(.51,'ask',-.18),k(.76,'take',-.33,-.07),k(1,'carry',-.25,-.12)],
    [bottleF,bottleF,bottleF,bottleT]),
  'last-water-split':story([
    [0,'wide','push','none',lens('mid',-.25,3.88,2.35,-.73,.52,.58,41,-.19,3.12,1.88)],
    [.34,'insert','still','none',lens('hand',.53,1.34,-.47,.02,.42,.51,36)],
    [.62,'pair','arc','warm',lens('mid',-.97,2.90,.16,-.54,.51,.47,42,.83,2.89,.18)]
  ],[k(0,'inspect'),k(.22,'drink',.12),k(.35,'carry',.18,.08),k(.52,'offer',.29,.13),k(.65,'offer',.30,.10),k(.88,'nod',.20,.06),k(1,'idle',.15,.06)],
    [k(0,'ask'),k(.25,'take',-.11),k(.45,'take',-.31,-.06),k(.70,'drink',-.28,-.05),k(.90,'nod',-.20,-.09),k(1,'idle',-.20,-.09)],
    [bottleF,bottleF,bottleT]),
  'last-water-kept':story([
    [0,'shoulderT','still','none',lens('F',2.49,.92,.13,-.22,.31,.44,40)],
    [.32,'insert','pull','none',lens('hand',.18,1.33,-.55,.02,.68,.56,35,-.14,1.71,-.47)],
    [.68,'wide','pull','vignette',lens('mid',.31,4.46,1.12,-.68,.60,.50,46,.84,5.45,1.50)]
  ],[k(0,'carry'),k(.23,'offer',.13),k(.44,'guard',-.12,.13,.26),k(.72,'hide',-.34,.24,.79),k(1,'carry',-.44,.33,.96)],
    [k(0,'ask'),k(.26,'take',-.14),k(.48,'look',-.09,-.07),k(.73,'retreat',.22,-.22,-.26),k(1,'mourn',.32,-.28,-.42)],
    [bottleF,bottleF,bottleF])
};

import {lockCinemaFace,sampleCinemaChannels} from '../action-face.js';
import expressionCsv from './data/skit-expression.csv?raw';
import {parseCsv} from './runtime.js';
import {createEmotionStage,sceneTheme} from './emotion-stage.js';
import {createAuthoredFaces} from './authored-face.js';
import {lightRecording} from './cinema-light.js';
import {frameCampLocation,stageCampActors} from './cases/camp.js';
import {Raycaster, Vector3} from 'three';
import {PostProcessing} from 'three/webgpu';
import {pass, uniform} from 'three/tsl';
import {dof} from 'three/addons/tsl/display/DepthOfFieldNode.js';
import {actionAnchor,createCinemaCamera} from './cinema-camera.js';
import {createCinemaFx} from './cinema-fx.js';
import {createCinemaActing} from './cinema-acting.js';
import {createStagePresentation} from './stage/stage-presentation.js';

export function createCinemaStage({camera, controls, actors, root, scene}) {
  const ray = new Raycaster();
  const direction = new Vector3();
  function blocked(position,aim,subjects) {
    direction.copy(aim).sub(position);
    ray.far = Math.max(0,direction.length()-.2);
    ray.set(position,direction.normalize());
    const roots = new Set(subjects.map(actor=>actor.mesh));
    return ray.intersectObjects(scene.children,true).some(({object})=>{
      if(!object.isMesh || object.material?.opacity<.5)return false;
      for(let node=object;node;node=node.parent)if(!node.visible||roots.has(node))return false;
      return true;
    });
  }
  const cameraOperator = createCinemaCamera({camera, controls, actors, blocked});
  let performers=[];
  let liveOperator, liveId;
  const effects = createCinemaFx(root);
  const emotions=createEmotionStage(scene,actors);
  const authoredFaces=createAuthoredFaces(actors,parseCsv(expressionCsv));
  const acting = createCinemaActing(actors);
  const presentation = createStagePresentation(root);
  window.addEventListener('pagehide',event=>{if(!event.persisted)presentation.dispose();});
  const subject = new Vector3();
  const focus = uniform(2);
  const falloff = uniform(2.2);
  const blur = uniform(2.5);
  let lens = null;
  let shallow = false;
  let previousShot,previousYaw,bridge;
  const forward=new Vector3();
  const directionYaw=()=>{camera.getWorldDirection(forward);return Math.atan2(forward.x,forward.z);};
  return {
    setBackdrop: presentation.setPreference,
    liveFrame(setup,event,progress) {
      if(liveId!==event.id || !liveOperator){
        liveOperator=createCinemaCamera({camera,controls,actors,blocked});
        liveId=event.id;
      }
      return liveOperator.frame(setup,event.participants,progress);
    },
    capture(event) {
      previousShot=null;bridge=false;
      presentation.start(sceneTheme(event));
      const resetLight=lightRecording(scene,event);
      const resetCamera = cameraOperator.capture();
      const unstage=event.type==='camp-story'?stageCampActors(actors,event):null;
      const resetActors = acting.begin(event);
      emotions.begin(event);
      authoredFaces.begin(event);
      performers=event.participants.map(id=>actors.find(a=>a.id===id));
      const unlock=performers.filter(Boolean).map(actor=>{
        const seed=Array.from(String(event.id)+'/'+actor.id).reduce((h,c)=>Math.imul(h,31)+c.codePointAt(0),17);
        return lockCinemaFace(actor,seed);
      });
      root.classList.add('cinema-playing');
      return () => {
        shallow = false;
        presentation.hide();
        effects.clear();emotions.clear();authoredFaces.clear();
        resetLight?.();
        unlock.forEach(release=>release());
        performers=[];
        resetActors();
        unstage?.();
        resetCamera();
        root.classList.remove('cinema-playing');
        delete root.dataset.cinemaShot;
        delete root.dataset.emotionTheme;
        delete root.dataset.cinemaDurationMs;
        root.style.removeProperty('--emotion-envelope');
        root.style.removeProperty('--cinema-cut');
      };
    },
    frame(shot,event,progress,elapsedMs,effect,blackCut,cues,totalMs,faceTrack) {
      authoredFaces.beforePose();
      sampleCinemaChannels(performers,cues||[],elapsedMs,()=>acting.frame(shot,progress,elapsedMs,cues));
      const duration=totalMs||shot.totalMs||6000;
      const beat=emotions.frame(event,elapsedMs,duration);
      authoredFaces.frame(cues,elapsedMs,faceTrack);
      root.dataset.cinemaDurationMs=String(duration);
      if(beat)root.dataset.emotionTheme=beat.theme;else delete root.dataset.emotionTheme;
      root.style.setProperty('--emotion-envelope',String(beat?Math.min(1,beat.t*8,(1-beat.t)*8):0));
      if(shot.originalRig){
        const rig=shot.originalRig;
        const dist=rig.dist+(progress*(rig.distTo?rig.distTo-rig.dist:0));
        controls.target.set(rig.tx,1.45,rig.tz);
        camera.position.copy(controls.target).add(new Vector3().setFromSphericalCoords(dist,rig.pitch,rig.yaw));
        camera.lookAt(controls.target);
        camera.fov=rig.fov||37;camera.updateProjectionMatrix();
      }else if(shot.location){
        frameCampLocation(camera,controls,event,shot,progress);
      }else if(shot.kind==='location' && Number.isFinite(event.x) && Number.isFinite(event.z)){
        const scale = (shot.rig?.dist || 9)*(1-.12*progress);
        controls.target.set(event.x,.9,event.z);
        camera.position.copy(controls.target).add(new Vector3(.52,.54,.66).multiplyScalar(scale));
        camera.lookAt(controls.target);
        camera.fov=shot.rig?.fov||42;
        camera.updateProjectionMatrix();
      }else if(shot.kind==='faceA'){
        shot.thirdSetup??={...shot,kind:'faceF'};
        cameraOperator.frame(shot.thirdSetup,[event.participants[2]??event.participants[0]],progress);
      }else cameraOperator.frame(shot,event.participants,progress);
      camera.updateMatrixWorld();
      const target=shot.composition?.aimRole;
      const role=shot.kind==='faceA'?2:target?Number(target==='T'):Number(['faceT','shoulderF'].includes(shot.kind));
      const actor=actors.find(a=>a.id===event.participants[role]);
      let anchor;
      shallow=false;
      if(actor?._head && shot.kind!=='location') {
        if(target==='hand'){
          const other=actors.find(a=>a.id===event.participants[1])||actor;
          subject.copy(actionAnchor(actor,other,shot));
        }else actor._head.getWorldPosition(subject);
        focus.value=Math.max(.1,-subject.applyMatrix4(camera.matrixWorldInverse).z);
        subject.applyMatrix4(camera.projectionMatrix);
        anchor={x:(1+subject.x)/2,y:(1-subject.y)/2};
        shallow=['faceF','faceT','faceA','shoulderF','shoulderT','insert'].includes(shot.kind);
      }      const yaw=directionYaw();
      if(previousShot!==shot){
        const turn=yaw-previousYaw;
        bridge=!!previousShot && Math.abs(Math.atan2(Math.sin(turn),Math.cos(turn)))>Math.PI*.6;
        previousShot=shot;
      }
      previousYaw=yaw;
      const sinceCut=elapsedMs-shot.at;
      root.style.setProperty('--cinema-cut',String(blackCut ? 1 : bridge ? Math.max(0,1-sinceCut/110) : 0));
      effects.frame(effect ? {...shot,fx:effect.fx} : shot,effect ? (elapsedMs-effect.at)/(effect.until-effect.at) : progress,anchor);
      presentation.sample(elapsedMs/1000,{
        actors:performers,shot,event,elapsedMs,progress,camera,
        cameraOffset:{x:.02*(progress-.5),y:0}, zoom:1+.025*progress,
      });
      root.dataset.cinemaShot = shot.kind;
    },
    render(renderer) {
      if(presentation.render())return;
      emotions.draw(()=>{
      if(!shallow) { renderer.render(scene,camera); return; }
      if(!lens) {
        const beauty = pass(scene,camera);
        lens = new PostProcessing(renderer,dof(beauty.getTextureNode(),beauty.getViewZNode(),focus,falloff,blur));
      }
      lens.render();
      });
    }
  };
}

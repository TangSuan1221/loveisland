import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeFaceArt,FACE_ART_LIMITS,artLocalPoint,hitFaceArt,drawAppearancePaint} from '../src/avatar-face-art.js';
import {normalizeAppearance} from '../src/avatar-schema.js';
test('layer IDs remain unique with adversarial repeated suffix chains',()=>{const a=normalizeFaceArt(['x','x-1','x','x','x-1','x-1-1','x-1'].map(id=>({id,kind:'star'})));assert.equal(a.length,7);assert.equal(new Set(a.map(l=>l.id)).size,7);assert.deepEqual(normalizeFaceArt(a),a);});
test('invalid shapes and unsafe fields are normalized; points and count are bounded',()=>{
 assert.deepEqual(normalizeFaceArt(null),[]);assert.deepEqual(normalizeFaceArt([null,{kind:'evil'},{kind:'pen',points:[]}]),[]);
 const a=normalizeFaceArt(Array.from({length:80},()=>({kind:'pen',id:'same',x:Infinity,y:-4,width:0,rotation:800,color:'url(bad)',points:Array.from({length:300},()=>[40,-40])})));
 assert(a.length<=64);assert(a.reduce((n,l)=>n+l.points.length,0)<=FACE_ART_LIMITS.totalPoints);assert(a.every(l=>l.points.length<=256));assert.equal(a[0].x,.5);assert.equal(a[0].y,0);assert.equal(a[0].width,.005);assert.equal(a[0].rotation,180);assert.equal(a[0].color,'#49303f');assert.deepEqual(a[0].points[0],[.5,-.5]);
});
test('inverse transform handles rotated mirrored layer, top order and hidden layers',()=>{
 const [l]=normalizeFaceArt([{kind:'ellipse',id:'low',x:.23,y:.4,width:.3,height:.12,rotation:35,mirror:true}]);
 const t=l.rotation*Math.PI/180,u=.2,v=-.3,x=l.x+Math.cos(t)*l.width*u-Math.sin(t)*l.height*v,y=l.y+Math.sin(t)*l.width*u+Math.cos(t)*l.height*v;
 const p=artLocalPoint(l,1-x,y,true);assert(Math.abs(p[0]-u)<1e-10);assert(Math.abs(p[1]-v)<1e-10);assert.deepEqual(hitFaceArt([l],1-x,y),{id:'low',mirrored:true});
 const top={...l,id:'top'};assert.equal(hitFaceArt([l,top],l.x,l.y).id,'top');assert.equal(hitFaceArt([l,{...top,visible:false}],l.x,l.y).id,'low');assert.equal(hitFaceArt([l],.5,.98),null);
});
test('appearance JSON roundtrip keeps legacy paint and layer points without aliasing',()=>{
 const input={strokes:[{tool:'pen',color:'#123456',width:.01,points:[[.3,.4],[.4,.5]]}],faceArt:[{kind:'pen',points:[[0,0],[.3,.4]],mirror:true}]};
 const a=normalizeAppearance(input),b=normalizeAppearance(JSON.parse(JSON.stringify(a)));assert.deepEqual(b,a);b.faceArt[0].points[0][0]=.45;assert.equal(a.faceArt[0].points[0][0],0);assert.equal(a.strokes.length,1);assert.equal(a.strokes[0].points.length,2);
});
test('shared replay preserves legacy eraser and draws layers afterward, clipping last',()=>{
 const ops=[],ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>ops.push([k,...args]),set:(o,k,v)=>(o[k]=v,ops.push(['set',k,v]),true)});
 drawAppearancePaint(ctx,normalizeAppearance({strokes:[{tool:'eraser',color:'#000000',width:.03,points:[[.2,.3],[.3,.3]]}],faceArt:[{kind:'ring',mirror:true}]}));
 const modes=ops.filter(v=>v[0]==='set'&&v[1]==='globalCompositeOperation').map(v=>v[2]);assert.deepEqual(modes,['destination-out','source-over','source-over','destination-in']);assert.equal(ops.filter(v=>v[0]==='ellipse').length,3);
});

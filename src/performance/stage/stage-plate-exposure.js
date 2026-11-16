import printCsv from './art/print-calibration.csv?raw';

// A painted sRGB plate already contains a photographic shoulder. Invert
// that shoulder before it meets the scene-referred actors, practicals and FX.
// The scan parameters travel with each plate, independently of the
// camera/lighting CSVs that grade the entire performance.
const printProfiles=new Map(printCsv.trim().split(/\r?\n/).slice(1).map(line=>{
  const [id,...values]=line.split(',');
  return [id,values.map(Number)];
}));
const profile=id=>{
  const values=printProfiles.get(id);
  if(!values || values.length!==5 || values.some(v=>!Number.isFinite(v))){
    throw new Error('Invalid stage print calibration for '+id);
  }
  return values;
};
const printVector=id=>'vec4('+profile(id).slice(0,4).map(v=>v.toFixed(6)).join(',')+')';
export const plateExposureShader=/* glsl */ `
vec3 inverseCameraShoulder(vec3 displayLinear){
  vec3 y=clamp(displayLinear,0.,.986);
  vec3 a=2.51-2.43*y;
  vec3 b=.03-.59*y;
  return (sqrt(b*b+.56*a*y)-b)/(2.*a);
}
vec3 plateToScene(vec3 art,float sceneIndex,vec2 screen){
  vec4 print=sceneIndex<.5 ? ${printVector('hanami')} :
             sceneIndex<1.5 ? ${printVector('cabin')} : ${printVector('orb')};
  float y=max(.00001,dot(art,vec3(.2126,.7152,.0722)));
  float density=pow(max(0.,(y-print.x)/(1.-print.x)),print.y);
  density*=exp2(print.z+print.w*(screen.y-.5));
  vec3 encoded=art*density/y;
  float peak=max(.00001,max(encoded.r,max(encoded.g,encoded.b)));
  float white=sceneIndex<.5 ? ${profile('hanami')[4]} :
              sceneIndex<1.5 ? ${profile('cabin')[4]} : ${profile('orb')[4]};
  float knee=white*.82;
  if(peak>knee){
    float range=white-knee;
    float rolled=knee+range*(1.-exp(-(peak-knee)/range));
    encoded*=rolled/peak;
  }
  return inverseCameraShoulder(encoded);
}
float fixture(vec2 p,vec2 origin,vec2 halfSize){
  float r=length((p-origin)/halfSize);
  return 1.-smoothstep(.45,1.,r);
}
vec3 crystalPrint(vec3 hdr,vec2 p,vec3 rimLight) {
  vec2 sphere=(p-vec2(.802,.48))/vec2(.041,.073);
  float r=length(sphere);
  float y=dot(hdr,vec3(.2126,.7152,.0722));
  // Felt takes a broad, muted reflection beneath the brass stand; the
  // candle bodies and crystal sit above the lip and retain their own light.
  float felt=fixture(p,vec2(.804,.617),vec2(.130,.099))*smoothstep(.552,.579,p.y);
  hdr=mix(hdr,mix(vec3(y),hdr,.55)*.56,felt);
  // The plate has three cast brass feet and open filigree. Recover the
  // contrast of the casting, then seat each foot against the velvet.
  float stand=fixture(p,vec2(.800,.559),vec2(.043,.033))*smoothstep(.527,.541,p.y);
  float brass=smoothstep(.02,.13,hdr.g-hdr.b)*smoothstep(.04,.19,hdr.r-hdr.b);
  float relief=mix(.42,1.19,smoothstep(.065,.31,y));
  hdr*=mix(1.,relief,stand*brass);
  float contact=fixture(p,vec2(.800,.584),vec2(.039,.0055));
  float feet=max(fixture(p,vec2(.772,.582),vec2(.009,.0037)),
             max(fixture(p,vec2(.800,.585),vec2(.009,.0037)),
                 fixture(p,vec2(.827,.582),vec2(.009,.0037))));
  hdr*=1.-.41*contact-.19*feet;
  float glass=1.-smoothstep(.985,1.035,r);
  // Only the side facing the window carries a silver arc. Across the rest of
  // the sphere the viewer sees the room through lightly tinted glass.
  vec3 violet=vec3(rimLight.g, .5*(rimLight.g+rimLight.r), rimLight.b);
  violet/=max(.01,max(violet.b,max(violet.r,violet.g)));
  vec3 glassColour=mix(vec3(1.),violet,.24);
  float reflectedWindow=exp(-pow((r-.936)/.029,2.))
      *smoothstep(.72,1.10,-sphere.x*.82-sphere.y*.80);
  if(r<1.035){
    // The upper drapery continues behind the crystal. Refract that fabric
    // into the painted glass while retaining its transmitted candlelight.
    float bend=sqrt(max(0.,1.-min(1.,r*r)));
    vec2 drape=vec2(.802,.342)+sphere*vec2(.055,.040)*(.68+.32*bend);
    vec3 transmitted=plateToScene(textureLod(plate,vec2(drape.x,1.-drape.y),1.).rgb,2.,screen);
    float shoulder=.43+.28*smoothstep(.24,.96,r);
    hdr=mix(hdr,transmitted,glass*shoulder);
    hdr+=glassColour*.22*reflectedWindow;
  }
  float candle=max(fixture(p,vec2(.7398,.5222),vec2(.026,.052)),
               max(fixture(p,vec2(.8709,.4574),vec2(.022,.046)),
                   fixture(p,vec2(.8871,.5372),vec2(.022,.045))));
  hdr*=1.-.29*candle;
  return hdr;
}
float plateEmissionMask(vec2 artUV, float sceneIndex) {
  if(sceneIndex<.5){
    return max(max(fixture(artUV,vec2(.1088,.1888),vec2(.018,.028)),
                   fixture(artUV,vec2(.1575,.3809),vec2(.008,.018))),
               max(fixture(artUV,vec2(.2588,.2921),vec2(.015,.024)),
                   fixture(artUV,vec2(.4004,.2061),vec2(.013,.021))));
  }
  if(sceneIndex<1.5){
    return max(fixture(artUV,vec2(.0556,.5803),vec2(.023,.038)),
               fixture(artUV,vec2(.2697,.2109),vec2(.015,.025)));
  }
  return max(max(fixture(artUV,vec2(.7398,.5222),vec2(.008,.016)),
                 fixture(artUV,vec2(.8709,.4574),vec2(.008,.016))),
             max(fixture(artUV,vec2(.8871,.5372),vec2(.008,.016)),
                 fixture(artUV,vec2(.782,.470),vec2(.009,.015))));
}`;

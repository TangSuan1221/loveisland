// Both frames are already display-referred here. The fog colour travels
// with the incoming recipe, so a night cut never fades through white.
export const dissolveShader = /* glsl */ `
uniform sampler2D previousFrame;
uniform float dissolve;
uniform vec3 fogColour;
float paperNoise(vec2 p) {
  vec2 cell=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  vec2 a=vec2(17.0,59.4);
  float n=dot(cell,a);
  vec4 h=fract(sin(n+vec4(0.,a.x,a.y,a.x+a.y))*43758.5453);
  return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
}
vec3 dissolveFrame(vec3 incoming,vec2 uv) {
  if(dissolve>=1.) return incoming;
  vec3 outgoing=texture(previousFrame,uv).rgb;
  float fibres=.64*paperNoise(uv*vec2(10.,6.))+.36*paperNoise(uv*vec2(24.,15.));
  float local=smoothstep(0.,1.,dissolve*1.55-.55*(.7*fibres+.3*uv.x));
  vec3 colour=mix(outgoing,incoming,local);
  return mix(colour,fogColour,.18*4.*local*(1.-local));
}`;

export function transitionProgress(start, duration, time) {
  if(duration<=0 || time>=start+duration) return 1;
  return Math.max(0,(time-start)/duration);
}

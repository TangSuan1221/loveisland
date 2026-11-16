import {DataTexture,LinearFilter,RedFormat,UnsignedByteType} from 'three';

// Traced in 640×360 art space, shared by the plate and its optical-depth pass.
// Each closed shape follows an actual solid in the painting. The central acting
// floor, sky between branches, transparent crystal and far scenery stay open.
const contours = {
  hanami: [
    // Main bough and its two forks.
    'M0 224 Q12 226 31 220 Q18 208 22 197 Q14 180 24 162 Q34 142 52 135 Q79 128 102 119 Q119 112 129 97 Q139 81 155 80 Q182 82 198 69 Q210 56 234 51 L268 44 Q238 42 214 50 Q199 52 186 64 Q174 76 148 72 Q128 67 117 78 Q103 98 87 97 Q61 96 42 106 Q28 116 13 118 Q23 99 40 90 L60 77 Q33 81 15 93 L0 110 Z',
    'M0 81 Q14 67 40 58 Q59 49 71 29 Q78 17 95 11 Q104 7 123 13 L142 20 Q127 5 112 1 L81 0 Q64 9 55 27 Q46 47 21 47 Q10 47 0 53 Z',
    // Clustered blossoms overhanging the top edge of the lens.
    'M0 0 H398 Q385 5 381 16 Q374 14 370 18 Q363 24 355 17 Q348 22 343 21 Q339 26 330 22 Q328 27 320 24 Q314 29 308 28 Q300 33 291 26 Q284 33 276 33 Q269 29 263 37 Q256 42 247 37 Q239 43 230 39 Q226 46 213 40 Q207 48 196 43 Q190 53 179 48 Q171 55 162 52 Q153 61 144 55 Q135 62 128 59 Q119 67 112 62 Q103 67 94 60 Q85 64 76 58 Q66 61 55 54 Q48 63 39 56 Q27 62 17 55 Q9 65 0 61 Z',
    // Near rocks and flowers at the lens corners.
    'M0 291 Q10 285 11 300 Q22 294 27 308 Q36 305 42 320 Q66 318 75 333 Q85 337 94 360 H0 Z',
    'M498 360 Q507 347 521 351 Q536 328 553 336 Q566 326 579 334 Q592 316 600 328 Q608 304 618 312 Q624 301 632 305 L640 297 V360 Z',
  ],
  cabin: [
    // Stone fireplace, basket, kettle and shell, on the camera side of the wall.
    'M0 0 H24 Q27 15 21 34 Q40 32 46 52 Q48 64 43 71 Q63 69 68 88 Q84 82 91 96 Q94 109 84 116 Q93 123 90 136 Q103 149 100 161 Q92 172 92 188 Q99 181 107 184 Q118 188 119 201 Q128 205 125 218 Q124 229 115 231 L138 228 L143 249 Q132 255 114 259 L84 266 L64 271 Q60 283 53 291 Q68 290 78 302 Q84 308 77 315 Q70 327 52 329 Q43 334 35 328 Q18 333 0 328 Z',
  ],
  orb: [
    // Twisted cord, knot and out-of-focus tassel in front of the stage right edge.
    'M572 0 Q582 12 590 27 Q599 50 607 76 Q617 108 619 138 Q621 155 616 166 Q607 175 615 185 Q601 198 610 214 Q615 225 618 229 Q613 248 607 269 Q601 288 590 305 Q597 311 605 311 L583 360 H640 V0 Z',
    // The audience-side valance at the upper left of the wide establishing shot.
    'M0 0 H179 Q169 19 149 42 Q123 69 91 84 Q54 102 20 100 L0 97 Z',
    // Left velvet wing and its uneven gold hem, visible in the full-room shot.
    'M0 92 Q39 105 78 92 Q58 135 47 166 Q39 202 51 249 L56 263 Q44 257 33 265 Q18 272 0 262 Z',
  ],
};

export function makeForegroundMatte(id) {
  const canvas=document.createElement('canvas');
  canvas.width=640; canvas.height=360;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  for(const outline of contours[id]) ctx.fill(new Path2D(outline));
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const mask=new Uint8Array(canvas.width*canvas.height);
  for(let y=0;y<canvas.height;y++) {
    const source=y*canvas.width, target=(canvas.height-1-y)*canvas.width;
    for(let x=0;x<canvas.width;x++) mask[target+x]=pixels[(source+x)*4+3];
  }
  const texture=new DataTexture(mask,canvas.width,canvas.height,RedFormat,UnsignedByteType);
  texture.magFilter=texture.minFilter=LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

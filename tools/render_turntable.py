# -*- coding: utf-8 -*-
"""
render_turntable.py — 8 角度正交转盘，用于侧面/剪影验收。
用法:
  blender -b build/CHR_Base.blend -P tools/render_turntable.py -- \
      --out docs/assets/turntable --res 512 --frames 8
"""
import bpy, sys, os, math, argparse
from mathutils import Vector

def scene_bounds():
    mins=Vector((1e9,1e9,1e9)); maxs=Vector((-1e9,-1e9,-1e9))
    for o in bpy.context.scene.objects:
        if o.type != "MESH": continue
        for c in o.bound_box:
            w=o.matrix_world @ Vector(c)
            mins.x=min(mins.x,w.x); mins.y=min(mins.y,w.y); mins.z=min(mins.z,w.z)
            maxs.x=max(maxs.x,w.x); maxs.y=max(maxs.y,w.y); maxs.z=max(maxs.z,w.z)
    return mins,maxs

def main():
    argv=sys.argv
    if "--" in argv: argv=argv[argv.index("--")+1:]
    ap=argparse.ArgumentParser()
    ap.add_argument("--out", default="docs/assets/turntable")
    ap.add_argument("--res", type=int, default=512)
    ap.add_argument("--frames", type=int, default=8)
    args=ap.parse_args(argv)
    args.out = os.path.abspath(args.out)
    os.makedirs(args.out, exist_ok=True)
    mins,maxs=scene_bounds()
    center=(mins+maxs)*0.5
    height=max(maxs.z-mins.z, 0.1)
    # camera
    cam_data=bpy.data.cameras.new("TurntableCam")
    cam=bpy.data.objects.new("TurntableCam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam_data.type='ORTHO'; cam_data.ortho_scale=height*1.15
    bpy.context.scene.camera=cam
    # light + world
    if not any(o.type=='LIGHT' for o in bpy.context.scene.objects):
        ld=bpy.data.lights.new("Key",'SUN'); ld.energy=3.0
        lo=bpy.data.objects.new("Key",ld); bpy.context.collection.objects.link(lo)
        lo.rotation_euler=(math.radians(55),0,math.radians(35))
    bpy.context.scene.world.color=(0.05,0.05,0.05)
    bpy.context.scene.render.engine='BLENDER_WORKBENCH'
    bpy.context.scene.display.shading.light='STUDIO'
    bpy.context.scene.display.shading.color_type='MATERIAL'
    bpy.context.scene.render.resolution_x=args.res
    bpy.context.scene.render.resolution_y=args.res
    bpy.context.scene.render.film_transparent=False
    for i in range(args.frames):
        a=2*math.pi*i/args.frames
        r=max(height*2.0, 2.0)
        cam.location=center+Vector((math.sin(a)*r, -math.cos(a)*r, 0))
        # look at center
        direction=center-cam.location
        cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
        bpy.context.scene.render.filepath=os.path.join(args.out, f"view_{i*360//args.frames:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("rendered", bpy.context.scene.render.filepath)

if __name__=="__main__":
    main()

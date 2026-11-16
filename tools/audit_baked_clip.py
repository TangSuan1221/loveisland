"""Measure baked mesh motion at 30 fps against the declared support intervals."""
import argparse,bpy,json,sys,math
from mathutils.bvhtree import BVHTree
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--contacts',type=json.loads,required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
scene=bpy.context.scene;arm=bpy.data.objects['RIG_Base'];action=arm.animation_data.action
count=round(action.frame_range[1]-action.frame_range[0])+1
first={};last={};min_floor=999;intersections=[];supports={}
for i in range(count):
    scene.frame_set(round(action.frame_range[0])+i);g=bpy.context.evaluated_depsgraph_get()
    objects={n:bpy.data.objects[n].evaluated_get(g) for n in ('Shirt','Mittenl','Mittenr','Thumbl','Thumbr','Shoel','Shoer')}
    def vs(n):return [objects[n].matrix_world@v.co for v in objects[n].data.vertices]
    def tree(n):return BVHTree.FromPolygons(vs(n),[list(p.vertices) for p in objects[n].data.polygons])
    body=tree('Shirt')
    if any(tree(n).overlap(body) for n in ('Mittenl','Mittenr','Thumbl','Thumbr')):intersections.append(i)
    for side in ('l','r'):
        sole=vs('Shoe'+side)[:32]
        min_floor=min(min_floor,min(v.z for v in sole))
        for s,start,end,*plane in a.contacts:
            if s==side and start<=i<=end:
                key=f'{s}_{start}_{end}'
                if key not in supports:supports[key]=dict(reference=sole,drift=0,planeError=0)
                record=supports[key];record['drift']=max(record['drift'],max((x-y).length for x,y in zip(sole,record['reference'])))
                surface=plane[0] if plane else {}
                normal=Vector(surface.get('normal',[0,0,1])).normalized()
                origin=Vector(surface.get('point',[0,0,0]))
                record['planeError']=max(record['planeError'],max(abs((v-origin).dot(normal)) for v in sole))
    if i in (0,count-1):
        capture={p.name:p.matrix.copy() for p in arm.pose.bones if p.bone.use_deform}
        if i==0:first=capture
        else:last=capture
metrics=dict(action=action.name,frames=count,contactSlideMetres={k:v['drift'] for k,v in supports.items()},minimumSoleZ=min_floor,
             handTorsoFrames=intersections,loopMetres=max((first[n].translation-last[n].translation).length for n in first),loopDegrees=max(math.degrees(2*math.acos(min(1,abs(first[n].to_quaternion().normalized().dot(last[n].to_quaternion().normalized()))))) for n in first))
metrics['supportPlaneErrorMetres']={k:v['planeError'] for k,v in supports.items()}
Path(a.out).write_text(json.dumps(metrics,indent=2));print(metrics)


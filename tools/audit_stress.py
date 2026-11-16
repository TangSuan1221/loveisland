"""Measure each stress pose on evaluated vertices; film the poses for visual review."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree
root=Path.cwd()
arm=bpy.data.objects['RIG_Base']
rest={b.name:b.matrix_basis.copy() for b in arm.pose.bones}
# Anatomical directions in armature space at rest, angles in degrees.
poses={
 'raise_arm':[('upperarm_l','Y',-85)], 'hip_flexion':[('thigh_l','X',-82)],
 'head_turn':[('head','Z',60)], 'elbow_90':[('lowerarm_l','Z',-90)],
 'knee_90':[('calf_l','X',90)], 'squat':[('thigh','X',-75),('calf','X',105),('foot','X',-30),('chest','X',12)],
 'torso_twist':[('spine_01','Z',15),('spine_02','Z',15),('chest','Z',15)],
 'chair':[('thigh','X',-90),('calf','X',90)],'embrace':[('upperarm','Z',-66),('lowerarm','Z',-80)],
 'carry':[('upperarm','Y',59),('lowerarm','Z',-74)],'overhead':[('upperarm','Y',-75),('lowerarm','Z',-28)],
 'stride':[('thigh_l','X',-36),('calf_l','X',26),('thigh_r','X',29),('calf_r','X',45)]}
def meshes():
    dep=bpy.context.evaluated_depsgraph_get()
    return {o.name:[v.co.copy() for v in o.evaluated_get(dep).data.vertices] for o in arm.children if o.type=='MESH'}
base=meshes();edges={o.name:[tuple(e.vertices) for e in o.data.edges] for o in arm.children if o.type=='MESH'}
report={}
scene=bpy.context.scene
camera=bpy.data.objects.new('Stress camera',bpy.data.cameras.new('Stress camera'))
scene.collection.objects.link(camera)
camera.location=(1.8,-4,1.9)
camera.rotation_euler=(Vector((0,0,.88))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=2.10;scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=384;scene.render.resolution_y=384;scene.render.resolution_percentage=100
out=root/'docs/assets/poses/lin'
out.mkdir(exist_ok=True,parents=True)
for name,moves in poses.items():
    for pb in arm.pose.bones:pb.matrix_basis=rest[pb.name]
    for stem,axis,deg in moves:
        names=[stem] if stem in arm.pose.bones else [stem+'_l',stem+'_r']
        for n in names:
            b=arm.pose.bones[n]
            unit=Vector(tuple(float(i==axis) for i in 'XYZ'))
            local=b.bone.matrix_local.to_quaternion().inverted()@unit
            mirror=-1 if n.endswith('_r') and axis in 'YZ' else 1
            b.rotation_quaternion=b.rotation_quaternion@Quaternion(local,math.radians(deg*mirror))
    bpy.context.view_layer.update()
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    posed=meshes();low=1;high=1;worst=None
    for part,verts in posed.items():
        for i,j in edges[part]:
            length=(base[part][i]-base[part][j]).length
            if length<.001:continue
            ratio=(verts[i]-verts[j]).length/length
            if ratio<low:low=ratio;worst=part
            high=max(high,ratio)
    def tree(part):
        poly=bpy.data.objects[part].data.polygons
        return BVHTree.FromPolygons(posed[part],[list(p.vertices) for p in poly])
    shirt=tree('Shirt')
    intersections={hand:len(tree(hand).overlap(shirt)) for hand in ('Mittenl','Mittenr','Thumbl','Thumbr')}
    report[name]=dict(handTorsoTrianglePairs=intersections,minEdgeRatio=low,maxEdgeRatio=high,mostCompressed=worst)
(root/'docs/audit/P4_lin_stress.json').write_text(json.dumps(report,indent=2),encoding='utf8')



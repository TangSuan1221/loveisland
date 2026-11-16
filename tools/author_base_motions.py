"""Author six base motions on the project's original Mixamo-layout source rig."""
import bpy,csv,math
from mathutils import Vector,Quaternion
from pathlib import Path
root=Path.cwd()
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
scene=bpy.context.scene
with (root/'runtime_spec/clips.csv').open(encoding='utf-8-sig') as f:
    clips={r['id']:r for r in csv.DictReader(f)}
def smooth(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def turn(joint,axis,degrees):
    pb=arm.pose.bones[joint]
    world=(arm.matrix_world@pb.bone.matrix_local).to_quaternion()
    pb.rotation_quaternion=pb.rotation_quaternion@Quaternion(world.inverted()@Vector(axis),math.radians(degrees))
for name in ('Idle_A','Walk_F','Run_F','Sit_Down','Sit_Idle','Stand_Up'):
    action=bpy.data.actions.new(name);action.use_fake_user=True;arm.animation_data.action=action
    frames=round(float(clips[name]['duration_s'])*30)
    for frame in range(frames+1):
        t=frame/frames;a=2*math.pi*t
        for pb in arm.pose.bones:
            pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
        seat=0
        if name=='Sit_Down':seat=smooth(t/.77)
        if name=='Stand_Up':seat=1-smooth(max(0,t-.08)/.92)
        if name=='Sit_Idle':seat=1
        walking=name in ('Walk_F','Run_F');run=name=='Run_F'
        vertical=-.36*seat
        if walking:vertical+=(.027 if run else .014)*(math.cos(2*a)-1)
        hips=arm.pose.bones['Hips']
        hips.location=(arm.matrix_world@hips.bone.matrix_local).to_3x3().inverted()@Vector((0,.18*seat,vertical))
        turn('Spine2',(1,0,0),-6*seat+(2 if walking else .85)*math.sin(a))
        for side,sign in [('Left',1),('Right',-1)]:
            swing=sign*math.sin(a) if walking else 0
            bend=(max(0,sign*math.cos(a))*(60 if run else 32)) if walking else 0
            turn(side+'UpLeg',(1,0,0),-88*seat-(40 if run else 26)*swing)
            turn(side+'Leg',(1,0,0),88*seat+bend+3*(1-seat))
            turn(side+'Foot',(1,0,0),-bend*.5)
            turn(side+'Arm',(1,0,0),-(30 if run else 18)*(-swing)-23*seat)
            turn(side+'Arm',(0,1,0),-sign*(24 if run else 7))
            turn(side+'ForeArm',(1,0,0),-(47 if run else 5)-27*seat)
        for pb in arm.pose.bones:
            if 'Hand' in pb.name and not pb.name.endswith('Hand'):continue
            pb.keyframe_insert('rotation_quaternion',frame=frame,group=pb.name)
        hips.keyframe_insert('location',frame=frame,group='Hips')
scene.render.fps=30;bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'build/retarget/BaseMotionSource.blend'))



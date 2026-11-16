"""Build editable Blender actions and bake local rotations for the Three.js review rig.
Run from project root: blender -b -P scripts/build-acting-samples.py
"""
import bpy, json, math
from mathutils import Vector, Quaternion, Euler
from pathlib import Path

root=Path.cwd()
ref=json.loads((root/'art/animation/rig-reference.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
data=bpy.data.armatures.new('Island 52')
arm=bpy.data.objects.new('Island cast reference',data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm
arm.select_set(True)
# Author in the same armature space as the game; orient the Blender object Z-up.
arm.rotation_euler.x=math.pi/2
bpy.ops.object.mode_set(mode='EDIT')
for row in ref:
    b=data.edit_bones.new(row['name'])
    b.head=Vector(row['head'])
    kids=[r for r in ref if r['parent']==row['name']]
    tail=Vector(kids[0]['head']) if kids else b.head+Vector((0,-.035,0))
    b.tail=tail if (tail-b.head).length>.001 else b.head+Vector((0,.04,0))
    if row['parent']: b.parent=data.edit_bones[row['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
arm.show_in_front=True
scene=bpy.context.scene
scene.frame_start=1;scene.frame_end=181;scene.render.fps=30
bones=arm.pose.bones
rest={b.name:b.matrix_local.to_quaternion() for b in data.bones}
def angles(x=0,y=0,z=0):
    return Euler(tuple(math.radians(i) for i in (x,y,z)),'XYZ').to_quaternion()
def rotate(name,q):
    basis=rest[name]
    bones[name].rotation_quaternion=basis.inverted() @ q @ basis
def align_arm(side,target,pole):
    names=[side+'Arm',side+'ForeArm',side+'Hand']
    shoulder=bones[names[0]].head.copy()
    parent=bones[names[0]].parent
    parent_delta=parent.matrix.to_quaternion() @ rest[parent.name].inverted()
    down=Vector((0,-1,0)); axis=(target-shoulder).normalized()
    l1=data.bones[names[0]].length;l2=data.bones[names[1]].length
    distance=min((target-shoulder).length,l1+l2-.001)
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    outward=pole-axis*pole.dot(axis)
    elbow=shoulder+axis*along+outward.normalized()*math.sqrt(max(0,l1*l1-along*along))
    upper=down.rotation_difference((elbow-shoulder).normalized())
    lower=down.rotation_difference((target-elbow).normalized())
    rotate(names[0],parent_delta.inverted() @ upper)
    rotate(names[1],upper.inverted() @ lower)
    # Fingers extend upward; the plane of each palm faces the camera.
    rotate(names[2],lower.inverted() @ angles(172,0,8 if side=='Left' else -8))
def export_clip(key,frames,author):
    arm.animation_data_clear()
    for f,values in frames:
        for p in bones:p.matrix_basis.identity();p.rotation_quaternion=Quaternion();p.location=(0,0,0)
        author(*values)
        for p in bones:p.keyframe_insert(data_path='rotation_quaternion',frame=f,group=p.name)
        bones['Hips'].keyframe_insert(data_path='location',frame=f,group='Hips')
    act=arm.animation_data.action;act.name=key;act.use_fake_user=True
    names=[r['name'] for r in ref]
    samples=[]
    for f in range(1,182,2):
        scene.frame_set(f)
        row=[]
        for info in ref:
            name=info['name'];basis=rest[name]
            q=basis @ bones[name].rotation_quaternion.normalized() @ basis.inverted()
            x,y,z,w=info['rest'];q=q @ Quaternion((w,x,y,z))
            row.append([round(v,5) for v in (q.x,q.y,q.z,q.w)])
        shift=bones['Hips'].head-data.bones['Hips'].head_local
        samples.append({'q':row,'p':[round(v,5) for v in shift]})
    (root/('src/motions/'+key+'.json')).write_text(json.dumps({'bones':names,'samples':samples,'duration':6},separators=(',',':')))
def shift(x,y,z):
    bones['Hips'].location=rest['Hips'].inverted() @ Vector((x,y,z))
def breathing(amount,sway):
    shift(.037*sway,-.018*abs(sway),0)
    rotate('Hips',angles(0,0,3*sway))
    rotate('Spine',angles(-5*amount,0,-3*sway))
    rotate('Spine2',angles(-4*amount,0,-2*sway))
    for side,sign in [('Left',1),('Right',-1)]:
        rotate(side+'Shoulder',angles(0,0,sign*(8*amount-3)))
        rotate(side+'Arm',angles(-6,0,sign*(9+4*amount)))
        rotate(side+'ForeArm',angles(-12))
        rotate(side+'UpLeg',angles(-5,0,-3*sway))
        rotate(side+'Leg',angles(9))
        rotate(side+'Foot',angles(-4))
def avoid(cover,twist,x,z,step):
    shift(x,-.032*cover,z)
    rotate('Hips',angles(0,twist*.48,0))
    rotate('Spine',angles(8*cover,twist*.28,-6*cover))
    rotate('Spine2',angles(4*cover,twist*.24,0))
    rotate('Neck',angles(33*cover,twist*.72,0))
    rotate('Head',angles(33*cover,twist*.70,-12*cover))
    for side,sign in [('Left',1),('Right',-1)]:
        rotate(side+'UpLeg',angles(-8*cover+sign*step*22,0,sign*step*13))
        rotate(side+'Leg',angles(8*cover+max(0,-sign*step)*31))
        rotate(side+'Shoulder',angles(-12*cover,0,sign*38*cover))
        rotate(side+'Arm',angles(-9,0,sign*11))
        rotate(side+'ForeArm',angles(-14 - 112*math.sin(math.pi*cover)))
    bpy.context.view_layer.update()
    if cover:
        head=bones['Head'].head.copy()
        for side,sign in [('Left',1),('Right',-1)]:
            target=head+Vector((.14+sign*.031,-.080+sign*.030,.155-sign*.055))
            orig=[bones[side+s].rotation_quaternion.copy() for s in ('Arm','ForeArm','Hand')]
            align_arm(side,target,Vector((sign,.28,.40)))
            for suffix,q in zip(('Arm','ForeArm','Hand'),orig):
                b=bones[side+suffix];b.rotation_quaternion=q.slerp(b.rotation_quaternion,cover)
            for i,digit in enumerate(['Index','Middle','Ring','Pinky']):
                rotate(side+'Hand'+digit+'1',angles(0,0,sign*(i-1.5)*9*cover))
def interview(nod,chop,lift):
    rotate('Hips',angles(0))
    rotate('Spine2',angles(-3+nod*4))
    rotate('Neck',angles(17*nod))
    rotate('Head',angles(23*nod))
    for side,sign in [('Right',-1),('Left',1)]:
        rotate(side+'Shoulder',angles(0,0,sign*(4+3*lift)))
        rotate(side+'Arm',angles(-7-lift*(23+9*chop),sign*lift*7,sign*(6+10*lift)))
        rotate(side+'ForeArm',angles(-8-lift*(68+30*chop),sign*lift*15,0))
        rotate(side+'Hand',angles(lift*(8-27*chop),sign*lift*(29+8*chop),sign*lift*(9+8*chop)))
        for finger in ['Index','Middle','Ring','Pinky']:
            rotate(side+'Hand'+finger+'1',angles(-5*lift))
interview_keys=[(1,(0,0,0)),(21,(0,0,0))]
for start in [22,39,56]:
    interview_keys.extend([(start+5,(1,0,0)),(start+12,(-.18,0,0))])
interview_keys.extend([(73,(0,0,.3)),(83,(.05,1,1))])
for start in [84,108,132]:
    interview_keys.extend([(start+6,(.24,-1,1)),(start+10,(.24,-1,1)),(start+19,(0,.86,1))])
interview_keys.extend([(166,(.1,0,.35)),(181,(0,0,0))])
export_clip('A26',interview_keys,interview)
export_clip('A01',[(1,(0,-.55)),(30,(1,-.75)),(67,(0,.66)),(101,(1,.82)),(143,(0,-.20)),(181,(0,-.55))],breathing)
export_clip('A27',[(1,(0,0,0,0,0)),(26,(0,0,0,0,0)),(30,(.18,12,0,0,0)),(39,(1,34,0,-.02,0)),(49,(1,42,.03,-.06,-.55)),(59,(1,48,.12,-.15,.7)),(71,(1,51,.22,-.28,-.75)),(83,(1,53,.28,-.38,.58)),(97,(1,52,.32,-.42,0)),(130,(1,50,.32,-.42,0)),(160,(.58,54,.32,-.42,0)),(181,(.16,58,.32,-.42,0))],avoid)
def dancing(beat, invite, weight):
    shift(.11*weight,-.045*abs(weight),0)
    rotate('Hips',angles(0,9*weight,5*weight))
    rotate('Spine2',angles(3,-14*weight,-7*weight))
    for side,sign in [('Left',1),('Right',-1)]:
        phase=beat*sign
        reach=invite if side=='Right' else 0
        rotate(side+'Arm',angles(-24-15*phase-18*reach,sign*9,sign*(22+12*phase+12*reach)))
        rotate(side+'ForeArm',angles(-62-38*phase+18*reach,sign*(12+32*reach),0))
        rotate(side+'Hand',angles(-4+24*phase,sign*(22*phase+30*reach),sign*(10*phase+9*reach)))
        rotate(side+'UpLeg',angles(-10-9*phase,0,sign*4*weight))
        rotate(side+'Leg',angles(19+13*phase))
        rotate(side+'Foot',angles(-9-4*phase))
def dance_keys(follower):
    keys=[(1,(0,0,0)),(16,(0,0,0) if follower else (-.65,.8,-.25)),(31,(0,0,0) if follower else (-.85,1,-.4))]
    for i in range(9):
        sign=1 if i%2==0 else -1
        frame=42+i*14+(7 if follower and i<3 else 0)
        keys.append((frame,(sign,0,.88*sign)))
    return keys+[(174,(.28,0,.22)),(181,(0,0,0))]
export_clip('play-lead',dance_keys(False),dancing)
export_clip('play-follow',dance_keys(True),dancing)
scene.frame_set(42)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art/animation/island-acting.blend'))

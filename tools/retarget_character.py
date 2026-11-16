"""Bake a world-space retarget into a cast blend. Ground and seat heights in metres.
Input actions are read-only. Contacts are [side,start,end] in target 30fps frames.
"""
import argparse, csv, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector, Quaternion, Matrix

def read_map(path,kind,src,dst):
    pairs={}
    with open(path,encoding='utf-8-sig') as stream:
        for r in csv.DictReader(stream):
            if r['source_format']!=kind:continue
            name=r['source_bone'];target=r['target_bone']
            variants=[(name,target)]
            if target.endswith('_l'):
                variants.append((name.replace('Left','Right').replace('_L_','_R_'),target[:-1]+'r'))
            for n,t in variants:
                match=next((b.name for b in src.data.bones if b.name.replace('mixamorig:','').replace('mixamorig','')==n.replace('mixamorig:','').replace('mixamorig','')),None)
                if match and t in dst.pose.bones:pairs[t]=match
                elif r['required']=='yes':raise ValueError(f'Missing {n} -> {t}')
    if not pairs:raise ValueError(f'Empty {kind} mapping')
    return pairs

def direction(frame,head,forward):
    up=(frame@Vector(head)).normalized();front=frame@Vector(forward)
    front=(front-up*up.dot(front)).normalized()
    right=front.cross(up).normalized()
    return Matrix((right,front,up)).transposed().to_quaternion()

def bake(src,dst,action,pairs,start,end,rate,contacts,forward,up):
    scene=bpy.context.scene
    if start>end or rate<=0:raise ValueError('Invalid time range or source rate')
    for c in contacts:
        if c[0] not in ('l','r') or c[1]>c[2]:raise ValueError(f'Invalid contact {c}')
    def source_point(key):return src.matrix_world@src.data.bones[pairs[key]].head_local
    vertical=(source_point('head')-source_point('hips')).normalized()
    lateral=(source_point('thigh_l')-source_point('thigh_r')).normalized()
    anterior=lateral.cross(vertical).normalized()
    basis=direction(Quaternion(),vertical,anterior)
    target_basis=direction(dst.matrix_world.to_quaternion(),(0,0,1),(0,-1,0))
    align=target_basis@basis.inverted()
    rests={b.name:b.matrix.copy() for b in dst.pose.bones}
    src_rest={n:src.matrix_world@src.data.bones[n].matrix_local for n in pairs.values()}
    next_segment={'upperarm':'lowerarm','lowerarm':'hand','thigh':'calf','calf':'foot'}
    corrections={}
    for joint,source in pairs.items():
        stem,_,side=joint.rpartition('_')
        child=next_segment.get(stem,'')+'_'+side
        if child not in pairs:continue
        # Node rotation axes in glTF are arbitrary. The rest displacement
        # between adjacent anatomical joints is invariant under a bone roll.
        source_axis=align@(src_rest[pairs[child]].translation-src_rest[source].translation)
        target_axis=dst.matrix_world.to_3x3()@(rests[child].translation-rests[joint].translation)
        if min(source_axis.length,target_axis.length)>1e-6:
            corrections[joint]=target_axis.normalized().rotation_difference(source_axis.normalized())
    hips=pairs['hips']
    source_foot=src_rest[pairs['foot_l']].translation
    source_leg=(src_rest[hips].translation-source_foot).dot(vertical)
    scale=(rests['hips'].translation.z-rests['foot_l'].translation.z)/source_leg
    initial={b.name:b.matrix_basis.copy() for b in dst.pose.bones}
    src.animation_data_create().action=action
    dst.animation_data_create()
    output=bpy.data.actions.new(action.name+'_30fps')
    dst.animation_data.action=output
    active={};previous={};first_contact={}
    frames=round((end-start)*30/rate)+1
    if any(c[1]<0 or c[2]>=frames for c in contacts):raise ValueError('Contact outside clip')
    for i in range(frames):
        source_t=min(end,start+i*rate/30)
        scene.frame_set(math.floor(source_t),subframe=source_t%1)
        for pb in dst.pose.bones:pb.matrix_basis=initial[pb.name]
        bpy.context.view_layer.update()
        for pb in dst.pose.bones:
            if pb.name not in pairs:continue
            name=pairs[pb.name];sample=src.matrix_world@src.pose.bones[name].matrix
            delta=sample.to_quaternion()@src_rest[name].to_quaternion().inverted()
            delta=align@delta@align.inverted()
            local_world=dst.matrix_world.to_quaternion()
            target_rest=local_world@rests[pb.name].to_quaternion()
            axis_correction=corrections.get(pb.name,Quaternion())
            if pb.name.startswith('hand_'):
                axis_correction=corrections.get('lowerarm_'+pb.name[-1],axis_correction)
            rot=local_world.inverted()@delta@axis_correction@target_rest
            if pb.name=='hips':
                move=align@(sample.translation-src_rest[name].translation)*scale
                loc=rests[pb.name].translation+dst.matrix_world.to_3x3().inverted()@move
            else:
                parent=pb.parent
                loc=(parent.matrix@rests[parent.name].inverted()@rests[pb.name]).translation if parent else rests[pb.name].translation
            pb.matrix=Matrix.LocRotScale(loc,rot,Vector((1,1,1)))
            bpy.context.view_layer.update()
        for side in ('l','r'):
            pb=dst.pose.bones['calf_'+side]
            ik=next((c for c in pb.constraints if c.type=='IK'),None)
            if ik is None:raise ValueError('Missing leg IK')
            contact=next((c for c in contacts if c[0]==side and c[1]<=i<=c[2]),None)
            ik.influence=0;bpy.context.view_layer.update()
            # Test the sole ring in the evaluated pose, including shoe length.
            shoe=bpy.data.objects.get('Shoe'+side)
            clearance_error=0
            if shoe:
                evaluated=shoe.evaluated_get(bpy.context.evaluated_depsgraph_get())
                clearance_error=max(0,-min((evaluated.matrix_world@v.co).z for v in evaluated.data.vertices)+.00001)
            if contact or clearance_error:
                if side not in active:
                    foot=dst.pose.bones['foot_'+side]
                    anchor=dst.matrix_world@foot.head
                    # Keep the full sole tangent to the contact plane throughout support.
                    plane=contact[3] if contact and len(contact)>3 else {}
                    normal=Vector(plane.get('normal',[0,0,1])).normalized()
                    ground=Vector(plane.get('point',[0,0,0]))
                    clearance=rests[foot.name].translation.z
                    anchor+=normal*((clearance+.00001-(anchor-ground).dot(normal)) if contact else clearance_error)
                    rot=Vector((0,0,1)).rotation_difference(normal)@rests[foot.name].to_quaternion()
                    if not contact:rot=foot.matrix.to_quaternion()
                    if contact and i==0:first_contact[side]=(anchor.copy(),rot.copy())
                    if contact and contact[2]==frames-1 and side in first_contact:
                        anchor,rot=first_contact[side]
                    active[side]=(anchor,rot)
                anchor,rot=active[side];ik.target.location=anchor;ik.influence=1
                bpy.context.view_layer.update()
                solved=[(dst.pose.bones[n+'_'+side],dst.pose.bones[n+'_'+side].matrix.copy()) for n in ('thigh','calf','foot')]
                ik.influence=0
                for joint,m in solved:
                    if joint.name=='foot_'+side:
                        m=Matrix.LocRotScale(dst.matrix_world.inverted()@anchor,rot,Vector((1,1,1)))
                    joint.matrix=m;bpy.context.view_layer.update()
            if not contact:active.pop(side,None)
        for pb in dst.pose.bones:
            if not pb.bone.use_deform:continue
            q=pb.rotation_quaternion.copy()
            if pb.name in previous:q.make_compatible(previous[pb.name])
            pb.rotation_quaternion=q;previous[pb.name]=q
            pb.keyframe_insert('rotation_quaternion',frame=i,group=pb.name)
            pb.keyframe_insert('location',frame=i,group=pb.name)
    scene.render.fps=30
    return output


def main(argv):
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',required=True,type=Path)
    parser.add_argument('--format',required=True,choices=['mixamo','vrm1'])
    parser.add_argument('--action',required=True)
    parser.add_argument('--map',default='runtime_spec/retarget_map.csv')
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--contacts',type=json.loads,default=[])
    parser.add_argument('--source-fps',type=float)
    args=parser.parse_args(argv)
    dst=bpy.data.objects['RIG_Base']
    old_objects=set(bpy.data.objects)
    if args.source.suffix.lower()=='.blend':
        with bpy.data.libraries.load(str(args.source.resolve())) as (avail,load):
            load.objects=list(avail.objects)
            if args.action not in avail.actions:raise ValueError('Action not in blend')
            load.actions=[args.action]
        for obj in load.objects:bpy.context.scene.collection.objects.link(obj)
        action=load.actions[0]
    else:
        old_actions=set(bpy.data.actions)
        if args.source.suffix.lower()=='.fbx':bpy.ops.import_scene.fbx(filepath=str(args.source.resolve()))
        elif args.source.suffix.lower()=='.vrma':
            import tempfile, importlib.util
            module=importlib.util.spec_from_file_location('vrma_source',Path(__file__).with_name('vrma_source.py'))
            adapter=importlib.util.module_from_spec(module);module.loader.exec_module(adapter)
            args.out.parent.mkdir(exist_ok=True,parents=True)
            with tempfile.TemporaryDirectory(dir=args.out.parent) as directory:
                converted=Path(directory)/'vrma.glb'
                adapter.prepare(args.source,converted,args.action)
                bpy.ops.import_scene.gltf(filepath=str(converted),bone_heuristic='BLENDER')
        elif args.source.suffix.lower() in ('.vrm','.glb','.gltf'):bpy.ops.import_scene.gltf(filepath=str(args.source.resolve()))
        else:raise ValueError('Expected blend, FBX or animated glTF/VRM')
        action=next(a for a in set(bpy.data.actions)-old_actions if a.name==args.action)
    incoming=set(bpy.data.objects)-old_objects
    src,=[o for o in incoming if o.type=='ARMATURE']
    bpy.context.view_layer.update()
    pairs=read_map(args.map,args.format,src,dst)
    out=bake(src,dst,action,pairs,*action.frame_range,args.source_fps or bpy.context.scene.render.fps,args.contacts,(0,-1,0),(0,0,1))
    out.use_fake_user=True
    for obj in incoming:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.context.scene.frame_set(0)
    args.out.parent.mkdir(exist_ok=True,parents=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.out.resolve()))

if __name__=='__main__':main(sys.argv[sys.argv.index('--')+1:])





"""Assemble cast T-pose assets with explicit anatomical weight regions."""
import bpy, csv, json, math, pathlib
from mathutils import Vector
from math import sin, cos, pi
root=pathlib.Path.cwd()
def table(name):
    with (root/'runtime_spec'/name).open(encoding='utf-8-sig') as f:return list(csv.DictReader(f))
presets={r['id']:{k:float(v) for k,v in r.items() if k not in ('id','label')} for r in table('proportions.csv')}
base=presets['adult_m']
reference=presets['adult_f']
def material(label,hexcolor):
    m=bpy.data.materials.new(label)
    def linear(i):
        c=int(hexcolor[i:i+2],16)/255
        return ((c+.055)/1.055)**2.4 if c>.04045 else c/12.92
    m.diffuse_color=(*(linear(i) for i in (0,2,4)),1)
    return m
def bind(o,arm,weights):
    o.parent=arm
    mod=o.modifiers.new('Character skin','ARMATURE');mod.object=arm;mod.use_deform_preserve_volume=True
    for i,v in enumerate(o.data.vertices):
        for name,w in weights(o.matrix_world@v.co).items():
            if w<=0:continue
            group=o.vertex_groups.get(name)
            if group is None:group=o.vertex_groups.new(name=name)
            group.add([i],w,'REPLACE')
def shell(arm,name,mat,rings,weights):
    n=32;verts=[ring(a*2*pi/n) for ring in rings for a in range(n)]
    faces=[(i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j) for i in range(len(rings)-1) for j in range(n)]
    faces += [tuple(reversed(range(n))),tuple(range(len(verts)-n,len(verts)))]
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);data.materials.append(mat)
    for f in data.polygons:f.use_smooth=True
    bind(o,arm,weights)
def chain(u,names,cuts,band):
    for i,c in enumerate(cuts):
        if u<c-band:return {names[i]:1}
        if u<c+band:
            t=(u-c+band)/(2*band);t=t*t*(3-2*t)
            return {names[i]:1-t,names[i+1]:t}
    return {names[-1]:1}
def ring(z,w,d,x=0,y=0):
    return lambda a:(x+w*.5*cos(a),y+d*.5*sin(a),z)
tops=['a66f5c','6f7d6d','89768b','607687','b09766','9b6c5d','866474','47566c','b28d4b','55777a','8e6f5d','8b8791']
for idx,character in enumerate(table('characters.csv')):
    id=character['id'];p=presets[character['preset']]
    bpy.ops.wm.open_mainfile(filepath=str(root/'build/RIG_Base.blend'))
    arm=bpy.data.objects['RIG_Base']
    source_armature=arm.data.copy()
    # Interpolate canonical vertical stations to preserve anatomical rest landmarks.
    stations=['ankleH','kneeH','hipH','shoulderH']
    heights=[(0,0)]+[(base[k],p[k]) for k in stations]+[(base['H']-base['HH'],p['H']-p['HH']),(base['H'],p['H'])]
    def zmap(z):
        for (a,x),(b,y) in zip(heights,heights[1:]):
            if z<=b:return x+(z-a)*(y-x)/(b-a)
        return z*p['H']/base['H']
    def remap(v):
        x,y,z=v
        if abs(x)>=.097 and abs(z-base['shoulderH'])<.085:
            x=math.copysign(.098*p['SW']/base['SW']+(abs(x)-.098)*p['HH']/base['HH'],x)
        else:x*=p['HW']/base['HW']
        return Vector((x,y*p['HD']/base['HD'],zmap(z)))
    bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
    for eb in arm.data.edit_bones:eb.head,eb.tail=remap(eb.head),remap(eb.tail)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in bpy.context.scene.objects:
        if o.type=='EMPTY':o.location=remap(o.location)
    with bpy.data.libraries.load(str(root/'build/CHR_Head_lin.blend')) as (src,dst):
        dst.objects=[n for n in src.objects if n!='shoulder_neck_study']
    for o in dst.objects:
        bpy.context.scene.collection.objects.link(o)
        bpy.context.view_layer.update()
        m=o.matrix_world.copy();o.data=o.data.copy()
        for v in o.data.vertices:
            x,y,z=m@v.co;v.co=(x*p['HW']/reference['HW'],y*p['HD']/reference['HD'],p['H']-p['HH']+(z-reference['H']+reference['HH'])*p['HH']/reference['HH'])
        o.matrix_world.identity();from mathutils import Matrix
        o.matrix_world=Matrix.Identity(4);bind(o,arm,lambda v:{'head':1})
    cloth=material(' shirt '+id,tops[idx]);pants=material('trousers','495654');skin=next(o.data.materials[0] for o in dst.objects if o.name.startswith('CHR_Head'))
    hip=p['hipH'];sh=p['shoulderH'];waist=hip+.28*(sh-hip);chest=hip+.76*(sh-hip)
    shell(arm,'Shirt',cloth,[ring(z,w,d) for z,w,d in [(hip,p['hipW'],p['hipD']),(waist,p['waistW'],p['waistD']),(chest,p['chestW'],p['chestD']),(sh-.016,p['SW'],p['chestD']*.84),(sh,p['neckR']*2,p['neckR']*1.7)]],lambda v:chain(v.z,['hips','spine_01','spine_02','chest'],[hip+.06,waist+.025,chest-.04],.035))
    shell(arm,'Waistband',pants,[ring(hip-.074,p['hipW']*.96,p['hipD']*.96),ring(hip-.014,p['hipW']*1.02,p['hipD']*1.02),ring(hip+.015,p['hipW'],p['hipD'])],lambda v:{'hips':1})
    shell(arm,'Neck',skin,[ring(sh-.008,p['neckR']*1.85,p['neckR']*1.7),ring(p['H']-p['HH']+.035,p['neckR']*1.8,p['neckR']*1.6)],lambda v:{'neck':1})
    for s,side in [(1,'l'),(-1,'r')]:
        bone=lambda n:arm.data.bones[n+'_'+side]
        x0=abs(bone('upperarm').head_local.x);x1=abs(bone('lowerarm').head_local.x);x2=abs(bone('hand').head_local.x)
        def aring(x,d,t):return lambda a:(s*x,t*.5*cos(a),sh-.028*max(0,1-(x-x0)/.12)+d*.5*sin(a))
        for name,mat,rows in [('Sleeve',cloth,[(x0-.050,.042,.066),(x0+.004,p['armDiaU']*.84,p['armDiaU']),(x0+.1,p['armDiaU']*.86,p['armDiaU']*.88)]),('Arm',skin,[(x0+.085,p['armDiaU']*.81,p['armDiaU']*.81),(x1-.024,p['armDiaL'],p['armDiaL']),(x1,p['armDiaL']*.89,p['armDiaL']*.89),(x1+.024,p['armDiaL'],p['armDiaL']),(x2,p['wristDia'],p['wristDia'])])]:
            shell(arm,name+side,mat,[aring(*r) for r in rows],lambda v:chain(abs(v.x),['upperarm_'+side,'lowerarm_'+side],[x1],.085))
        shell(arm,'Mitten'+side,skin,[aring(x2,p['wristDia'],p['wristDia']),aring(x2+.45*p['handL'],p['handT'],p['handW']),aring(x2+.88*p['handL'],p['handT']*.8,p['handW']*.86),aring(x2+p['handL'],p['handT']*.35,p['handW']*.52)],lambda v:{'hand_'+side:1})
        bx=bone('thumb').head_local
        shell(arm,'Thumb'+side,skin,[ring(bx.z-.039,.028,.031,bx.x+s*.018,-.022),ring(bx.z,.036,.038,bx.x,-.024)],lambda v:{'thumb_'+side:1})
        lx=bone('thigh').head_local.x;knee=p['kneeH'];ankle=p['ankleH']
        shell(arm,'TrouserLeg'+side,pants,[ring(z,w,w*.95,lx) for z,w in [(ankle,p['ankleDia']),(knee-.075,p['calfDia']),(knee,p['calfDia']*.85),(knee+.08,p['thighDia']*.81),(hip+.018,p['thighDia'])]],lambda v:chain(v.z,['calf_'+side,'thigh_'+side],[knee],.05))
        shell(arm,'Shoe'+side,pants,[ring(z,p['footW']*w,p['footL']*d,lx,-p['footL']*off) for z,w,d,off in [(0,.88,.94,.27),(.025,1,1,.27),(.055,.98,.93,.24),(ankle,.78,.50,.05)]],lambda v:{'foot_'+side:1})
    # Deliver the same canonical bind skeleton on every preset. Rest translation
    # belongs to the pose. Bake the inverse blended bind correction into the mesh.
    from mathutils import Matrix
    targets={b.name:b.matrix_local.copy() for b in arm.data.bones}
    arm.data=source_armature
    for pb in arm.pose.bones:
        if pb.parent:
            old=pb.parent.bone.matrix_local.inverted()@pb.bone.matrix_local
            new=targets[pb.parent.name].inverted()@targets[pb.name]
            pb.matrix_basis=old.inverted()@new
        else:pb.matrix_basis=pb.bone.matrix_local.inverted()@targets[pb.name]
    for pb in arm.pose.bones:
        for c in pb.constraints:
            if c.type=='IK':c.influence=0
    bpy.context.view_layer.update()
    transforms={b.name:arm.pose.bones[b.name].matrix@b.matrix_local.inverted() for b in arm.data.bones}
    for obj in arm.children:
        if obj.type!='MESH':continue
        for v in obj.data.vertices:
            blend=Matrix(((0,0,0,0),)*4)
            for g in v.groups:blend+=transforms[obj.vertex_groups[g.group].name]*g.weight
            v.co=blend.inverted_safe()@v.co
    arm['preset']=character['preset']
    bpy.context.scene.render.fps=30;bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'build'/('CHR_'+id+'.blend')))





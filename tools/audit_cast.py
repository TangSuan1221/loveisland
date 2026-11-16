"""Audit canonical bind data and evaluated, preset-sized anatomical meshes."""
import bpy,csv,json,math
from pathlib import Path
from mathutils import Vector
root=Path.cwd()
with (root/'runtime_spec/bones.csv').open(encoding='utf-8-sig') as f:bones=list(csv.DictReader(f))
with (root/'runtime_spec/characters.csv').open(encoding='utf-8-sig') as f:cast=list(csv.DictReader(f))
limits=[(.18,.22),(.95,1.15),(1.05,1.25),(.65,.80),(.68,.82),(.85,1),(.34,.40),(.44,.50),(.34,.46),(.50,.62)]
def bounds(vs):
    return [(min(v[i] for v in vs),max(v[i] for v in vs)) for i in range(3)]
def dim(vs,i):
    a,b=bounds(vs)[i];return b-a
for row in cast:
    id=row['id'];bpy.ops.wm.open_mainfile(filepath=str(root/'build'/f'CHR_{id}.blend'))
    arm=bpy.data.objects['RIG_Base'];graph=bpy.context.evaluated_depsgraph_get()
    checks={};points={};maxw=zero=bad=cross=0
    for o in arm.children:
        if o.type!='MESH':continue
        ev=o.evaluated_get(graph);points[o.name]=[ev.matrix_world@v.co for v in ev.data.vertices]
        for v in o.data.vertices:
            weights=[g.weight for g in v.groups if g.weight>0];names=[o.vertex_groups[g.group].name for g in v.groups if g.weight>0]
            maxw=max(maxw,len(weights));zero+=not weights;bad+=abs(sum(weights)-1)>.001
            cross+=any(n.endswith('_l') for n in names) and any(n.endswith('_r') for n in names)
    for r in bones:
        b=arm.data.bones[r['name']]
        for key,got in [('head',b.head_local),('tail',b.tail_local)]:
            assert (got-Vector([float(r[key+'_'+i]) for i in 'xyz'])).length<.0001
        assert (b.parent.name if b.parent else '')==r['parent']
    checks['deform']=sum(b.use_deform for b in arm.data.bones)
    checks['weights']=dict(max=maxw,zero=zero,badSum=bad,cross=cross)
    head=points['CHR_Head_lin'];nose=points['nose'];shirt=points['Shirt'];palm=points['Mittenl'];foot=points['Shoel']
    hh=dim(head,2);hw=dim(head,0);H=max(v.z for v in head)-min(v.z for v in foot)
    def width(row):return dim(shirt[row*32:(row+1)*32],0)
    hip=arm.pose.bones['thigh_l'].head;ankle=arm.pose.bones['foot_l'].head
    reach=max(v.x for v in palm)-arm.pose.bones['upperarm_l'].head.x
    ratios=[hh/H,width(3)/hw,dim(head+nose,1)/hw,dim(shirt[64:96],1)/width(2),width(1)/width(2),width(0)/width(2),reach/H,(hip.z-ankle.z)/H,dim(palm,0)/hh,dim(foot,1)/hh]
    checks['ratios']=[dict(id=f'A{i+1}',value=v,passed=a<=v<=b) for i,(v,(a,b)) in enumerate(zip(ratios,limits))]
    checks['soleZ']=min(v.z for v in foot);checks['heads']=H/hh
    report=root/'docs/audit'/f'CHR_{id}_audit.json'
    report.write_text(json.dumps(checks,indent=2),encoding='utf8')
    print(id,checks['heads'],[r for r in checks['ratios'] if not r['passed']],checks['weights'])

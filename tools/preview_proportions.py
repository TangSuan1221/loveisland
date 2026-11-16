import bpy, csv, json, math
from pathlib import Path
from mathutils import Vector

ROOT = Path.cwd()
def read(name):
    with (ROOT/'runtime_spec'/name).open(encoding='utf-8-sig') as stream:
        return list(csv.DictReader(stream))

def ball(name, location, dimensions, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=location)
    obj=bpy.context.object
    obj.name=name
    obj.dimensions=dimensions
    obj.color=(*color,1)
    for poly in obj.data.polygons: poly.use_smooth=True
    return obj

def save(name):
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'build'/name))

def proportions(p):
    return [p['HH']/p['H'],p['SW']/p['HW'],p['HD']/p['HW'],p['chestD']/p['chestW'],
            p['waistW']/p['chestW'],p['hipW']/p['chestW'],sum(p[k] for k in ('armU','armL','handL'))/p['H'],
            (p['hipH']-p['ankleH'])/p['H'],p['handL']/p['HH'],p['footL']/p['HH']]

def capsule(name,a,b,diameter):
    direction=Vector(b)-Vector(a)
    obj=ball(name,(Vector(a)+Vector(b))*.5,(diameter,diameter,direction.length),(.25,.45,.41))
    obj.rotation_euler=direction.to_track_quat('Z','Y').to_euler()

def preview():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    limits=[(.18,.22),(.95,1.15),(1.05,1.25),(.65,.80),(.68,.82),(.85,1),(.34,.40),(.44,.50),(.34,.46),(.50,.62)]
    report={}
    for i,row in enumerate(read('proportions.csv')):
        p={k:float(v) for k,v in row.items() if k not in ('id','label')}
        name=row['id']; x=(i-2)*1.7
        ratios=proportions(p)
        report[name]=dict(ratios=ratios,heads=p['H']/p['HH'])
        if name in ('adult_f','adult_m','tall_m'):
            assert all(a<=v<=b for v,(a,b) in zip(ratios,limits)),name
        ball(name+'.head',(x,0,p['H']-p['HH']/2),(p['HW'],p['HD'],p['HH']),(.75,.52,.38))
        for key,z,h in [('chest',p['shoulderH']-.06,.20),('waist',p['hipH']+.13,.22),('hip',p['hipH'],.16)]:
            ball(name+'.'+key,(x,0,z),(p[key+'W'],p[key+'D'],h),(.36,.5,.45))
        for s in (-1,1):
            start=x+s*p['SW']/2
            for length,width in [('armU','armDiaU'),('armL','armDiaL'),('handL','handW')]:
                end=start+s*p[length];capsule(length,(start,0,p['shoulderH']),(end,0,p['shoulderH']),p[width]);start=end
            lx=x+s*p['hipW']/4
            for top,bottom,width in [('hipH','kneeH','thighDia'),('kneeH','ankleH','calfDia')]:
                capsule(width,(lx,0,p[top]),(lx,0,p[bottom]),p[width])
            ball('foot',(lx,-p['footL']/4,p['ankleH']/2),(p['footW'],p['footL'],p['ankleH']),(.32,.23,.18))
    save('CHR_ProportionPreview.blend')
    (ROOT/'docs/audit/P1_proportions.json').write_text(json.dumps(report,indent=2),encoding='utf8')
preview()

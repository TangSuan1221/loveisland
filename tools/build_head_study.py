"""Build the profile study in metres, Z up, looking down -Y."""
import bpy, csv, math, json, sys
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi, exp

root=Path.cwd()
with (root/'runtime_spec/proportions.csv').open(encoding='utf-8-sig') as f:
    row=next(r for r in csv.DictReader(f) if r['id']=='adult_f')
hh,hw,hd=[float(row[k]) for k in ('HH','HW','HD')]
chin=float(row['H'])-hh
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.world=bpy.data.worlds.new('Studio')
palette={'skin':(.64,.39,.26),'ink':(.075,.039,.028),'white':(.93,.86,.72),'iris':(.10,.32,.28),'hair':(.17,.078,.045),'locks':(.23,.11,.06),'lip':(.38,.13,.09),'ear':(.48,.24,.17)}
materials={}
for key,color in palette.items():
    m=bpy.data.materials.new(key); m.diffuse_color=(*color,1); materials[key]=m
def mesh(name,verts,faces,color):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);data.materials.append(materials[color])
    for face in data.polygons: face.use_smooth=True
    return obj
def grid(name,rows,color):
    cols=len(rows[0]);faces=[]
    for r in range(len(rows)-1):
        for c in range(cols-1):
            i=r*cols+c;faces.append((i,i+1,i+1+cols,i+cols))
    return mesh(name,[v for row in rows for v in row],faces,color)
def oval(name,location,size,color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=location)
    o=bpy.context.object;o.name=name;o.dimensions=size;o.data.materials.append(materials[color])
    for face in o.data.polygons:face.use_smooth=True
    return o
# Section heights, half-width, anterior and posterior profile relative to HW.
sections=[(0,.015,.10,.09),(.08,.23,.20,-.12),(.10,.31,.23,-.18),(.18,.40,.31,-.52),(.22,.43,.34,-.55),(.28,.45,.38,-.58),(.32,.46,.38,-.60),(.42,.48,.40,-.63),(.47,.49,.415,-.64),(.56,.50,.40,-.648),(.62,.50,.42,-.65),(.74,.48,.40,-.60),(.84,.42,.30,-.49),(.93,.29,.18,-.34),(1,.001,-.05,-.051)]
def profile(y):
    for a,b in zip(sections,sections[1:]):
        if y<=b[0]:
            t=max(0,(y-a[0])/(b[0]-a[0]));return [a[i]+t*(b[i]-a[i]) for i in (1,2,3)]
    return sections[-1][1:]
def point(y,t,lift=0):
    rad,front,back=profile(y);x=rad*sin(t);depth=(front+back)/2+(front-back)/2*cos(t)
    if cos(t)>0: depth-=.032*exp(-((abs(t)-.60)/.32)**2-((y-.56)/.075)**2)
    return (x*hw+lift*sin(t),-depth*hw-lift*cos(t),chin+y*hh)
def ring(y):return [point(y,2*pi*i/96) for i in range(97)]
grid('CHR_Head_lin', [ring(y) for y in sorted(set([p[0] for p in sections]+[i/64 for i in range(65)]))],'skin')
oval('nose',(0,-.423*hw,chin+.465*hh),(.17*hw,2*(hd-.65*hw-.423*hw),.14*hh),'skin')
def patch(name,cx,cy,ax,ay,color,lift):
    rows=[]
    for j in range(13):
        k=(j-6)/6
        rows.append([point(cy+ay*k,cx+ax*sin(pi*(i/32-.5))*math.sqrt(max(.0001,1-k*k)),lift+.0015*(1-k*k)*sin(pi*i/32)) for i in range(33)])
    grid(name,rows,color)
for s,side in [(-1,'r'),(1,'l')]:
    angle=s*.68
    oval('ear_'+side,(s*.493*hw,.025,chin+.49*hh),(.20*hw,.18*hw,.22*hh),'skin')
    oval('ear_fold_'+side,(s*.581*hw,.025,chin+.49*hh),(.035*hw,.095*hw,.12*hh),'ear')
    patch('socket_'+side,angle,.56,.55,.081,'ink',.0004)
    patch('eye_'+side,angle,.56,.53,.069,'white',.0012)
    patch('iris_'+side,angle,.56,.13,.049,'iris',.003)
    patch('pupil_'+side,angle,.56,.062,.03,'ink',.005)
    patch('glint_'+side,angle-.045,.58,.022,.012,'white',.006)
    patch('lid_'+side,angle,.615,.45,.021,'skin',.003)
    patch('brow_'+side,angle,.667,.43,.016,'ink',.003)
patch('mouth',0,.28,.29,.012,'lip',.002)
for name,start,end,color in [('cap',-pi,pi,'hair'),('fringe',-1.1,1.1,'locks'),('back',1.20,2*pi-1.20,'hair')]:
    rows=[]
    for j in range(25):
        pts=[]
        for i in range(81):
            t=start+(end-start)*i/80
            low=(.76+.03*sin(2*t)) if name=='cap' else ((.73+.065*sin(2.5*t)) if name=='fringe' else .24+.30*max(0,cos(t)))
            y=low+(.998-low)*j/24
            x,d,z=point(y,t,.010 if name=='cap' else .014)
            pts.append((x,d,z+.006*j/24))
        rows.append(pts)
    grid(name,rows,color)
# Include neck and shoulder landmarks in the study to judge the jaw clearance.
neck_len=float(row['neckLen'])
shoulder_width=float(row['SW'])
levels=[(chin-neck_len-.05,shoulder_width*.44,.077),(chin-neck_len-.022,shoulder_width*.50,.076),(chin-neck_len,hw*.20,.061),(chin+.025,hw*.19,.054)]
grid('shoulder_neck_study', [[(rx*sin(i*pi/48),.015-ry*cos(i*pi/48),height) for i in range(97)] for height,rx,ry in levels],'skin')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'build/CHR_Head_lin.blend'))


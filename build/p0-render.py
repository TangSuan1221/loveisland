import bpy,json,runpy,sys,pathlib
root=pathlib.Path.cwd()
audit_path=root/'docs/audit/CHR_Current_audit.json'
audit=json.loads(audit_path.read_text(encoding='utf8'))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
audit['sourceBones']=[dict(name=b.name,parent=b.parent.name if b.parent else None,length=b.length) for b in arm.data.bones]
audit['sourceActions']=[a.name for a in bpy.data.actions]
audit_path.write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
for p in json.loads((root/'build/p0-parts.tmp').read_text()):
 m=bpy.data.meshes.new(p['name']);i=p['i'];m.from_pydata(p['v'],[],list(zip(i[::3],i[1::3],i[2::3])));m.update()
 o=bpy.data.objects.new(p['name'],m);bpy.context.collection.objects.link(o)
 mat=bpy.data.materials.new('color');mat.diffuse_color=(*p['c'],1);m.materials.append(mat)
 for face in m.polygons:face.use_smooth=True
out=root/'docs/assets/turntable'
sys.argv=['render','--','--out',str(out),'--res','512','--frames','8']
runpy.run_path(str(root/'tools/render_turntable.py'),run_name='__main__')
for i in range(0,360,45):(out/f'view_{i:03}.png').replace(out/f'lin_{i:03}.png')

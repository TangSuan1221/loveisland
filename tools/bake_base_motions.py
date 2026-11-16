import bpy,json,pathlib,sys,importlib.util
root=pathlib.Path.cwd()
def module(name):
    spec=importlib.util.spec_from_file_location(name,root/'tools'/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
retarget=module('retarget_character')
entries={'Idle_A':120,'Walk_F':30,'Run_F':18,'Sit_Down':24,'Sit_Idle':150,'Stand_Up':27}
for clip,n in entries.items():
    bpy.ops.wm.open_mainfile(filepath=str(root/'build/CHR_lin.blend'))
    if clip in ('Walk_F','Run_F'):
        half=n//2
        contacts=[['l',0,n//4],['r',n//4+1,half+n//4],['l',half+n//4+1,n]]
        if clip=='Run_F':
            contacts=[['l',0,3],['r',6,12],['l',15,18]]
    else:contacts=[['l',0,n],['r',0,n]]
    out=root/'build/retarget'/('lin_'+clip+'.blend')
    bpy.context.preferences.filepaths.save_version=0
    retarget.main(['--source',str(root/'build/retarget/BaseMotionSource.blend'),'--format','mixamo','--action',clip,'--contacts',json.dumps(contacts),'--out',str(out)])
    sys.argv=['audit','--','--out',str(root/'docs/audit'/('P5_'+clip+'.json')),'--contacts',json.dumps(contacts)]
    module('audit_baked_clip')

# -*- coding: utf-8 -*-
"""
build_rig.py — 从 runtime_spec/bones.csv 生成 Blender 骨架。
用法:
  blender -b -P tools/build_rig.py -- --csv runtime_spec/bones.csv --out build/RIG_Base.blend
"""
import bpy, csv, sys, os, argparse
from mathutils import Vector

def parse_vec(s):
    s = s.strip().replace("(", "").replace(")", "")
    return Vector([float(x) for x in s.split(",")])

def read_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials):
        for b in list(block):
            if b.users == 0:
                block.remove(b)

def make_armature(rows):
    arm_data = bpy.data.armatures.new("RIG_Base")
    arm_obj = bpy.data.objects.new("RIG_Base", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = arm_data.edit_bones
    made = {}
    # first pass: create
    for r in rows:
        name = r["name"]
        eb = ebs.new(name)
        eb.head = Vector((float(r["head_x"]), float(r["head_y"]), float(r["head_z"])))
        eb.tail = Vector((float(r["tail_x"]), float(r["tail_y"]), float(r["tail_z"])))
        eb.use_deform = r["deform"].lower() == "true"
        made[name] = eb
    # second pass: parent + roll
    for r in rows:
        name = r["name"]; parent = r["parent"]
        eb = made[name]
        if parent and parent in made:
            eb.parent = made[parent]
            eb.use_connect = False
        z = parse_vec(r["roll_z_target"])
        if (eb.tail - eb.head).length > 1e-6 and z.length > 1e-6:
            try:
                eb.align_roll(z)
            except Exception as e:
                print("roll failed", name, e)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj

def add_face_bones(arm_obj, H, HU, HW):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = arm_obj.data.edit_bones
    def add(name, head, tail, parent="head"):
        eb = ebs.new(name)
        eb.head = Vector((head[0], -head[2], head[1])); eb.tail = Vector((tail[0], -tail[2], tail[1]))
        eb.parent = ebs.get(parent); eb.use_connect = False; eb.use_deform = False
        return eb
    chin = H - HU
    # eyes / brows / jaw / mouth：位置与文档 §7.3 对齐（adult 比例）
    add("eye_l", ( 0.30*HW, chin+0.56*HU, 0.38*HW), ( 0.30*HW, chin+0.56*HU, 0.52*HW))
    add("eye_r", (-0.30*HW, chin+0.56*HU, 0.38*HW), (-0.30*HW, chin+0.56*HU, 0.52*HW))
    add("brow_l",( 0.30*HW, chin+0.62*HU, 0.42*HW), ( 0.30*HW, chin+0.62*HU, 0.52*HW))
    add("brow_r",(-0.30*HW, chin+0.62*HU, 0.42*HW), (-0.30*HW, chin+0.62*HU, 0.52*HW))
    add("jaw",   (0, chin+0.52*HU, -0.10*HW), (0, chin+0.10*HU, 0.30*HW))
    add("mouth", (0, chin+0.28*HU, 0.38*HW), (0, chin+0.28*HU, 0.50*HW))
    bpy.ops.object.mode_set(mode="OBJECT")

def add_sockets(arm_obj, rows):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = arm_obj.data.edit_bones
    for r in rows:
        name = r["id"]
        if name in ebs: continue
        pos = parse_vec(r["local_pos_m"])
        eb = ebs.new(name)
        if name.startswith("socket_hand_") and pos.length == 0:
            pos = ebs[r["bone"]].head.copy()
        eb.head = pos; eb.tail = pos + Vector((0, 0, 0.03))
        parent = r["bone"]
        if parent in ebs:
            eb.parent = ebs[parent]; eb.use_connect = False
        eb.use_deform = False
    bpy.ops.object.mode_set(mode="OBJECT")

def add_leg_ik(arm_obj):
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="OBJECT")
    for side in ("l", "r"):
        calf = arm_obj.data.bones.get(f"calf_{side}")
        foot = arm_obj.data.bones.get(f"foot_{side}")
        if not calf or not foot: continue
        # target at ankle / foot head
        tgt = bpy.data.objects.new(f"IK_foot_{side}", None)
        tgt.empty_display_type = "PLAIN_AXES"; tgt.empty_display_size = 0.05
        bpy.context.collection.objects.link(tgt)
        tgt.location = foot.head_local
        pole = bpy.data.objects.new(f"IK_knee_{side}", None)
        pole.empty_display_type = "SPHERE"; pole.empty_display_size = 0.03
        bpy.context.collection.objects.link(pole)
        pole.location = calf.head_local + Vector((0, -0.45, 0))
        pb = arm_obj.pose.bones[f"calf_{side}"]
        c = pb.constraints.new("IK")
        c.target = tgt; c.chain_count = 2
        c.pole_target = pole; c.pole_angle = 0.0
        print("IK added", side)

def main():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--")+1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default="runtime_spec/bones.csv")
    ap.add_argument("--sockets", default="runtime_spec/sockets.csv")
    ap.add_argument("--out", default="build/RIG_Base.blend")
    args = ap.parse_args(argv)

    rows = read_csv(args.csv)
    clear_scene()
    arm = make_armature(rows)
    # adult_m canonical (H from head tail max)
    H = max(float(r["tail_z"]) for r in rows if r["name"] == "head")
    head_len = [abs(float(r["tail_z"])-float(r["head_z"])) for r in rows if r["name"] == "head"][0]
    HU = head_len; HW = 0.72 * HU
    add_face_bones(arm, H, HU, HW)
    if os.path.exists(args.sockets):
        add_sockets(arm, read_csv(args.sockets))
    add_leg_ik(arm)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.out))
    deform = [b.name for b in arm.data.bones if b.use_deform]
    print("SAVED", os.path.abspath(args.out), "deform bones:", len(deform))
    print(deform)

if __name__ == "__main__":
    main()


"""Expose VRMA humanoid nodes as a glTF skin for Blender's animation importer."""
import json
import struct
from pathlib import Path


def prepare(source, output, action_name):
    raw = Path(source).read_bytes()
    if raw[:4] != b'glTF' or struct.unpack_from('<I', raw, 4)[0] != 2:
        raise ValueError('Expected a binary glTF 2.0 animation')
    size, kind = struct.unpack_from('<II', raw, 12)
    if kind != 0x4e4f534a:
        raise ValueError('Missing glTF JSON chunk')
    end = 20 + size
    doc = json.loads(raw[20:end])
    humanoid = doc['extensions']['VRMC_vrm_animation']['humanoid']['humanBones']
    animations = doc['animations']
    if len(animations) == 1 and not animations[0].get('name'):
        animations[0]['name'] = action_name
    if not any(a.get('name') == action_name for a in animations):
        raise ValueError(f'No VRMA animation named {action_name}')
    for human, joint in humanoid.items():
        side, part = 'C', human
        for prefix, letter in [('left', 'L'), ('right', 'R')]:
            if human.startswith(prefix):
                side, part = letter, human[len(prefix):]
                break
        doc['nodes'][joint['node']]['name'] = f'J_Bip_{side}_{part[0].upper()}{part[1:]}'
    doc.setdefault('skins', []).append({
        'joints': [joint['node'] for joint in humanoid.values()],
        'skeleton': humanoid['hips']['node'],
    })
    doc['extensionsRequired'] = [s for s in doc.get('extensionsRequired', []) if s != 'VRMC_vrm_animation']
    data = json.dumps(doc, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    chunks = struct.pack('<II', len(data), kind) + data + raw[end:]
    output.write_bytes(struct.pack('<4sII', b'glTF', 2, 12 + len(chunks)) + chunks)

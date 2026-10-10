"""Reproduce the small synthetic corpus with pycdlib==1.14.0 (test-only).

Run with PYTHONPATH pointing at a pycdlib installation. No game content is used.
Gzip is only the fixture transport; Harbor receives the expanded disc image.
"""
import binascii
import gzip
import hashlib
import io
import json
from pathlib import Path
import pycdlib

ROOT = Path(__file__).parent
PAYLOAD = bytes(range(256)) * 2053 + b'Harbor independent ISO fixture\x00\xff'
manifest = []

def save(name, data):
    (ROOT / (name + '.iso.gz')).write_bytes(gzip.compress(data, mtime=0))
    manifest.append(dict(name=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest()))

def serialize(image):
    output = io.BytesIO()
    image.write_fp(output)
    image.close()
    return output.getvalue()

for kind, options in [
    ('plain', dict(interchange_level=3)),
    ('joliet', dict(interchange_level=3, joliet=3)),
    ('rockridge', dict(interchange_level=3, rock_ridge='1.09')),
    ('both', dict(interchange_level=3, joliet=3, rock_ridge='1.09')),
    ('udf_bridge', dict(interchange_level=3, joliet=3, udf='2.60')),
]:
    image = pycdlib.PyCdlib()
    image.new(vol_ident='HARBOR_TEST', **options)
    directory, file, empty = dict(iso_path='/DATA'), dict(iso_path='/DATA/PAYLOAD.BIN;1'), dict(iso_path='/EMPTY')
    for option, field in [('joliet', 'joliet_path'), ('rock_ridge', 'rr_name'), ('udf', 'udf_path')]:
        if options.get(option):
            directory[field] = 'Data files' if field == 'rr_name' else '/Data files'
            file[field] = '日本語 payload.bin' if field == 'rr_name' else '/Data files/日本語 payload.bin'
            empty[field] = 'Empty folder' if field == 'rr_name' else '/Empty folder'
    image.add_directory(**directory)
    image.add_directory(**empty)
    image.add_fp(io.BytesIO(PAYLOAD), len(PAYLOAD), **file)
    data = serialize(image)
    save(kind, data)
    if kind == 'udf_bridge':
        original = data

# A hybrid image whose ISO tree is incomplete: never silently fall back to it.
image = pycdlib.PyCdlib()
image.new(interchange_level=3, udf='2.60')
for name, payload, iso_path in [('common.bin', b'common namespace file', '/COMMON.BIN;1'),
                                ('udf-only.bin', b'file present only in the UDF tree', None)]:
    image.add_fp(io.BytesIO(payload), len(payload), iso_path=iso_path, udf_path='/' + name)
save('udf-extra', serialize(image))

image = pycdlib.PyCdlib()
image.open_fp(io.BytesIO(original))
directory = image.get_record(udf_path='/Data files')
fid = next(record for record in directory.fi_descs if not record.isparent).record()
fid_offset = original.find(fid)
assert fid_offset >= 0 and original.find(fid, fid_offset + 1) < 0
entry = image.get_record(udf_path='/Data files/日本語 payload.bin')
entry_offset = entry.extent_location() * 2048
image.close()
for label, index, mask in [('checksum', 4, 128), ('identifier', 0, 1), ('name_length', 19, 255)]:
    data = bytearray(original)
    data[fid_offset + index] ^= mask
    save('udf-bad-' + label, data)

# Change only ICB file type; repair descriptor CRC and tag checksum. Valid
# descriptor envelopes must not turn devices/FIFOs/sockets/links into files.
for kind in [6, 7, 9, 10, 12]:
    data = bytearray(original)
    data[entry_offset + 27] = kind
    length = int.from_bytes(data[entry_offset + 10:entry_offset + 12], 'little')
    crc = binascii.crc_hqx(data[entry_offset + 16:entry_offset + 16 + length], 0)
    data[entry_offset + 8:entry_offset + 10] = crc.to_bytes(2, 'little')
    data[entry_offset + 4] = sum(data[entry_offset + i] for i in range(16) if i != 4) & 255
    save('udf-special-' + str(kind), data)

for name, rr_name in [('unsafe', '../outside.bin'), ('reserved', 'CON')]:
    image = pycdlib.PyCdlib()
    image.new(interchange_level=3, rock_ridge='1.09')
    encoded_name = 'XX_outside.bin' if name == 'unsafe' else rr_name
    image.add_fp(io.BytesIO(b'x'), 1, iso_path='/PAYLOAD.BIN;1', rr_name=encoded_name)
    data = serialize(image)
    if name == 'unsafe':
        assert data.count(encoded_name.encode()) == 1
        data = data.replace(encoded_name.encode(), rr_name.encode())
    save(name, data)
image = pycdlib.PyCdlib()
image.new(interchange_level=3, rock_ridge='1.09')
image.add_symlink(symlink_path='/LINK.;1', rr_symlink_name='link', rr_path='../../outside')
save('symlink', serialize(image))
image = pycdlib.PyCdlib()
image.new(interchange_level=3, rock_ridge='1.09')
for iso_name, rr_name in [('FIRST', 'same.bin'), ('SECOND', 'SAME.BIN')]:
    image.add_fp(io.BytesIO(b'x'), 1, iso_path='/' + iso_name + '.BIN;1', rr_name=rr_name)
save('collision', serialize(image))
image = pycdlib.PyCdlib()
image.new(interchange_level=3)
noise = b'\x00NSR03\x01' + bytes(2048 - 7)
image.add_fp(io.BytesIO(noise), len(noise), iso_path='/NOISE.BIN;1')
save('descriptor-noise', serialize(image))
(ROOT / 'manifest.json').write_text(json.dumps(dict(generator='pycdlib 1.14.0', images=manifest), indent=2) + '\n')
print('Generated', len(manifest), 'synthetic disc images')

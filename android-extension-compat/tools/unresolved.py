"""Every type the extension archives name that nothing on the runtime classpath defines.

Reads the converted jars rather than the .cs3 files, because by then the references are ordinary
JVM constant pool entries. For each archive it collects every class the bytecode names, subtracts
the classes the archive defines itself, subtracts everything out/capstan.jar and libs/*.jar define,
and prints what is left. Anything printed is a ClassNotFoundException waiting for the first code
path that touches it, which is a different failure from a missing method and is not visible to
tools/contract.sh, because the contract only counts references under com.lagradost, android and
androidx.

Usage: python tools/unresolved.py [jar glob ...]

With no arguments it scans out/cache and out/shards/*/out/cache, which is where the loader leaves a
converted jar for every archive a gate has run.
"""

import collections
import glob
import os
import struct
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DEFAULT = ('out/cache/*.jar', 'out/shards/*/out/cache/*.jar', 'samples/jars/*.jar', 'samples/jars86/*.jar')

PROVIDED = ('out/capstan.jar', 'libs/*.jar')

# The runtime brings these with it, so naming one is never a gap.
PLATFORM = ('java/', 'javax/', 'jdk/', 'sun/', 'com/sun/', 'kotlin/', 'kotlinx/', 'org/jetbrains/')

WIDTH = {3: 4, 4: 4, 5: 8, 6: 8, 7: 2, 8: 2, 9: 4, 10: 4, 11: 4, 12: 4, 16: 2, 17: 4, 18: 4, 19: 2, 20: 2}


def named_classes(data):
    count = struct.unpack_from('>H', data, 8)[0]
    utf8 = {}
    classes = []
    index, pos = 1, 10
    while index < count:
        tag = data[pos]
        pos += 1
        if tag == 1:
            length = struct.unpack_from('>H', data, pos)[0]
            utf8[index] = data[pos + 2:pos + 2 + length].decode('utf-8', 'replace')
            pos += 2 + length
        elif tag == 15:
            pos += 3
        else:
            width = WIDTH.get(tag)
            if width is None:
                break
            if tag == 7:
                classes.append(struct.unpack_from('>H', data, pos)[0])
            pos += width
            if tag in (5, 6):
                index += 1
        index += 1
    out = set()
    for i in classes:
        name = utf8.get(i, '')
        while name.startswith('['):
            name = name[1:]
        if name.startswith('L') and name.endswith(';'):
            name = name[1:-1]
        if len(name) > 1 and not name.startswith('['):
            out.add(name)
    return out


def entries(patterns):
    have = set()
    for pattern in patterns:
        for jar in glob.glob(os.path.join(ROOT, pattern)):
            try:
                archive = zipfile.ZipFile(jar)
            except Exception:
                continue
            for name in archive.namelist():
                if name.endswith('.class'):
                    have.add(name[:-6])
    return have


def main():
    patterns = sys.argv[1:] or list(DEFAULT)
    provided = entries(PROVIDED)
    if not provided:
        print('nothing on the classpath: run sh tools/build.sh first')
        return 1
    missing = collections.defaultdict(set)
    scanned = set()
    for pattern in patterns:
        for jar in sorted(glob.glob(os.path.join(ROOT, pattern))):
            base = os.path.basename(jar).rsplit('-', 1)[0].replace('.jar', '')
            if base in scanned:
                continue
            scanned.add(base)
            try:
                archive = zipfile.ZipFile(jar)
            except Exception:
                continue
            own = {n[:-6] for n in archive.namelist() if n.endswith('.class')}
            referenced = set()
            for name in archive.namelist():
                if not name.endswith('.class'):
                    continue
                try:
                    referenced |= named_classes(archive.read(name))
                except Exception:
                    pass
            for name in referenced - own - provided:
                if not name.startswith(PLATFORM):
                    missing[name].add(base)
    print('archives scanned %d' % len(scanned))
    for name in sorted(missing, key=lambda n: (-len(missing[n]), n)):
        print('%-70s %2d  %s' % (name, len(missing[name]), ', '.join(sorted(missing[name]))))
    print('unresolved types %d' % len(missing))
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())

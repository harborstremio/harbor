# Copyright (C) 2025 Rob Hall
# SPDX-License-Identifier: MIT

# libudfread source files
libudfread_src = [
    'default_blockinput.c',
    'ecma167.c',
    'udf_volume.c',
    'udf_fs.c',
    'udfread.c',
    'udfread-version.c',
]

#
# Library definitions
#

if get_option('embed_udfread')
    api_export_flags = []
    library_type = 'static_library'
elif host_machine.system() == 'windows' and get_option('default_library') == 'static'
    api_export_flags = []
    library_type = 'static_library'
else
    api_export_flags = '-DUDFREAD_API_EXPORT'
    library_type = 'library' # follow the default_library option
endif

# The final libudfread library
libudfread = build_target('udfread', libudfread_src,
    target_type: library_type,
    include_directories: libudfread_inc_dirs,
    dependencies: [thread_dependency],
    c_args: [api_export_flags],
    version: libudfread_soname_version,
    gnu_symbol_visibility: 'hidden',
    install: not get_option('embed_udfread'))

# Make the library usable as a dependency in this and other projects
libudfread_dep = declare_dependency(link_with: libudfread,
    sources: libudfread_internal_headers,
    include_directories: '.')

meson.override_dependency('libudfread', libudfread_dep)

# Generate pkg-config .pc file
if not get_option('embed_udfread')
    pkg_mod = import('pkgconfig')
    pkg_mod.generate(libraries: libudfread,
        version: meson.project_version(),
        name: 'libudfread',
        description: 'UDF filesystem access library')
endif

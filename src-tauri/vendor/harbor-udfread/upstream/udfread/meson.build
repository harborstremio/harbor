# Copyright (C) 2025 Rob Hall
# SPDX-License-Identifier: MIT

fs = import('fs')

libudfread_internal_headers = []
libudfread_api_headers = files(
    '../udfread.h',
    '../blockinput.h',
)

# Copy headers to correct path for use as subproject
foreach h: libudfread_api_headers
    basename = fs.name(h)
    if meson.version().version_compare('>= 0.64.0')
        libudfread_internal_headers += fs.copyfile(h, basename)
    else
        configure_file(input: h, output: basename, copy: true)
    endif
endforeach

libudfread_api_headers += configure_file(
    input: '../udfread-version.h.in',
    output: 'udfread-version.h',
    configuration: {'UDFREAD_VERSION_MAJOR': libudfread_version_split[0],
                    'UDFREAD_VERSION_MINOR': libudfread_version_split[1],
                    'UDFREAD_VERSION_MICRO': libudfread_version_split[2]})

if not get_option('embed_udfread')
    install_headers(libudfread_api_headers, subdir: 'udfread')
endif

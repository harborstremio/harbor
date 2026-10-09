/*
 * This file is part of libudfread
 * Copyright (C) 2014-2026 VLC authors and VideoLAN
 *
 * Authors: Petri Hintukainen <phintuka@users.sourceforge.net>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library. If not, see
 * <http://www.gnu.org/licenses/>.
 */

#ifndef UDFREAD_UDF_FS_H_
#define UDFREAD_UDF_FS_H_

#include "ecma167.h"
#include "blockinput.h"
#include "udf_volume.h"

#include <stdint.h> /* *int_t */
#include <stddef.h> /* size_t */

/**
 * Decode CS0 string
 *
 * outputs Modified UTF-8 (MUTF-8).
 * The null character (U+0000) uses the two-byte overlong encoding 11000000 10000000 (hexadecimal C0 80), instead of 00000000 (hexadecimal 00).
 *
 * - not strictly UTF-8 compilant, but works with C str*() functions and Java, while \0 bytes in middle of strings won't.
 */

char *udf_cs0_to_mutf8(const uint8_t *cs0, size_t size);

/**
 * Root directory
 */

struct udf_fs {
    udfread_block_input *input;
    ecma_ctx ecma;

    /* partition */
    struct udf_partitions part;
};

int udf_find_root_dir(struct udf_fs *fs, const struct long_ad *fsd_loc,
                      struct file_set_descriptor *fsd);

/**
 * Directory entries
 */

struct udf_file_identifier {
    char           *filename;       /* MUTF-8 */
    struct long_ad  icb;            /* location of file entry */
    uint8_t         characteristic; /* CHAR_FLAG_* */
};

struct udf_dir_entries {
    uint32_t                     num_entries;
    struct udf_file_identifier  *files;
};

void udf_clean_dir_entries(struct udf_dir_entries *p);

/**
 * Directory access
 */

int udf_read_dir(struct udf_fs *fs, const struct long_ad *icb,
                 struct udf_dir_entries *dir);

struct file_entry *udf_read_file_entry(struct udf_fs *fs, const struct long_ad *icb);

/**
 * File content
 */

uint32_t udf_file_lba(struct udf_fs *fs, const struct file_entry *fe, uint32_t file_block,
                      uint32_t *extent_length);

uint32_t udf_read_file_blocks(struct udf_fs *fs, const struct file_entry *fe,
                              void *buf, uint32_t file_block, uint32_t num_blocks, int flags);


#endif /* UDFREAD_UDF_FS_H_ */

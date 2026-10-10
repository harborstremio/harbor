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

#if HAVE_CONFIG_H
#include "config.h"
#endif

#include "udf_fs.h"
#include "ecma167.h"

#include "attributes.h"
#include "udfread.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define udf_error(...)   udf_log_msg(fs->ecma.lc, UDFREAD_LOG_ERROR, "udfread ERROR: ", __VA_ARGS__)
#define udf_log(...)     udf_log_msg(fs->ecma.lc, UDFREAD_LOG_INFO,  "udfread LOG  : ", __VA_ARGS__)
#define udf_trace(...)   udf_log_msg(fs->ecma.lc, UDFREAD_LOG_TRACE, "udfread TRACE: ", __VA_ARGS__)

/*
 * Utils
 */

static void *_safe_realloc(void *p, size_t s)
{
    void *result = realloc(p, s);
    if (!result) {
        free(p);
    }
    return result;
}

/*
 * Strings, CS0 (UDF 2.1.1)
 */

#define utf16lo_to_mutf8(out, out_pos, out_size, ch) \
  do {                                               \
    if (ch != 0 && ch < 0x80) {                      \
      out[out_pos++] = (uint8_t)ch;                  \
    } else {                                         \
      out_size++;                                    \
      out = (uint8_t *)_safe_realloc(out, out_size); \
      if (!out) return NULL;                         \
                                                     \
      out[out_pos++] = 0xc0 | (ch >> 6);             \
      out[out_pos++] = 0x80 | (ch & 0x3f);           \
    }                                                \
  } while (0)

#define utf16_to_mutf8(out, out_pos, out_size, ch)   \
  do {                                               \
    if (ch < 0x7ff) {                                \
      utf16lo_to_mutf8(out, out_pos, out_size, ch);  \
    } else {                                         \
      out_size += 2;                                 \
      out = (uint8_t *)_safe_realloc(out, out_size); \
      if (!out) return NULL;                         \
                                                     \
      out[out_pos++] = 0xe0 | (ch >> 12);            \
      out[out_pos++] = 0x80 | ((ch >> 6) & 0x3f);    \
      out[out_pos++] = 0x80 | (ch & 0x3f);           \
                                                     \
    }                                                \
  } while (0)

char *udf_cs0_to_mutf8(const uint8_t *cs0, size_t size)
{
    size_t   out_pos = 0;
    size_t   out_size = size;
    size_t   i;
    uint8_t *out;

    if (size < 1) {
        /* empty string */
        return calloc(1, 1);
    }

    if (cs0[0] == 254 || cs0[0] == 255) {
        /* UDF 2.1.1: compression IDs 254 and 255 mark the name
         * as empty and unique */
        return calloc(1, 1);
    }

    out = (uint8_t *)malloc(size);
    if (!out) {
        return NULL;
    }

    switch (cs0[0]) {
    case 8:
        for (i = 1; i < size; i++) {
            utf16lo_to_mutf8(out, out_pos, out_size, cs0[i]);
        }
        break;
    case 16:
        for (i = 1; i < size - 1; i+=2) {
            uint16_t ch = cs0[i + 1] | (cs0[i] << 8);
            utf16_to_mutf8(out, out_pos, out_size, ch);
        }
        break;
    default:
        free(out);
        return NULL;
    }

    out[out_pos] = 0;
    return (char*)out;
}

/*
 * Cached directory data
 */

void udf_clean_dir_entries(struct udf_dir_entries *p)
{
    if (p) {
        if (p->files) {
            uint32_t i;
            for (i = 0; i < p->num_entries; i++) {
                free(p->files[i].filename);
            }
            free(p->files);
            p->files = NULL;
        }
    }
}

/*
 * FS metadata
 */

static int _read_descriptor_block(udfread_block_input *input, uint32_t lba, uint8_t *buf)
{
    if (input->read(input, lba, buf, 1, 0) == 1) {
        return decode_descriptor_tag(buf, UDF_BLOCK_SIZE);
    }

    return -1;
}

static int _partition_index(const struct udf_partitions *part, uint16_t partition_number)
{
    if (partition_number == part->p[0].number) {
        return 0;
    } else if (part->num_partition > 1 && partition_number == part->p[1].number) {
        return 1;
    }

    return -1;
}

/* read metadata blocks. If read fails, try from mirror (if available). */
static int _read_metadata_blocks(struct udf_fs *fs, uint8_t *buf, const struct long_ad *loc)
{
    int      tag_id;
    uint32_t lba, i;
    int      got;
    int      part_idx;

    udf_trace("reading metadata from part %u lba %u\n", loc->partition, loc->lba);

    part_idx = _partition_index(&fs->part, loc->partition);
    if (part_idx < 0) {
        udf_error("unknown partition %u\n", loc->partition);
        return -1;
    }

    if (fs->part.p[part_idx].length && loc->lba >= fs->part.p[part_idx].length) {
        udf_error("metadata block outside partition %u\n", loc->partition);
        return -1;
    }

    /* read first block. Parse and check tag. */

    lba    = fs->part.p[part_idx].lba + loc->lba;
    tag_id = _read_descriptor_block(fs->input, lba, buf);

    if (tag_id < 0) {

        /* try mirror */
        if (fs->part.p[part_idx].mirror_lba) {
            udf_log("read metadata from lba %u failed, trying mirror\n", lba);
            lba    = fs->part.p[part_idx].mirror_lba + loc->lba;
            tag_id = _read_descriptor_block(fs->input, lba, buf);
        }

        if (tag_id < 0) {
            udf_error("read metadata from lba %u failed\n", lba);
            return -1;
        }
    }

    /* read following blocks without tag parsing and checksum validation */

    for (i = 1; i <= (loc->length - 1) / UDF_BLOCK_SIZE; i++) {

        if (fs->part.p[part_idx].length && (uint64_t)loc->lba + i >= fs->part.p[part_idx].length) {
            udf_error("metadata extent outside partition %u\n", loc->partition);
            return -1;
        }

        lba  = fs->part.p[part_idx].lba + loc->lba + i;
        buf += UDF_BLOCK_SIZE;

        got = fs->input->read(fs->input, lba, buf, 1, 0);
        if (got != 1) {
            if (fs->part.p[part_idx].mirror_lba) {
                udf_log("no valid metadata block at lba %u, trying mirror\n", lba);
                lba = fs->part.p[part_idx].mirror_lba + loc->lba + i;
                got = fs->input->read(fs->input, lba, buf, 1, 0);
            }
            if (got != 1) {
                udf_error("no valid metadata block at lba %u\n", lba);
                return -1;
            }
        }
    }

    return tag_id;
}

static uint8_t *_read_metadata(struct udf_fs *fs, const struct long_ad *icb, int *tag_id)
{
    uint32_t  num_blocks = (icb->length + UDF_BLOCK_SIZE - 1) / UDF_BLOCK_SIZE;
    uint8_t  *buf;

    if (num_blocks < 1) {
        return NULL;
    }

    buf = (uint8_t *)malloc(num_blocks * UDF_BLOCK_SIZE);
    if (!buf) {
        udf_error("out of memory\n");
        return NULL;
    }

    *tag_id = _read_metadata_blocks(fs, buf, icb);
    if (*tag_id < 0) {
        udf_log("reading icb blocks failed\n");
        free(buf);
        return NULL;
    }

    return buf;
}

/*
 * FS root
 */

int udf_find_root_dir(struct udf_fs *fs, const struct long_ad *fsd_loc,
                      struct file_set_descriptor *fsd)
{
    uint8_t             buf[UDF_BLOCK_SIZE];
    int                 tag_id = -1;
    int                 part_idx;
    struct long_ad      loc = *fsd_loc;
    uint32_t            num_blocks;

    udf_trace("reading root directory fsd from part %u lba %u\n", fsd_loc->partition, fsd_loc->lba);

    /* extent length can be invalid metadata. The pointer always targets the FSD itself:
     * scan the described extent, but always probe at least one block. */

    num_blocks = fsd_loc->length ? (fsd_loc->length - 1) / UDF_BLOCK_SIZE + 1 : 1;

    /* limit scan to partition area (if partition size is known) */
    part_idx = _partition_index(&fs->part, fsd_loc->partition);
    if (part_idx < 0) {
        udf_error("unknown partition %u\n", fsd_loc->partition);
        return -1;
    }

    if (fs->part.p[part_idx].length) {
        if (fsd_loc->lba >= fs->part.p[part_idx].length) {
            udf_error("File Set Descriptor outside partition\n");
            return -1;
        }
        if (num_blocks > fs->part.p[part_idx].length - fsd_loc->lba) {
            udf_error("File Set Descriptor partially outside partition\n");
            num_blocks = fs->part.p[part_idx].length - fsd_loc->lba;
        }
    }

    /* search for File Set Descriptor from the area described by fsd_loc */

    loc.length = UDF_BLOCK_SIZE;
    for (; num_blocks > 0; num_blocks--, loc.lba++) {

        tag_id = _read_metadata_blocks(fs, buf, &loc);
        if (tag_id == ECMA_FileSetDescriptor) {
            break;
        }
        if (tag_id == ECMA_TerminatingDescriptor) {
            break;
        }
        udf_error("unhandled tag %d in File Set Descriptor area\n", tag_id);
    }
    if (tag_id != ECMA_FileSetDescriptor) {
        udf_error("didn't find File Set Descriptor\n");
        return -1;
    }

    decode_file_set_descriptor(buf, fsd);
    udf_log("root directory in part %u lba %u\n", fsd->root_icb.partition, fsd->root_icb.lba);

    return 0;
}

/*
 * File
 */

struct file_entry *udf_read_file_entry(struct udf_fs *fs, const struct long_ad *icb)
{
    struct file_entry *fe = NULL;
    uint8_t  *buf;
    int       tag_id;

    udf_trace("file entry size %u bytes\n", icb->length);

    buf = _read_metadata(fs, icb, &tag_id);
    if (!buf) {
        udf_error("reading file entry failed\n");
        return NULL;
    }

    switch (tag_id) {
        case ECMA_FileEntry:
            fe = decode_file_entry(&fs->ecma, buf, UDF_BLOCK_SIZE, icb->partition);
            break;
        case ECMA_ExtendedFileEntry:
            fe = decode_ext_file_entry(&fs->ecma, buf, UDF_BLOCK_SIZE, icb->partition);
            break;
        default:
            udf_error("_read_file_entry: unknown tag %d\n", tag_id);
            break;
    }

    free(buf);

    /* read possible additional allocation extents */
    if (fe && !fe->content_inline) {
        uint32_t *visited   = NULL;
        unsigned  n_visited = 0;
        int       cycle     = 0;

        while (fe->u.ads.num_ad > 0 &&
               fe->u.ads.ad[fe->u.ads.num_ad - 1].extent_type == ECMA_AD_EXTENT_AD) {

            /* drop pointer to this extent from the end of AD list */
            fe->u.ads.num_ad--;

            icb = &fe->u.ads.ad[fe->u.ads.num_ad];
            udf_log("_read_file_entry: reading allocation extent @%u\n", icb->lba);

            /* cycle protection: never follow the same allocation extent twice */
            {
                unsigned i;
                for (i = 0; i < n_visited; i++) {
                    if (visited[i] == icb->lba) {
                        udf_error("_read_file_entry: detected allocation extent chain loop @%u\n", icb->lba);
                        cycle = 1;
                        break;
                    }
                }
                if (cycle) {
                    break;
                }
                visited = (uint32_t *)_safe_realloc(visited, (n_visited + 1) * sizeof(*visited));
                if (!visited) {
                    udf_error("out of memory\n");
                    break;
                }
                visited[n_visited++] = icb->lba;
            }

            buf = _read_metadata(fs, icb, &tag_id);
            if (!buf) {
                udf_error("_read_file_entry: reading allocation extent @%u failed\n", icb->lba);
                break;
            }

            if (tag_id != ECMA_AllocationExtentDescriptor) {
                free(buf);
                udf_error("_read_file_entry: unexpected tag %d (expected ECMA_AllocationExtentDescriptor)\n", tag_id);
                break;
            }

            if (decode_allocation_extent(&fs->ecma, &fe, buf, icb->length, icb->partition) < 0) {
                free(buf);
                udf_error("_read_file_entry: decode_allocation_extent() failed\n");
                break;
            }

            /* failure before this point will cause an error when reading the file past extent point.
               (extent ad is left in file ad list). */

            free(buf);
        }

        free(visited);

        if (cycle) {
            free_file_entry(&fe);
            return NULL;
        }
    }

    return fe;
}

uint32_t udf_file_lba(struct udf_fs *fs, const struct file_entry *fe, uint32_t file_block, uint32_t *extent_length)
{
    unsigned int i;
    uint32_t     ad_size;

    if (fe->content_inline) {
        udf_error("can't map lba for inline file\n");
        return 0;
    }

    for (i = 0; i < fe->u.ads.num_ad; i++) {
        const struct long_ad *ad = &fe->u.ads.ad[0];
        ad_size = (ad[i].length + UDF_BLOCK_SIZE - 1) / UDF_BLOCK_SIZE;
        if (file_block < ad_size) {

            if (ad[i].extent_type != ECMA_AD_EXTENT_NORMAL) {
                if (ad[i].extent_type == ECMA_AD_EXTENT_AD) {
                    udf_error("unsupported allocation descriptor: extent type %u\n", ad[i].extent_type);
                }
                return 0;
            }

            if (!ad[i].lba) {
                /* empty file / no allocated space */
                return 0;
            }

            if (ad[i].partition != fs->part.p[0].number) {
                udf_error("file partition %u != %u\n", ad[i].partition, fs->part.p[0].number);
            }

            if (extent_length) {
                *extent_length = ad_size - file_block;
            }

            if ((uint64_t)fs->part.p[0].lba + ad[i].lba + file_block > (uint64_t)UINT32_MAX) {
                udf_error("file extent outside media\n");
                return 0;
            }
            return fs->part.p[0].lba + ad[i].lba + file_block;
        }

        file_block -= ad_size;
    }

    return 0;
}

uint32_t udf_read_file_blocks(struct udf_fs *fs, const struct file_entry *fe,
                              void *buf, uint32_t file_block, uint32_t num_blocks, int flags)
{
    uint32_t i;

    if (fe->content_inline) {
        udf_error("can't read blocks from inline file\n");
        return 0;
    }

    for (i = 0; i < num_blocks; ) {
        uint32_t extent_length = 0;
        uint32_t lba;
        uint8_t *block = (uint8_t *)buf + UDF_BLOCK_SIZE * i;
        int got;

        lba = udf_file_lba(fs, fe, file_block + i, &extent_length);
        udf_trace("map block %u to lba %u\n", file_block + i, lba);

        if (!lba) {
            /* unallocated/unwritten block or EOF */
            uint32_t file_blocks = (fe->length + UDF_BLOCK_SIZE - 1) / UDF_BLOCK_SIZE;
            if (file_block + i < file_blocks) {
                udf_trace("zero-fill unallocated / unwritten block %u\n", file_block + i);
                memset(block, 0, UDF_BLOCK_SIZE);
                i++;
                continue;
            }
            udf_error("block %u outside of file (size %u blocks)\n", file_block + i, file_blocks);
            break;
        }

        if (extent_length > num_blocks - i) {
            extent_length = num_blocks - i;
        }

        got = fs->input->read(fs->input, lba, block, extent_length, flags);
        if (got < 1) {
            break;
        }
        i += (uint32_t)got;
    }
    return i;
}

/*
 * Directory
 */

static int _parse_dir_file(struct udf_fs *fs, const uint8_t *data, uint32_t length,
                           struct udf_dir_entries *dir)
{
    struct file_identifier fid;
    const uint8_t *p   = data, *q;
    const uint8_t *end = data + length;
    uint32_t       capacity = dir->num_entries;
    int            tag_id;

    if (length < 16) {
        return 0;
    }

    /* Treat all zero data as an empty directory instead of a parse error */
    for (q = data; q < end && !*q; q++) ;
    if (q == end) {
        return 0;
    }

    while (p < end - 16) {
        size_t used;

        if (dir->num_entries == UINT32_MAX) {
            return 0;
        }

        tag_id = decode_descriptor_tag(p, (size_t)(end - p));
        if (tag_id != ECMA_FileIdentifierDescriptor) {
            udf_error("unexpected tag %d in directory file\n", tag_id);
            return -1;
        }

        if (dir->num_entries == capacity) {
            /* grow geometrically: per-entry realloc copies the whole
             * array every time, which is quadratic for large
             * directories (60s -> 0.03s for 50k entries under ASan) */
            uint32_t n;
            if (capacity >= UINT32_MAX / 2) {
                /* no headroom left to double: fail instead of wrapping
                 * the append index past the end of the array */
                udf_error("too many directory entries\n");
                return -1;
            }
            n = capacity ? capacity * 2 : 64;
            struct udf_file_identifier *files =
                (struct udf_file_identifier *)_safe_realloc(dir->files, sizeof(dir->files[0]) * n);
            if (!files) {
                udf_error("out of memory\n");
                return -1;
            }
            dir->files = files;
            capacity   = n;
        }

        used = decode_file_identifier(&fs->ecma, p, (size_t)(end - p), &fid);
        if (used == 0) {
            /* not enough data. keep the entries we already have. */
            break;
        }
        p += used;

        if (fid.characteristic & CHAR_FLAG_PARENT) {
            continue;
        }
        if (fid.characteristic & CHAR_FLAG_DELETED) {
            /* UDF 2.3.4.2.1: readers shall skip deleted entries */
            continue;
        }
        if (fid.filename_len < 1) {
            continue;
        }

        dir->files[dir->num_entries].characteristic = fid.characteristic;
        dir->files[dir->num_entries].icb = fid.icb;
        dir->files[dir->num_entries].filename = udf_cs0_to_mutf8(fid.filename, fid.filename_len);

        if (!dir->files[dir->num_entries].filename) {
            udf_error("error converting file name (encoding: 0x%02x)\n", fid.filename[0]);
            continue;
        }

        /* Skip empty file identifiers.
         * Not strictly compilant (?), \0 is allowed in
         * ECMA167 file identifier.
         */
        if (!dir->files[dir->num_entries].filename[0]) {
            udf_error("skipping empty file identifier\n");
            free(dir->files[dir->num_entries].filename);
            continue;
        }

        dir->num_entries++;
    }

    return 0;
}

/* best effort check: is the first block of the extent entirely zeroed ? */
static int _is_zero_block(struct udf_fs *fs, const struct long_ad *loc)
{
    uint8_t  buf[UDF_BLOCK_SIZE];
    int      part_idx;
    uint32_t lba, i;

    part_idx = _partition_index(&fs->part, loc->partition);
    if (part_idx < 0) {
        return 0;
    }

    lba = fs->part.p[part_idx].lba + loc->lba;
    if (fs->input->read(fs->input, lba, buf, 1, 0) != 1) {
        return 0;
    }

    for (i = 0; i < UDF_BLOCK_SIZE; i++) {
        if (buf[i]) {
            return 0;
        }
    }

    udf_log("directory extent at part %u lba %u is zeroed\n", loc->partition, loc->lba);
    return 1;
}

static int _read_dir_file(struct udf_fs *fs, const struct long_ad *loc,
                          struct udf_dir_entries *dir)
{
    int             result;
    uint8_t        *data;
    int             tag_id;

    udf_trace("directory size %u bytes\n", loc->length);

    data = _read_metadata(fs, loc, &tag_id);
    if (!data) {
        /* a directory extent that is entirely zeroed holds no descriptors:
         * treat it as an empty directory instead of an error (best effort
         * on damaged / interrupted-write discs) */
        if (_is_zero_block(fs, loc)) {
            return 0;
        }
        udf_error("reading directory file failed\n");
        return -1;
    }

    result = _parse_dir_file(fs, data, loc->length, dir);
    if (result < 0) {
        udf_error("failed parsing directory file\n");
    }

    free(data);
    return result;
}

int udf_read_dir(struct udf_fs *fs, const struct long_ad *icb,
                 struct udf_dir_entries *dir)
{
    struct file_entry *fe;
    int result = -1;

    fe = udf_read_file_entry(fs, icb);
    if (!fe) {
        udf_error("error reading directory file entry\n");
        return -1;
    }

    if (fe->file_type != ECMA_FT_DIR) {
        udf_error("directory file type is not directory\n");
        free_file_entry(&fe);
        return -1;
    }

    if (fe->content_inline) {
        result = _parse_dir_file(fs, &fe->u.data.content[0], fe->u.data.information_length, dir);
        if (result < 0) {
            udf_error("failed parsing inline directory file\n");
        }

    } else if (fe->u.ads.num_ad == 0) {
        /* ECMA-167 4/8.6 allows a directory with zero entries. Treat a
         * missing extent as an empty directory, not as an error. */
        result = 0;

    } else {
        if (fe->u.ads.num_ad > 1) {
            udf_error("unsupported fragmented directory file\n");
            /* will read only first extent */
        }
        result = _read_dir_file(fs, &fe->u.ads.ad[0], dir);
    }

    free_file_entry(&fe);
    return result;
}

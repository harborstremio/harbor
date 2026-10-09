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

#ifndef UDFREAD_ECMA167_H_
#define UDFREAD_ECMA167_H_

#include <stdint.h> /* *int_t */
#include <stddef.h> /* size_t */

#include "logger.h"

/* ecma167 context */
typedef struct {
    udf_lc *lc;
    /* TODO: allocation pool */
} ecma_ctx;


/*
 * Minimal implementation of ECMA-167:
 * Volume and File Structure for Write-Once and Rewritable
 * Media using Non-Sequential Recording for Information Interchange
 *
 * Based on 3rd Edition, June 1997
 * http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-167.pdf
 *
 */

/*
 * Part 1: General
 */

/* Numerical Values (ECMA 167, 1/7.1) */

static inline uint32_t _get_u8(const uint8_t *p)
{
  return (uint32_t)p[0];
}

static inline uint32_t _get_u16(const uint8_t *p)
{
    return _get_u8(p) | (_get_u8(p + 1) << 8);
}

static inline uint32_t _get_u32(const uint8_t *p)
{
    return _get_u16(p) | (_get_u16(p + 2) << 16);
}

static inline uint64_t _get_u64(const uint8_t *p)
{
    return (uint64_t)_get_u32(p) | ((uint64_t)_get_u32(p + 4) << 32);
}

/* Entity Identifier (ECMA 167, 1/7.4) */

struct entity_id {
    uint8_t identifier[23];
    uint8_t identifier_suffix[8];
};

void decode_entity_id(const uint8_t *p, struct entity_id *eid);

/*
 * Part 3: Volume Structure
 */

/* Extent Descriptor (ECMA 167, 3/7.1) */

struct extent_ad {
    uint32_t lba;
    uint32_t length; /* in bytes */
};

/* Descriptor Tag (ECMA 167, 3/7.2) */

enum tag_identifier {
    /* ECMA 167, 3/7.2.1) */
    ECMA_PrimaryVolumeDescriptor              = 1,
    ECMA_AnchorVolumeDescriptorPointer        = 2,
    ECMA_VolumeDescriptorPointer              = 3,
    ECMA_PartitionDescriptor                  = 5,
    ECMA_LogicalVolumeDescriptor              = 6,
    ECMA_TerminatingDescriptor                = 8,

    /* ECMA 167, 4/7.2.1 */
    ECMA_FileSetDescriptor                    = 256,
    ECMA_FileIdentifierDescriptor             = 257,
    ECMA_AllocationExtentDescriptor           = 258,
    ECMA_FileEntry                            = 261,
    ECMA_ExtendedFileEntry                    = 266,

    ECMA_TAG_INVALID                          = -1,  /* checksum failed */
};

enum tag_identifier decode_descriptor_tag(const uint8_t *buf, size_t size);

/* Primary Volume Descriptor (ECMA 167, 3/10.1) */

struct primary_volume_descriptor {
    uint8_t volume_identifier[31];
    uint8_t volume_identifier_length;
    uint8_t volume_set_identifier[128];
};

void decode_primary_volume(const uint8_t *p, struct primary_volume_descriptor *pvd);

/* Anchor Volume Descriptor (ECMA 167, 3/10.2) */

struct anchor_volume_descriptor {
    struct extent_ad mvds; /* Main Volume Descriptor Sequence extent */
    struct extent_ad rvds; /* Reserve Volume Descriptor Sequence extent */
};

void decode_avdp(const uint8_t *p, struct anchor_volume_descriptor *avdp);

/* Volume Descriptor Pointer (ECMA 167, 3/10.3) */

struct volume_descriptor_pointer {
    struct extent_ad next_extent; /* Next Volume Descriptor Sequence Extent */
};

void decode_vdp(const uint8_t *p, struct volume_descriptor_pointer *vdp);

/* Partition Descriptor (ECMA 167, 3/10.5) */

struct partition_descriptor {
    uint16_t number;
    uint32_t start_block;
    uint32_t num_blocks;
};

void decode_partition(const uint8_t *p, struct partition_descriptor *pd);

/* Logical Volume Descriptor (ECMA 167, 3/10.6) */

struct logical_volume_descriptor {
    uint32_t         block_size;
    struct entity_id domain_id;
    uint8_t          contents_use[16];

    uint32_t num_partition_maps;
    uint32_t partition_map_table_length;
    uint8_t  partition_map_table[2048];
};

void decode_logical_volume(const uint8_t *p, struct logical_volume_descriptor *lvd);

/*
 * Part 4: File Structure
 */

enum {
    ECMA_AD_EXTENT_NORMAL = 0,        /* allocated and recorded file data */
    ECMA_AD_EXTENT_NOT_RECORDED = 1,
    ECMA_AD_EXTENT_NOT_ALLOCATED = 2,
    ECMA_AD_EXTENT_AD = 3,            /* pointer to next extent of allocation descriptors */
};


/* Short/Long/Extended Allocation Descriptor (ECMA 167, 4/14.14.[1,2,3]) */

struct long_ad {
    uint32_t lba;    /* start block, relative to partition start */
    uint32_t length; /* in bytes */
    uint16_t partition;
    uint8_t  extent_type;
};

void decode_long_ad(const uint8_t *p, struct long_ad *ad);

/* File Set Descriptor (ECMA 167 4/14.1) */

struct  file_set_descriptor {
    struct long_ad root_icb;
};

void decode_file_set_descriptor(const uint8_t *p, struct file_set_descriptor *fsd);

/* File Identifier (ECMA 167 4/14.4) */

enum {
    CHAR_FLAG_HIDDEN  = 0x01,
    CHAR_FLAG_DIR     = 0x02,
    CHAR_FLAG_DELETED = 0x04,
    CHAR_FLAG_PARENT  = 0x08,
};

struct file_identifier {
    struct long_ad icb;
    uint8_t        characteristic; /* CHAR_FLAG_* */
    uint8_t        filename_len;
    uint8_t        filename[256];
};

size_t decode_file_identifier(ecma_ctx *, const uint8_t *p, size_t size, struct file_identifier *fi);

/* File Entry (ECMA 167, 4/14.9) */
/* Extended File Entry (ECMA 167, 4/14.17) */

enum {
    /* ECMA 167, 14.6.6 File Type */
    ECMA_FT_UNSPECIFIED     = 0,
    ECMA_FT_INDIRECT        = 3,
    ECMA_FT_DIR             = 4,
    ECMA_FT_BYTESTREAM      = 5,  /* random-access byte stream - regular file - udf 2.60, 2.3.5.2 */
    ECMA_FT_TERMINAL_ENTRY  = 11,
    ECMA_FT_SYMLINK         = 12,
};

struct file_entry {
    uint64_t       length;         /* in bytes */
    uint8_t        file_type;      /* ECMA_FT_* */
    uint8_t        content_inline; /* 1 if file data is embedded in file entry */
    uint8_t        ad_type;        /* from icb_flags; used when parsing allocation extents */

    union {
        /* "normal" file */
        struct {
            uint32_t       num_ad;
            struct long_ad ad[1];      /* Most files have only single extent, files in 3D BDs can have 100+. */
        } ads;

        /* inline file */
        struct {
            uint32_t       information_length; /* recorded information length, may be different than file length */
            uint8_t        content[1]; /* content of small files is embedded here */
        } data;
    } u;
};

struct file_entry *decode_file_entry    (ecma_ctx *, const uint8_t *p, size_t size, uint16_t partition);
struct file_entry *decode_ext_file_entry(ecma_ctx *, const uint8_t *p, size_t size, uint16_t partition);
void               free_file_entry      (struct file_entry **p_fe);

int decode_allocation_extent(ecma_ctx *, struct file_entry **p_fe, const uint8_t *p, size_t size, uint16_t partition);

#endif /* UDFREAD_ECMA167_H_ */

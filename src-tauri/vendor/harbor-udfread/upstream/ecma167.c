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

#include "ecma167.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define ecma_error(...) \
    do { const ecma_ctx *_ctx = (ctx); if (_ctx && _ctx->lc) _ctx->lc->logger(_ctx->lc->ctx, "ecma: " __VA_ARGS__); } while (0)

/*
 * Part 1: General
 */

/* fixed-length dstring, ECMA 1/7.2.12 */
static uint8_t _decode_dstring(const uint8_t *p, size_t field_length, uint8_t *str)
{
    size_t length;

    if (field_length < 1) {
        return 0;
    }
    field_length--;

    length = _get_u8(p + field_length);
    if (length > field_length) {
        length = field_length;
    }
    memcpy(str, p, length);
    return (uint8_t)length;
}

/* Extent Descriptor (ECMA 167, 3/7.1) */
static void _decode_extent_ad(const uint8_t *p, struct extent_ad *ad)
{
    ad->length = _get_u32(p + 0);
    ad->lba    = _get_u32(p + 4);
}

/* Entity Identifier (ECMA 167, 1/7.4) */
void decode_entity_id(const uint8_t *p, struct entity_id *eid)
{
    memcpy(eid->identifier,        p + 1,  23);
    memcpy(eid->identifier_suffix, p + 24, 8);
}

/*
 * Part 3: Volume Structure
 */

/* CRC-ITU-T (ECMA 167, 3/7.2.6): polynomial x^16+x^12+x^5+1, initial value 0 */
static uint16_t _crc_itut(const uint8_t *p, size_t len)
{
    uint16_t crc = 0;

    while (len--) {
        unsigned int bit;

        crc ^= (uint16_t)(*p++ << 8);
        for (bit = 0; bit < 8; bit++) {
            if (crc & 0x8000) {
                crc = (uint16_t)((crc << 1) ^ 0x1021);
            } else {
                crc = (uint16_t)(crc << 1);
            }
        }
    }

    return crc;
}

/* Descriptor Tag (ECMA 167, 3/7.2) */
enum tag_identifier decode_descriptor_tag(const uint8_t *buf, size_t size)
{
  uint16_t id;
  uint32_t version;
  uint32_t crc_len;
  uint8_t  checksum = 0;
  int      i;

  if (size < 16) {
      return ECMA_TAG_INVALID;
  }

  id = _get_u16(buf + 0);

  /* descriptor tag is 16 bytes */

  /* descriptor version number shall be 2 or 3 (ECMA 167, 3/7.2.2) */
  version = _get_u16(buf + 2);
  if (version < 2 || version > 3) {
      return ECMA_TAG_INVALID;
  }

  /* calculate tag checksum */
  for (i = 0; i < 4; i++) {
      checksum = (uint8_t)(checksum + buf[i]);
  }
  for (i = 5; i < 16; i++) {
      checksum = (uint8_t)(checksum + buf[i]);
  }

  if (checksum != buf[4]) {
      return ECMA_TAG_INVALID;
  }

  /* descriptor CRC covers bytes following the tag (ECMA 167, 3/7.2.5..7).
   * length 0 => no CRC recorded */
  crc_len = _get_u16(buf + 10);
  if (crc_len) {
      if ((size_t)16 + crc_len > size ||
          _crc_itut(buf + 16, crc_len) != _get_u16(buf + 8)) {
          return ECMA_TAG_INVALID;
      }
  }

  return (enum tag_identifier)id;
}

/* Primary Volume Descriptor (ECMA 167, 3/10.1) */
void decode_primary_volume(const uint8_t *p, struct primary_volume_descriptor *pvd)
{
    pvd->volume_identifier_length = _decode_dstring(p + 24, 32, pvd->volume_identifier);

    memcpy(pvd->volume_set_identifier, p + 72, 128);
}

/* Anchor Volume Descriptor Pointer (ECMA 167 3/10.2) */
void decode_avdp(const uint8_t *p, struct anchor_volume_descriptor *avdp)
{
    /* Main volume descriptor sequence extent */
    _decode_extent_ad(p + 16, &avdp->mvds);

    /* Reserve (backup) volume descriptor sequence extent */
    _decode_extent_ad(p + 24, &avdp->rvds);
}

/* Volume Descriptor Pointer (ECMA 167 3/10.3) */
void decode_vdp(const uint8_t *p, struct volume_descriptor_pointer *vdp)
{
    _decode_extent_ad(p + 20, &vdp->next_extent);
}

/* Partition Descriptor (ECMA 167 3/10.5) */
void decode_partition(const uint8_t *p, struct partition_descriptor *pd)
{
    pd->number      = _get_u16(p + 22);
    pd->start_block = _get_u32(p + 188);
    pd->num_blocks  = _get_u32(p + 192);
}

/* Logical Volume Descriptor (ECMA 167 3/10.6) */
void decode_logical_volume(const uint8_t *p, struct logical_volume_descriptor *lvd)
{
    size_t map_size;

    lvd->block_size = _get_u32(p + 212);

    decode_entity_id(p + 216, &lvd->domain_id);

    memcpy(lvd->contents_use, p + 248, 16);

    lvd->partition_map_table_length = _get_u32(p + 264);
    lvd->num_partition_maps         = _get_u32(p + 268);

    /* XXX cut long maps */
    map_size = lvd->partition_map_table_length;
    if (map_size > sizeof(lvd->partition_map_table)) {
        map_size = sizeof(lvd->partition_map_table);
    }

    /* input size is one block (2048 bytes) */
    if (map_size > 2048 - 440) {
        map_size = 2048 - 440;
    }

    memcpy(lvd->partition_map_table, p + 440, map_size);
}

/*
 * Part 4: File Structure
 */

/* File Set Descriptor (ECMA 167 4/14.1) */
void decode_file_set_descriptor(const uint8_t *p, struct file_set_descriptor *fsd)
{
    decode_long_ad(p + 400, &fsd->root_icb);
}

/* File Identifier (ECMA 167 4/14.4) */
size_t decode_file_identifier(ecma_ctx *ctx, const uint8_t *p, size_t size, struct file_identifier *fi)
{
    size_t l_iu; /* length of implementation use field */

    if (size < 38) {
        ecma_error("decode_file_identifier: not enough data\n");
        return 0;
    }

    fi->characteristic = _get_u8(p + 18);
    fi->filename_len   = _get_u8(p + 19);
    decode_long_ad(p + 20, &fi->icb);

    l_iu = _get_u16(p + 36);

#if defined(ECMA_CONFORMANCE) && ECMA_CONFORMANCE > 0
    /* L_IU shall be recorded as a multiple of 4 (ECMA 167, 4/14.4.2) */
    if (l_iu & 3) {
        ecma_error("decode_file_identifier: invalid l_iu %d\n", l_iu);
        return 0;
    }
#endif

    if (size < 38 + l_iu + fi->filename_len) {
        ecma_error("decode_file_identifier: not enough data\n");
        return 0;
    }

    if (fi->filename_len) {
        memcpy(fi->filename, p + 38 + l_iu, fi->filename_len);
    }
    fi->filename[fi->filename_len] = 0;

    /* ECMA 167, 4/14.4
     * padding size 4 * ip((L_FI+L_IU+38+3)/4) - (L_FI+L_IU+38)
     * => padded to dwords
     */
    return 4 * ((38 + (size_t)fi->filename_len + l_iu + 3) / 4);
}

/* ICB Tag (ECMA 167 4/14.6) */

struct icb_tag {
    uint8_t  file_type;
    uint16_t strategy_type;
    uint16_t flags;
};

static void _decode_icb_tag(const uint8_t *p, struct icb_tag *tag)
{
    tag->strategy_type = _get_u16(p + 4);
    tag->file_type     = _get_u8 (p + 11);
    tag->flags         = _get_u16(p + 18);
}

/* Allocation Descriptors */

#define AD_LENGTH_MASK    0x3fffffff
#define AD_TYPE(length)  ((length) >> 30)

/* Short Allocation Descriptor (ECMA 167, 4/14.14.1) */
static void _decode_short_ad(const uint8_t *buf, uint16_t partition, struct long_ad *ad)
{
    uint32_t u32 = _get_u32(buf + 0);
    ad->extent_type = AD_TYPE(u32);
    ad->length    = u32 & AD_LENGTH_MASK;
    ad->lba       = _get_u32(buf + 4);
    ad->partition = partition;
}

/* Long Allocation Descriptor (ECMA 167, 4/14.14.2) */
void decode_long_ad(const uint8_t *buf, struct long_ad *ad)
{
    uint32_t u32 = _get_u32(buf + 0);
    ad->extent_type = AD_TYPE(u32);
    ad->length    = u32 & AD_LENGTH_MASK;
    ad->lba       = _get_u32(buf + 4);
    ad->partition = _get_u16(buf + 8);
}

/* Exrtended Allocation Descriptor (ECMA 167, 4/14.14.3) */
static void _decode_extended_ad(const uint8_t *buf, struct long_ad *ad)
{
    uint32_t u32 = _get_u32(buf + 0);
    ad->extent_type = AD_TYPE(u32);
    ad->length    = u32 & AD_LENGTH_MASK;
    ad->lba       = _get_u32(buf + 12);
    ad->partition = _get_u16(buf + 16);
}

/* File Entry */

static void _decode_file_ads(const uint8_t *p, int ad_type, uint16_t partition,
                             struct long_ad *ad, unsigned num_ad)
{
    uint32_t i;

    for (i = 0; i < num_ad; i++) {
        switch (ad_type) {
        case 0:
            _decode_short_ad(p, partition, &ad[i]);
            p += 8;
            break;
        case 1:
            decode_long_ad(p, &ad[i]);
            p += 16;
            break;
        case 2:
            _decode_extended_ad(p, &ad[i]);
            p += 20;
            break;
        }
    }
}

static struct file_entry *_decode_file_entry(ecma_ctx *ctx,
                                             const uint8_t *p, size_t size,
                                             uint16_t partition, uint32_t l_ad, uint32_t p_ad)
{
    struct file_entry *fe;
    struct icb_tag     tag;
    uint32_t           num_ad;
    int                content_inline = 0;

    if (p_ad + l_ad > size) {
        ecma_error("decode_file_entry: not enough data\n");
        return NULL;
    }

    _decode_icb_tag(p + 16, &tag);
    if (tag.strategy_type != 4) {
        /* UDF (2.): only ICB strategy types 4 and 4096 shall be recorded */
        ecma_error("decode_file_entry: unsupported icb strategy type %d\n",
                   tag.strategy_type);
        return NULL;
    }

    switch (tag.flags & 7) {
        case 0: num_ad = l_ad / 8;  break;
        case 1: num_ad = l_ad / 16; break;
        case 2: num_ad = l_ad / 20; break;
        case 3:
            num_ad = 0;
            content_inline = 1;
            break;
        default:
            ecma_error("decode_file_entry: unsupported icb flags: 0x%x\n", tag.flags);
            return NULL;
    }

    if (num_ad < 1) {
        fe = (struct file_entry *)calloc(1, sizeof(struct file_entry) + l_ad);
    } else {
        fe = (struct file_entry *)calloc(1, sizeof(struct file_entry) + sizeof(struct long_ad) * (num_ad - 1));
    }

    if (!fe) {
        return NULL;
    }

    fe->file_type = tag.file_type;
    fe->length    = _get_u64(p + 56);
    fe->ad_type   = tag.flags & 7;

    if (content_inline) {
        /* data of small files can be embedded in file entry */
        /* copy embedded file data */
        fe->content_inline = 1;
        fe->u.data.information_length = l_ad;
        memcpy(fe->u.data.content, p + p_ad, l_ad);
    } else {
        fe->u.ads.num_ad = num_ad;
        _decode_file_ads(p + p_ad, fe->ad_type, partition, &fe->u.ads.ad[0], num_ad);
    }

    return fe;
}

int decode_allocation_extent(ecma_ctx *ctx, struct file_entry **p_fe, const uint8_t *p, size_t size, uint16_t partition)
{
    struct file_entry *fe = *p_fe;
    uint32_t l_ad, num_ad;
    uint64_t total_ads;

    l_ad = _get_u32(p + 20);
    if (size < 24 || size - 24 < l_ad) {
        ecma_error("decode_allocation_extent: invalid allocation extent (l_ad)\n");
        return -1;
    }

    switch (fe->ad_type) {
        case 0: num_ad = l_ad / 8;  break;
        case 1: num_ad = l_ad / 16; break;
        case 2: num_ad = l_ad / 20; break;
        default:
            return -1;
    }

    if (num_ad < 1) {
        ecma_error("decode_allocation_extent: empty allocation extent\n");
        return 0;
    }

    /* check for integer overflow */
    total_ads = (uint64_t)fe->u.ads.num_ad + (uint64_t)num_ad;
    if (total_ads >= (uint64_t)1<<32 ||
        total_ads > (SIZE_MAX - sizeof(struct file_entry)) / sizeof(struct long_ad)) {
        ecma_error("decode_allocation_extent: too many allocation descriptors\n");
        return -1;
    }

    fe = (struct file_entry *)realloc(*p_fe, sizeof(struct file_entry) + sizeof(struct long_ad) * (size_t)total_ads);
    if (!fe) {
        return -1;
    }
    *p_fe = fe;

    /* decode new allocation descriptors */
    _decode_file_ads(p + 24, fe->ad_type, partition, &fe->u.ads.ad[fe->u.ads.num_ad], num_ad);
    fe->u.ads.num_ad += num_ad;

    return 0;
}

/* File Entry (ECMA 167, 4/14.9) */
struct file_entry *decode_file_entry(ecma_ctx *ctx, const uint8_t *p, size_t size, uint16_t partition)
{
    uint32_t l_ea, l_ad;

    l_ea = _get_u32(p + 168);
    l_ad = _get_u32(p + 172);

    /* check for integer overflow */
    if ((uint64_t)l_ea + (uint64_t)l_ad + (uint64_t)176 >= (uint64_t)1<<32) {
        ecma_error("invalid file entry\n");
        return NULL;
    }

    return _decode_file_entry(ctx, p, size, partition, l_ad, 176 + l_ea);
}

/* Extended File Entry (ECMA 167, 4/14.17) */
struct file_entry *decode_ext_file_entry(ecma_ctx *ctx, const uint8_t *p, size_t size, uint16_t partition)
{
    uint32_t l_ea, l_ad;

    l_ea = _get_u32(p + 208);
    l_ad = _get_u32(p + 212);

    /* check for integer overflow */
    if ((uint64_t)l_ea + (uint64_t)l_ad + (uint64_t)216 >= (uint64_t)1<<32) {
        ecma_error("invalid extended file entry\n");
        return NULL;
    }

    return _decode_file_entry(ctx, p, size, partition, l_ad, 216 + l_ea);
}

void free_file_entry(struct file_entry **p_fe)
{
    if (p_fe) {
        free(*p_fe);
        *p_fe = NULL;
    }
}

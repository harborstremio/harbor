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

#include "udf_volume.h"
#include "ecma167.h"

#include "attributes.h"
#include "udfread.h"  /* constants from API */

#include <stdint.h>
#include <stdlib.h>
#include <string.h>


#define udf_error(...)   udf_log_msg(ecma->lc, UDFREAD_LOG_ERROR, "udfread ERROR: ", __VA_ARGS__)
#define udf_log(...)     udf_log_msg(ecma->lc, UDFREAD_LOG_INFO,  "udfread LOG  : ", __VA_ARGS__)
#define udf_trace(...)   udf_log_msg(ecma->lc, UDFREAD_LOG_TRACE, "udfread TRACE: ", __VA_ARGS__)

/* Safety limits for VDS parsing (prevent infinite loops on corrupted media) */
#define UDF_MAX_VDP_COUNT    100    /* max Volume Descriptor Pointers in chain */
#define UDF_MAX_VDS_BLOCKS   10000  /* max blocks in a Volume Descriptor Sequence */

/* Additional File Types (UDF 2.60, 2.3.5.2) */
enum udf_file_type {
    UDF_FT_METADATA        = 250,
    UDF_FT_METADATA_MIRROR = 251,
};

/*
 * Domain Identifiers, UDF 2.1.5.2
 */

static const char lvd_domain_id[]  = "*OSTA UDF Compliant";
static const char meta_domain_id[] = "*UDF Metadata Partition";

static int _check_domain_identifier(const struct entity_id *eid, const char *value)
{
    return (!memcmp(value, eid->identifier, strlen(value))) ? 0 : -1;
}

/*
 * Disc probing
 */

int udf_probe_volume(ecma_ctx *ecma, udfread_block_input *input)
{
    /* Volume Recognition (ECMA 167 2/8, UDF 2.60 2.1.7) */

    static const char bea[]    = {'\0',  'B',  'E',  'A',  '0',  '1', '\1'};
    static const char nsr_02[] = {'\0',  'N',  'S',  'R',  '0',  '2', '\1'};
    static const char nsr_03[] = {'\0',  'N',  'S',  'R',  '0',  '3', '\1'};
    static const char tea[]    = {'\0',  'T',  'E',  'A',  '0',  '1', '\1'};
    static const char nul[]    = {'\0', '\0', '\0', '\0', '\0', '\0', '\0'};

    uint8_t  buf[UDF_BLOCK_SIZE];
    uint32_t lba;
    int      bea_seen = 0;

    for (lba = 16; lba < 256; lba++) {
        if (input->read(input, lba, buf, 1, 0) == 1) {

            /* Terminating Extended Area Descriptor */
            if (!memcmp(buf, tea, sizeof(tea))) {
                udf_error("ECMA 167 Volume Recognition failed (no NSR descriptor)\n");
                return -1;
            }
            if (!memcmp(buf, nul, sizeof(nul))) {
                break;
            }
            if (!memcmp(buf, bea, sizeof(bea))) {
                udf_trace("ECMA 167 Volume, BEA01\n");
                bea_seen = 1;
            }

            if (bea_seen) {
                if (!memcmp(buf, nsr_02, sizeof(nsr_02))) {
                    udf_trace("ECMA 167 Volume, NSR02\n");
                    return 0;
                }
                if (!memcmp(buf, nsr_03, sizeof(nsr_03))) {
                    udf_trace("ECMA 167 Volume, NSR03\n");
                    return 0;
                }
            }
        }
    }

    udf_error("ECMA 167 Volume Recognition failed\n");
    return -1;
}

/*
 * Volume structure
 */

static int _read_descriptor_block(udfread_block_input *input, uint32_t lba, uint8_t *buf)
{
    if (input->read(input, lba, buf, 1, 0) == 1) {
        return decode_descriptor_tag(buf, UDF_BLOCK_SIZE);
    }

    return -1;
}

static int _read_avdp(ecma_ctx *ecma, udfread_block_input *input,
                      struct anchor_volume_descriptor *avdp)
{
    uint8_t  buf[UDF_BLOCK_SIZE];
    int      tag_id;
    uint32_t lba = 256;

    /*
     * Find Anchor Volume Descriptor Pointer.
     * It is in block 256, last block or (last block - 256)
     * (UDF 2.60, 2.2.3)
     */

    /* try block 256 */
    tag_id = _read_descriptor_block(input, lba, buf);
    if (tag_id != ECMA_AnchorVolumeDescriptorPointer) {

        /* try last block */
        if (!input->size) {
            udf_error("Can't find Anchor Volume Descriptor Pointer\n");
            return -1;
        }

        lba = input->size(input) - 1;
        tag_id = _read_descriptor_block(input, lba, buf);
        if (tag_id != ECMA_AnchorVolumeDescriptorPointer) {

            /* try last block - 256 */
            lba -= 256;
            tag_id = _read_descriptor_block(input, lba, buf);
            if (tag_id != ECMA_AnchorVolumeDescriptorPointer) {
                udf_error("Can't find Anchor Volume Descriptor Pointer\n");
                return -1;
            }
        }
    }
    udf_log("Found Anchor Volume Descriptor Pointer from lba %u\n", lba);

    decode_avdp(buf, avdp);

    return 1;
}

#define VDS_HAVE_PART     (1<<0)
#define VDS_HAVE_PVD      (1<<1)
#define VDS_HAVE_LVD      (1<<2)
#define VDS_HAVE_REQUIRED (VDS_HAVE_PART | VDS_HAVE_PVD)
#define VDS_HAVE_ALL      (VDS_HAVE_PART | VDS_HAVE_PVD | VDS_HAVE_LVD)
/* Volume Descriptor Sequence Number (ECMA 167 3/7.2.2, descriptor tag @16) */
static uint32_t _descriptor_seq(const uint8_t *buf)
{
    return _get_u32(buf + 16);
}

/*
 * Candidate tracking for the Volume Descriptor Sequence search.
 *
 * Complete descriptor set instances (partition + PVD + LVD) compete by
 * Volume Descriptor Sequence Number (ECMA 167 3/8.4.3).
 * Instances carrying only the required descriptors (partition + PVD) are kept as a fallback.
 * Anything else is merged per descriptor class as a last resort.
 */
struct vds_scan {
    struct volume_descriptor_set all;       /* highest-seq complete instance */
    uint32_t all_seq;
    int      have_all;

    struct volume_descriptor_set required;  /* highest-seq PART|PVD-only instance */
    uint32_t required_seq;
    int      have_required;

    struct volume_descriptor_set partial;   /* per-class merge of leftovers */
    unsigned partial_mask;
};

/* flush a finished instance into the candidate tiers */
static void _vds_flush_instance(ecma_ctx *ecma, struct vds_scan *scan,
                                const struct volume_descriptor_set *cand,
                                unsigned cand_mask, uint32_t cand_seq)
{
    if (cand_mask == VDS_HAVE_ALL) {
        if (!scan->have_all || cand_seq > scan->all_seq) {
            scan->all      = *cand;
            scan->all_seq  = cand_seq;
            scan->have_all = 1;
        }
        return;
    }

    if ((cand_mask & VDS_HAVE_REQUIRED) == VDS_HAVE_REQUIRED) {
        udf_trace("discarding incomplete Volume Descriptor Sequence instance (seq %u)\n", cand_seq);
        if (!scan->have_required || cand_seq > scan->required_seq) {
            scan->required      = *cand;
            scan->required_seq  = cand_seq;
            scan->have_required = 1;
        }
        return;
    }

    if (cand_mask) {
        udf_trace("discarding incomplete Volume Descriptor Sequence instance (seq %u)\n", cand_seq);
        if (cand_mask & VDS_HAVE_PVD) {
            scan->partial.pvd = cand->pvd;
        }
        if (cand_mask & VDS_HAVE_PART) {
            scan->partial.pd = cand->pd;
        }
        if (cand_mask & VDS_HAVE_LVD) {
            scan->partial.lvd = cand->lvd;
        }
        scan->partial_mask |= cand_mask;
    }
}

/* scan one Volume Descriptor Sequence extent chain.
 * results accumulate in the candidate tracker */
static void _search_vds(ecma_ctx *ecma, udfread_block_input *input,
                        int part_number, const struct extent_ad *loc,
                        struct vds_scan *scan)
{
    struct volume_descriptor_pointer vdp;
    struct volume_descriptor_set cand;
    uint8_t  buf[UDF_BLOCK_SIZE];
    unsigned cand_mask = 0;
    uint32_t cand_seq = 0;
    int      tag_id;
    uint32_t lba;
    uint32_t end_lba;
    unsigned vdp_count = 0;
    unsigned block_count = 0;

    memset(&cand, 0, sizeof(cand));

next_extent:
    udf_trace("reading Volume Descriptor Sequence at lba %u, len %u bytes\n", loc->lba, loc->length);

    end_lba = loc->lba + loc->length / UDF_BLOCK_SIZE;

    /* parse Volume Descriptor Sequence */
    for (lba = loc->lba; lba < end_lba; lba++) {

        if (++block_count > UDF_MAX_VDS_BLOCKS) {
            udf_error("too many blocks in Volume Descriptor Sequence (possible corruption)\n");
            goto done;
        }

        tag_id = _read_descriptor_block(input, lba, buf);

        switch (tag_id) {

        case ECMA_VolumeDescriptorPointer:
            decode_vdp(buf, &vdp);
            loc = &vdp.next_extent;
            if (++vdp_count > UDF_MAX_VDP_COUNT) {
                udf_error("too many Volume Descriptor Pointers (possible loop)\n");
                goto done;
            }
            goto next_extent;

        case ECMA_TerminatingDescriptor:
            udf_trace("Terminating Descriptor in lba %u\n", lba);
            goto done;

        case ECMA_PrimaryVolumeDescriptor:
        case ECMA_PartitionDescriptor:
        case ECMA_LogicalVolumeDescriptor:
            break;

        default:
            /* unknown tag or read error: skip block */
            continue;
        }

        /* a new Volume Descriptor Sequence Number starts a new instance
         * of the descriptor set */
        if (_descriptor_seq(buf) != cand_seq) {
            _vds_flush_instance(ecma, scan, &cand, cand_mask, cand_seq);
            cand_seq = _descriptor_seq(buf);
            cand_mask = 0;
            memset(&cand, 0, sizeof(cand));
        }

        switch (tag_id) {

        case ECMA_PrimaryVolumeDescriptor:
            udf_log("Primary Volume Descriptor in lba %u\n", lba);
            decode_primary_volume(buf, &cand.pvd);
            cand_mask |= VDS_HAVE_PVD;
            break;

        case ECMA_LogicalVolumeDescriptor:
            udf_log("Logical volume descriptor in lba %u\n", lba);
            decode_logical_volume(buf, &cand.lvd);
            cand_mask |= VDS_HAVE_LVD;
            break;

        case ECMA_PartitionDescriptor:
          udf_log("Partition Descriptor in lba %u\n", lba);
          if (!(cand_mask & VDS_HAVE_PART) ||
              part_number == UDFREAD_PARTITION_LAST) {
              decode_partition(buf, &cand.pd);
              if (part_number < 0 || part_number == cand.pd.number) {
                  cand_mask |= VDS_HAVE_PART;
              }
              udf_log("  partition %u at lba %u, %u blocks\n", cand.pd.number, cand.pd.start_block, cand.pd.num_blocks);
          }
          break;
        }
    }

done:
    _vds_flush_instance(ecma, scan, &cand, cand_mask, cand_seq);
}

int udf_read_vds(ecma_ctx *ecma, udfread_block_input *input,
                 int part_number,
                 struct volume_descriptor_set *vds)
{
    struct anchor_volume_descriptor avdp;
    struct vds_scan scan;

    /* Find Anchor Volume Descriptor */
    if (_read_avdp(ecma, input, &avdp) < 0) {
        return -1;
    }

    memset(vds, 0, sizeof(*vds));
    memset(&scan, 0, sizeof(scan));

    /* try to read Main Volume Descriptor Sequence */
    _search_vds(ecma, input, part_number, &avdp.mvds, &scan);
    if (scan.have_all) {
        /* all data found */
        *vds = scan.all;
        return 0;
    }

    /*
     * Some (or all) descriptors are missing.
     * Try to read missing descriptors from backup area.
     */

    /* try to read Backup Volume Descriptor */
    _search_vds(ecma, input, part_number, &avdp.rvds, &scan);

    if (scan.have_all) {
        *vds = scan.all;
        return 0;
    }

    if (scan.have_required) {
        /* all strictly needed data found (LVD missing) */
        udf_log("using Volume Descriptor Sequence without Logical Volume Descriptor (seq %u)\n",
                scan.required_seq);
        *vds = scan.required;
        return 0;
    }

    /* last resort: merge partial descriptors from different sequences */
    if ((scan.partial_mask & VDS_HAVE_REQUIRED) == VDS_HAVE_REQUIRED) {
        udf_log("merging partial Volume Descriptor Sequences\n");
        *vds = scan.partial;
        return 0;
    }

    udf_error("failed reading Volume Descriptor Sequence\n");
    return -1;
}

int udf_validate_logical_volume(ecma_ctx *ecma, const struct logical_volume_descriptor *lvd, struct long_ad *fsd_loc)
{
    if (lvd->block_size != UDF_BLOCK_SIZE) {
        udf_error("incompatible block size %u\n", lvd->block_size);
        return -1;
    }

    /* UDF 2.60 2.1.5.2 */
    if (_check_domain_identifier(&lvd->domain_id, lvd_domain_id) < 0) {
        udf_error("unknown Domain ID in Logical Volume Descriptor: %1.22s\n", lvd->domain_id.identifier);
        return -1;

    } else {

        /* UDF 2.60 2.1.5.3 */
        uint16_t rev = _get_u16(lvd->domain_id.identifier_suffix);
        udf_log("Found UDF %x.%02x Logical Volume\n", rev >> 8, rev & 0xff);

        /* UDF 2.60 2.2.4.4 */

        /* location of File Set Descriptors */
        decode_long_ad(lvd->contents_use, fsd_loc);

        udf_log("File Set Descriptor location: partition %u lba %u (len %u)\n",
                fsd_loc->partition, fsd_loc->lba, fsd_loc->length);
    }

    return 0;
}

/*
 * Partitions
 */

/* Interim support level: only the first allocation extent of the metadata
 * files is mapped (full extent-list support: METADATA-PARTITION.md). */
static void _check_metadata_fragmentation(ecma_ctx *ecma,
                                          const struct file_entry *fe, unsigned int idx)
{
    if (fe->length > fe->u.ads.ad[0].length) {
        udf_error("unsupported: metadata file %u spans multiple allocation "
                  "extents, mapping only the first extent\n", idx);
    }
}

static int _map_metadata_partition(udfread_block_input *input,
                                   ecma_ctx *ecma,
                                   struct udf_partitions *part,
                                   uint32_t lba, uint32_t mirror_lba,
                                   const struct partition_descriptor *pd)
{
    struct file_entry *fe;
    uint8_t       buf[UDF_BLOCK_SIZE];
    int           tag_id;
    unsigned int  i;
    uint32_t      ext_len[2] = { 0, 0 };  /* first extent size, blocks */

    /* resolve metadata partition location (it is virtual partition inside another partition) */
    udf_trace("Reading metadata file entry: lba %u, mirror lba %u\n", lba, mirror_lba);

    for (i = 0; i < 2; i++) {

        if (i == 0) {
            tag_id = _read_descriptor_block(input, pd->start_block + lba, buf);
        } else {
            tag_id = _read_descriptor_block(input, pd->start_block + mirror_lba, buf);
        }

        if (tag_id != ECMA_ExtendedFileEntry) {
            udf_error("read metadata file %u: unexpected tag %d\n", i, tag_id);
            continue;
        }

        fe = decode_ext_file_entry(ecma, buf, UDF_BLOCK_SIZE, pd->number);
        if (!fe) {
            udf_error("parsing metadata file entry %u failed\n", i);
            continue;
        }

        if (fe->content_inline) {
            udf_error("invalid metadata file (content inline)\n");
        } else if (!fe->u.ads.num_ad) {
            udf_error("invalid metadata file (no allocation descriptors)\n");
        } else if (fe->file_type == UDF_FT_METADATA) {
            part->p[1].lba = pd->start_block + fe->u.ads.ad[0].lba;
            ext_len[0]     = fe->u.ads.ad[0].length / UDF_BLOCK_SIZE;
            _check_metadata_fragmentation(ecma, fe, i);
            udf_log("metadata file at lba %u\n", part->p[1].lba);
        } else if (fe->file_type == UDF_FT_METADATA_MIRROR) {
            part->p[1].mirror_lba = pd->start_block + fe->u.ads.ad[0].lba;
            ext_len[1]            = fe->u.ads.ad[0].length / UDF_BLOCK_SIZE;
            _check_metadata_fragmentation(ecma, fe, i);
            udf_log("metadata mirror file at lba %u\n", part->p[1].mirror_lba);
        } else {
            udf_error("unknown metadata file type %u\n", fe->file_type);
        }

        free_file_entry(&fe);
    }

    if (!part->p[1].lba && part->p[1].mirror_lba) {
        /* failed reading primary location, must use mirror */
        part->p[1].lba        = part->p[1].mirror_lba;
        part->p[1].mirror_lba = 0;
    }

    /* virtual partition size: first extent only; smaller of the two files
     * when both are known (contents must be identical) */
    if (ext_len[0] && ext_len[1]) {
        part->p[1].length = ext_len[0] < ext_len[1] ? ext_len[0] : ext_len[1];
    } else {
        part->p[1].length = ext_len[0] + ext_len[1];
    }

    return part->p[1].lba ? 0 : -1;
}

int udf_parse_partition_maps(ecma_ctx *ecma, udfread_block_input *input,
                             const struct volume_descriptor_set *vds,
                             struct udf_partitions *part)
{
    /* parse partition maps
     * There should be one type1 partition.
     * There may be separate metadata partition.
     * metadata partition is virtual partition that is mapped to metadata file.
     */

    const uint8_t *map = vds->lvd.partition_map_table;
    const uint8_t *end = map + vds->lvd.partition_map_table_length;
    unsigned int   i;
    int            num_type1_partition = 0;

    udf_log("Partition map count: %u\n", vds->lvd.num_partition_maps);
    if (vds->lvd.partition_map_table_length > sizeof(vds->lvd.partition_map_table)) {
        udf_error("partition map table too big !\n");
        end -= vds->lvd.partition_map_table_length - sizeof(vds->lvd.partition_map_table);
    }

    for (i = 0; i < vds->lvd.num_partition_maps && map + 2 < end; i++) {

        /* Partition map, ECMA 167 3/10.7 */
        uint8_t  type = _get_u8(map + 0);
        uint8_t  len  = _get_u8(map + 1);
        uint16_t ref;

        if (len < 2) {
            udf_error("invalid partition map length %d\n", (int)len);
            break;
        }

        udf_trace("map %u: type %u\n", i, type);
        if (map + len > end) {
            udf_error("partition map table too short !\n");
            break;
        }

        if (type == 1) {

            /* ECMA 167 Type 1 partition map */

            if (len != 6) {
                udf_error("invalid type 1 partition map length %d\n", (int)len);
                break;
            }

            ref = _get_u16(map + 4);
            udf_log("partition map: %u: type 1 partition, ref %u\n", i, ref);

            if (num_type1_partition) {
                udf_error("more than one type1 partitions not supported\n");
            } else if (ref != vds->pd.number) {
                udf_error("Logical partition %u refers to another physical partition %u (expected %u)\n", i, ref, vds->pd.number);
            } else {
                part->num_partition   = 1;
                part->p[0].number     = i;
                part->p[0].lba        = vds->pd.start_block;
                part->p[0].mirror_lba = 0; /* no mirror for data partition */
                part->p[0].length     = vds->pd.num_blocks;

                num_type1_partition++;
            }

        } else if (type == 2) {

            /* Type 2 partition map, UDF 2.60 2.2.18 */

            if (len != 64) {
                udf_error("invalid type 2 partition map length %d\n", (int)len);
                break;
            }

            struct entity_id type_id;
            decode_entity_id(map + 4, &type_id);
            if (!_check_domain_identifier(&type_id, meta_domain_id)) {

                /* Metadata Partition, UDF 2.60 2.2.10 */

                uint32_t lba, mirror_lba;

                ref        = _get_u16(map + 38);
                lba        = _get_u32(map + 40);
                mirror_lba = _get_u32(map + 44);
                if (ref != vds->pd.number) {
                    udf_error("metadata file partition %u != %u\n", ref, vds->pd.number);
                }

                if (!_map_metadata_partition(input, ecma, part, lba, mirror_lba, &vds->pd)) {
                    part->num_partition = 2;
                    part->p[1].number   = i;
                    udf_log("partition map: %u: metadata partition, ref %u. lba %u, mirror %u\n", i, ref, part->p[1].lba, part->p[1].mirror_lba);
                }

            } else {
                udf_log("%u: unsupported type 2 partition\n", i);
            }
        }
        map += len;
    }

    if (!num_type1_partition) {
        udf_error("no type 1 partition found\n");
        return -1;
    }
    return 0;
}

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

#ifndef UDFREAD_UDF_H_
#define UDFREAD_UDF_H_

#include "ecma167.h"
#include "blockinput.h"

#include <stdint.h> /* *int_t */

/**
 * Probe disc
 */

int udf_probe_volume(ecma_ctx *, udfread_block_input *input);


/**
 * Volume structure
 */

struct volume_descriptor_set {
    struct partition_descriptor      pd;
    struct primary_volume_descriptor pvd;
    struct logical_volume_descriptor lvd;
};

int udf_read_vds(ecma_ctx *, udfread_block_input *input,
                 int part_number,
                 struct volume_descriptor_set *vds);

int udf_validate_logical_volume(ecma_ctx *, const struct logical_volume_descriptor *lvd, struct long_ad *fsd_loc);

/**
 * Partitions
 */

/* Logical Partitions from Logical Volume Descriptor */
struct udf_partitions {
    uint32_t num_partition;
    struct {
        uint16_t number;
        uint32_t lba;
        uint32_t mirror_lba;
        uint32_t length;      /* partition size in blocks, 0 = unknown */
    } p[2];
};

int udf_parse_partition_maps(ecma_ctx *ecma, udfread_block_input *input,
                             const struct volume_descriptor_set *vds,
                             struct udf_partitions *part);

#endif /* UDFREAD_UDF_H_ */

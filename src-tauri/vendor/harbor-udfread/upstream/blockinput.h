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

#ifndef UDFREAD_BLOCKINPUT_H_
#define UDFREAD_BLOCKINPUT_H_

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

/**
 * @file blockinput.h
 * @brief block-level input callbacks for accessing UDF image
 *
 * @note All block addresses are in 2048-byte blocks.
 */

/** @cond */
#ifndef UDF_BLOCK_SIZE
#  define UDF_BLOCK_SIZE  2048
#endif
/** @endcond */

typedef struct udfread_block_input udfread_block_input;

/**
 *  Block input access functions
 *
 *  Provide these callbacks to udfread_open_input() to access UDF image
 *  outside of local filesystem.
 *  Optional callbacks may be NULL.
 */
struct udfread_block_input {
    /**
     *  Close input
     *  Optional; may be NULL.
     */
    int      (*close) (udfread_block_input *);
    /**
     *  Read blocks from input
     *  Mandatory.
     *
     *  May be called concurrently from multiple threads; the input must be
     *  thread-safe (or externally synchronized).
     *
     * @param input  block input
     * @param lba  block address to read from
     * @param buf  buffer for data
     * @param nblocks  number of blocks to read
     * @param flags  read flags (passthru from udfread_read_blocks())
     * @return number of blocks read, 0 on error
     */
    int      (*read)  (udfread_block_input *input, uint32_t lba, void *buf, uint32_t nblocks, int flags);
    /**
     *  Input size in blocks
     *  Optional; may be NULL.
     */
    uint32_t (*size)  (udfread_block_input *);
};


#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* UDFREAD_BLOCKINPUT_H_ */

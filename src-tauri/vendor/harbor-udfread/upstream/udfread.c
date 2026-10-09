/*
 * Harbor modification, 2026-10-03: reject all non-regular file types in
 * _file_open; retain the original read-only directory and stream behavior.
 *
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

#include "udfread.h"

#ifdef HAVE_UDFREAD_VERSION_H
#include "udfread-version.h"
#endif

#include "blockinput.h"
#include "default_blockinput.h"
#include "ecma167.h"
#include "udf_volume.h"
#include "udf_fs.h"
#include "udf_atomic.h"

#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h> /* default logger */

#ifdef _WIN32
#define strtok_r strtok_s
#endif


#define udf_error(...)   udf_log_msg(udf->fs.ecma.lc, UDFREAD_LOG_ERROR, "udfread ERROR: ", __VA_ARGS__)
#define udf_log(...)     udf_log_msg(udf->fs.ecma.lc, UDFREAD_LOG_INFO,  "udfread LOG  : ", __VA_ARGS__)
#define udf_trace(...)   udf_log_msg(udf->fs.ecma.lc, UDFREAD_LOG_TRACE, "udfread TRACE: ", __VA_ARGS__)

/*
 * utils
 */

static char *_str_dup(const char *s)
{
    size_t len = strlen(s);
    char *p = (char *)malloc(len + 1);
    if (p) {
        memcpy(p, s, len + 1);
    }
    return p;
}

/*
 * Cached directory data
 */

struct udf_dir {
    struct udf_dir_entries       entries;
    struct udf_dir             **subdirs;
    struct long_ad                icb;  /* for stat */
};

static void _clean_tree(struct udf_dir *p)
{
    if (p) {
        uint32_t i;

        if (p->subdirs) {
            for (i = 0; i < p->entries.num_entries; i++) {
                _clean_tree(p->subdirs[i]);
                free(p->subdirs[i]);
                p->subdirs[i] = NULL;
            }
            free(p->subdirs);
            p->subdirs = NULL;
        }

        udf_clean_dir_entries(&p->entries);
    }
}


/*
 *
 */

struct udfread {

    struct udf_fs fs;

    udf_log  lc_storage;

    /* cached directory tree */
    struct udf_dir root_dir;

    char *volume_identifier;
    char volume_set_identifier[128];

    int partition_to_open;

    FILE *log_file;  /* possible log file from UDFREAD_LOG_FILE env var */
};

udfread *udfread_init(void)
{
    udfread *udf;

    udf = (udfread *)calloc(1, sizeof(udfread));
    if (!udf) {
        return NULL;
    }

    udf->partition_to_open = UDFREAD_PARTITION_FIRST;

    /* set up logging */
    if (getenv("UDFREAD_TRACE")) {
        udf->lc_storage.level  = UDFREAD_LOG_TRACE;
    } else if (getenv("UDFREAD_LOG")) {
        udf->lc_storage.level  = UDFREAD_LOG_INFO;
    } else {
        udf->lc_storage.level  = UDFREAD_LOG_ERROR;
    }
    udf->lc_storage.ctx    = stderr;
    udf->lc_storage.logger = (udf_logger)fprintf;
    udf->log_file          = NULL;

    if (getenv("UDFREAD_LOG_FILE")) {
        FILE *f = fopen(getenv("UDFREAD_LOG_FILE"), "w");
        if (f) {
            setvbuf(f, NULL, _IOLBF, 0);  /* line buffering */
            udf->lc_storage.ctx = f;
            udf->log_file = f;  /* so that it can be closed */
        }
    }
    udf->fs.ecma.lc = &udf->lc_storage;

#ifdef HAVE_UDFREAD_VERSION_H
    udf_log("libudfread " UDFREAD_VERSION_STRING "\n");
#endif

    return udf;
}

int udfread_set_log (udfread *udf, void *ctx, int (*logger)(void *ctx, const char *fmt, ...) )
{
    if (!udf || udf->fs.input) {
        /*
         * Changing the handler requires updating both ctx and logger
         * function atomically; with the image open this would need
         * locking, so the handler can only be changed before open.
         * After open only the level may be changed: it is stored in
         * lc_storage, whose ctx/logger fields are immutable by then.
         */
        return -1;
    }

    if (logger) {
        udf->lc_storage.ctx = ctx;
        udf->lc_storage.logger = logger;
    } else {
        /* NULL logger: reset to the default handler (fprintf to stderr) */
        udf->lc_storage.ctx = stderr;
        udf->lc_storage.logger = (udf_logger)fprintf;
    }

#ifdef HAVE_UDFREAD_VERSION_H
    udf->lc_storage.logger(udf->lc_storage.ctx, "libudfread " UDFREAD_VERSION_STRING "\n");
#endif

    return 0;
}

int udfread_set_log_level (udfread *udf, int level)
{
    if (!udf || level < UDFREAD_LOG_NONE || level > UDFREAD_LOG_TRACE) {
        return -1;
    }

    if (level <= UDFREAD_LOG_NONE) {
        udf->fs.ecma.lc = NULL;
    } else {
        udf->lc_storage.level = level;
        /*
         * Enabling/disabling logging is a single pointer update
         * (ecma.lc) and therefore safe to do while the image is open;
         * the published struct is always fully initialized because its
         * ctx/logger fields cannot change after open.
         */
        udf->fs.ecma.lc = &udf->lc_storage;
    }

    return 0;
}

int udfread_select_partition (udfread *udf, int partition)
{
    if (!udf) {
        return -1;
    }
    if (udf->fs.input) {
        /* already open */
        return -1;
    }
    if (partition < UDFREAD_PARTITION_LAST) {
        return -1;
    }

    udf->partition_to_open = partition;
    return 0;
}

/*
 * directory cache
 */

static struct udf_dir *_cache_subdir(udfread *udf, struct udf_dir *dir, uint32_t index)
{
    struct udf_dir *subdir, **subdirs;

    if (index >= dir->entries.num_entries) {
        return NULL;
    }
    if (!(dir->entries.files[index].characteristic & CHAR_FLAG_DIR)) {
        return NULL;
    }

    subdirs = atomic_load_acquire(&dir->subdirs);
    if (!subdirs) {
        subdirs = (struct udf_dir **)calloc(dir->entries.num_entries, sizeof(struct udf_dir *));
        if (!subdirs) {
            udf_error("out of memory\n");
            return NULL;
        }
        if (!atomic_pointer_compare_and_exchange(&dir->subdirs, NULL, subdirs)) {
            free(subdirs);
            subdirs = atomic_load_acquire(&dir->subdirs);
        }
    }

    subdir = atomic_load_acquire(&subdirs[index]);
    if (!subdir) {
        subdir = (struct udf_dir *)calloc(1, sizeof(struct udf_dir));
        if (!subdir) {
            udf_error("out of memory\n");
            return NULL;
        }
        if (udf_read_dir(&udf->fs, &dir->entries.files[index].icb, &subdir->entries) < 0) {
            udf_clean_dir_entries(&subdir->entries);
            free(subdir);
            return NULL;
        }
        if (!atomic_pointer_compare_and_exchange(&subdirs[index], NULL, subdir)) {
            udf_clean_dir_entries(&subdir->entries);
            free(subdir);
            subdir = atomic_load_acquire(&subdirs[index]);
        }
    }

    return subdir;
}

static int _scan_dir(const struct udf_dir_entries *dir, const char *filename, uint32_t *index)
{
    uint32_t i;

    for (i = 0; i < dir->num_entries; i++) {
        if (!strcmp(filename, dir->files[i].filename)) {
            *index = i;
            return 0;
        }
    }

    return -1;
}

/*
 * helper to traverse paths. Can't be used with files/dirs where name contains '/' or '\\'.
 */
static int _find_file(udfread *udf, const char *path,
                      struct udf_dir **p_dir,
                      const struct udf_file_identifier **p_fid)
{
    const struct udf_file_identifier *fid = NULL;
    struct udf_dir *current_dir;
    char *tmp_path, *save_ptr, *token;

    current_dir = &udf->root_dir;

    tmp_path = _str_dup(path);
    if (!tmp_path) {
        udf_error("out of memory\n");
        return -1;
    }

    token = strtok_r(tmp_path, "/\\", &save_ptr);
    if (token == NULL) {
        udf_trace("_find_file: requested root dir\n");
    }

    while (token) {
        uint32_t index;
        if (_scan_dir(&current_dir->entries, token, &index) < 0) {
            udf_log("_find_file: entry %s not found\n", token);
            goto error;
        }
        fid = &current_dir->entries.files[index];

        token = strtok_r(NULL, "/\\", &save_ptr);

        if (fid->characteristic & CHAR_FLAG_DIR) {
            current_dir = _cache_subdir(udf, current_dir, index);
            if (!current_dir) {
                goto error;
            }
        } else if (token) {
            udf_log("_find_file: entry %s not found (parent is file, not directory)\n", token);
            goto error;
        } else {
            // found a file, make sure we won't return directory data
            current_dir = NULL;
        }
    }

    if (p_fid) {
        if (!fid) {
            udf_log("no file identifier found for %s\n", path);
            goto error;
        }
        *p_fid = fid;
    }
    if (p_dir) {
        *p_dir = current_dir;
    }

    free(tmp_path);
    return 0;

error:
    free(tmp_path);
    return -1;
}


/*
 * Volume access API
 */

int udfread_open_input(udfread *udf, udfread_block_input *input/*, int partition*/)
{
    struct volume_descriptor_set vds;
    struct long_ad fsd_location;
    struct file_set_descriptor fsd;

    if (!udf || !input || !input->read) {
        return -1;
    }

    if (udf->fs.input) {
        /* already open */
        return -1;
    }

    if (udf_probe_volume(&udf->fs.ecma, input) < 0) {
        return -1;
    }

    /* read Volume Descriptor Sequence */
    if (udf_read_vds(&udf->fs.ecma, input, udf->partition_to_open, &vds) < 0) {
        return -1;
    }

    /* validate logical volume structure */
    if (udf_validate_logical_volume(&udf->fs.ecma, &vds.lvd, &fsd_location) < 0) {
        return -1;
    }

    /* Volume Identifier. CS0, UDF 2.1.1 */
    udf->volume_identifier = udf_cs0_to_mutf8(vds.pvd.volume_identifier, vds.pvd.volume_identifier_length);
    if (udf->volume_identifier) {
        udf_log("Volume Identifier: %s\n", udf->volume_identifier);
    }

    memcpy(udf->volume_set_identifier, vds.pvd.volume_set_identifier, 128);

    /* map partitions */
    if (udf_parse_partition_maps(&udf->fs.ecma, input, &vds, &udf->fs.part) < 0) {
        return -1;
    }

    udf->fs.input = input;

    /* Search for root directory from location given in File Set Descriptor */
    if (udf_find_root_dir(&udf->fs, &fsd_location, &fsd) < 0) {
        udf->fs.input = NULL;
        return -1;
    }

    /* Read root directory */
    if (udf_read_dir(&udf->fs, &fsd.root_icb, &udf->root_dir.entries) < 0) {
        udf_error("error reading root directory\n");
        udf->fs.input = NULL;
        return -1;
    }

    return 0;
}

int udfread_open(udfread *udf, const char *path)
{
    udfread_block_input *input;
    int result;

    if (!udf || !path || !*path) {
        return -1;
    }

    input = block_input_new(path);
    if (!input) {
        return -1;
    }

    result = udfread_open_input(udf, input);
    if (result < 0) {
        if (input->close) {
            input->close(input);
        }
    }

    return result;
}

void udfread_close(udfread *udf)
{
    if (udf) {
        if (udf->fs.input) {
            if (udf->fs.input->close) {
                udf->fs.input->close(udf->fs.input);
            }
            udf->fs.input = NULL;
        }

        _clean_tree(&udf->root_dir);
        free(udf->volume_identifier);
        if (udf->log_file) {
            fclose(udf->log_file);
        }
        free(udf);
    }
}

const char *udfread_get_volume_id(udfread *udf)
{
    if (udf) {
        return udf->volume_identifier;
    }
    return NULL;
}

size_t udfread_get_volume_set_id (udfread *udf, void *buffer, size_t size)
{
    if (udf && buffer) {
        if (size > sizeof(udf->volume_set_identifier)) {
            size = sizeof(udf->volume_set_identifier);
        }
        memcpy(buffer, udf->volume_set_identifier, size);
        return sizeof(udf->volume_set_identifier);
    }
    return 0;
}

/*
 * Directory access API
 */

struct udfread_dir {
    udfread              *udf;
    struct udf_dir       *dir;
    uint32_t              current_file;
};

static UDFDIR *_new_udfdir(udfread *udf, struct udf_dir *dir)
{
    UDFDIR *result;

    if (!dir) {
        return NULL;
    }

    result = (UDFDIR *)calloc(1, sizeof(UDFDIR));
    if (result) {
        result->dir = dir;
        result->udf = udf;
    }

    return result;
}

UDFDIR *udfread_opendir(udfread *udf, const char *path)
{
    struct udf_dir *dir = NULL;

    if (!udf || !udf->fs.input || !path || !*path) {
        return NULL;
    }

    if (_find_file(udf, path, &dir, NULL) < 0) {
        return NULL;
    }

    return _new_udfdir(udf, dir);
}

UDFDIR *udfread_opendir_at(UDFDIR *p, const char *name)
{
    udfread *udf;
    struct udf_dir *dir = NULL;
    uint32_t index;

    if (!p || !name || !*name) {
        return NULL;
    }
    udf = p->udf;

    if (_scan_dir(&p->dir->entries, name, &index) < 0) {
        udf_log("udfread_opendir_at: entry %s not found\n", name);
        return NULL;
    }

    dir = _cache_subdir(udf, p->dir, index);

    return _new_udfdir(p->udf, dir);
}

struct udfread_dirent *udfread_readdir(UDFDIR *p, struct udfread_dirent *entry)
{
    const struct udf_file_identifier *fi;

    if (!p || !entry || !p->dir) {
        return NULL;
    }

    if (p->current_file >= p->dir->entries.num_entries) {
        return NULL;
    }

    fi = &p->dir->entries.files[p->current_file];

    entry->d_name = fi->filename;

    if (fi->characteristic & CHAR_FLAG_PARENT) {
        entry->d_type = UDF_DT_DIR;
        entry->d_name = "..";
    } else if (fi->characteristic & CHAR_FLAG_DIR) {
        entry->d_type = UDF_DT_DIR;
    } else {
        entry->d_type = UDF_DT_REG;
    }

    p->current_file++;

    return entry;
}

void udfread_rewinddir(UDFDIR *p)
{
    if (p) {
        p->current_file = 0;
    }
}

void udfread_closedir(UDFDIR *p)
{
    free(p);
}


/*
 * File access API
 */

struct udfread_file {
    udfread           *udf;
    struct file_entry *fe;

    /* byte stream access */
    uint64_t    pos;
    uint8_t    *block;
    int         block_valid;

    void       *block_mem;
};

static UDFFILE *_file_open(udfread *udf, const char *path, const struct udf_file_identifier *fi)
{
    struct file_entry *fe;
    UDFFILE *result;

    if (fi->characteristic & CHAR_FLAG_DIR) {
        udf_log("error opening file %s (is directory)\n", path);
        return NULL;
    }

    fe = udf_read_file_entry(&udf->fs, &fi->icb);
    if (!fe) {
        udf_error("error reading file entry for %s\n", path);
        return NULL;
    }

    if (fe->file_type != ECMA_FT_BYTESTREAM) {
        /* Harbor extraction accepts regular files only. Never materialize
         * symbolic links, device nodes, FIFOs or other special file types. */
        udf_error("error opening file %s (not a regular file)\n", path);
        free_file_entry(&fe);
        return NULL;
    }

    result = (UDFFILE *)calloc(1, sizeof(UDFFILE));
    if (!result) {
        free_file_entry(&fe);
        return NULL;
    }

    result->udf = udf;
    result->fe  = fe;

    return result;
}

UDFFILE *udfread_file_open(udfread *udf, const char *path)
{
    const struct udf_file_identifier *fi = NULL;

    if (!udf || !udf->fs.input || !path) {
        return NULL;
    }

    if (_find_file(udf, path, NULL, &fi) < 0) {
        return NULL;
    }

    return _file_open(udf, path, fi);
}

UDFFILE *udfread_file_openat(UDFDIR *dir, const char *name)
{
    udfread *udf;
    uint32_t index;

    if (!dir || !name || !*name) {
        return NULL;
    }
    udf = dir->udf;

    if (_scan_dir(&dir->dir->entries, name, &index) < 0) {
        udf_log("udfread_file_openat: entry %s not found\n", name);
        return NULL;
    }

    return _file_open(udf, name, &dir->dir->entries.files[index]);
}

int64_t udfread_file_size(UDFFILE *p)
{
    if (p) {
        return (int64_t)p->fe->length;
    }
    return -1;
}

void udfread_file_close(UDFFILE *p)
{
    if (p) {
        free_file_entry(&p->fe);
        free(p->block_mem);
        free(p);
    }
}

/*
 * block access
 */

uint32_t udfread_file_lba(UDFFILE *p, uint32_t file_block)
{
    udfread *udf;

    if (!p) {
        return 0;
    }
    udf = p->udf;

    return udf_file_lba(&udf->fs, p->fe, file_block, NULL);
}

uint32_t udfread_read_blocks(UDFFILE *p, void *buf, uint32_t file_block, uint32_t num_blocks, int flags)
{
    udfread *udf;

    if (!p || !num_blocks || !buf) {
        return 0;
    }
    udf = p->udf;

    return udf_read_file_blocks(&udf->fs, p->fe, buf, file_block, num_blocks, flags);
}

/*
 * byte stream
 */

static ssize_t _read(UDFFILE *p, void *buf, size_t bytes)
{
    /* start from middle of block ?
     * maximal file size, i.e. position, is 2^32 * block size
     */

    size_t pos_off = p->pos % UDF_BLOCK_SIZE;
    uint32_t file_block = (uint32_t)(p->pos / UDF_BLOCK_SIZE);
    if (pos_off) {
        size_t chunk_size = UDF_BLOCK_SIZE - pos_off;
        if (!p->block_valid) {
            if (udf_read_file_blocks(&p->udf->fs, p->fe, p->block, file_block, 1, 0) != 1) {
                return -1;
            }
            p->block_valid = 1;
        }
        if (chunk_size > bytes) {
            chunk_size = bytes;
        }
        memcpy(buf, p->block + pos_off, chunk_size);
        p->pos += (uint64_t)chunk_size;
        return (ssize_t)chunk_size;
    }

    /* read full block(s) ? */
    if (bytes >= UDF_BLOCK_SIZE) {
        uint32_t num_blocks = bytes / UDF_BLOCK_SIZE;
        num_blocks = udf_read_file_blocks(&p->udf->fs, p->fe, buf, file_block, num_blocks, 0);
        if (num_blocks < 1) {
            return -1;
        }
        p->pos += num_blocks * UDF_BLOCK_SIZE;
        return num_blocks * UDF_BLOCK_SIZE;
    }

    /* read beginning of a block */
    if (udf_read_file_blocks(&p->udf->fs, p->fe, p->block, file_block, 1, 0) != 1) {
        return -1;
    }
    p->block_valid = 1;
    memcpy(buf, p->block, bytes);
    p->pos += bytes;
    return (ssize_t)bytes;
}

static ssize_t _read_inline(UDFFILE *p, void *buf, size_t bytes)
{
    udfread *udf = p->udf;
    uint64_t information_length = p->fe->u.data.information_length;
    size_t   pad_size = 0;

    if (p->pos + bytes > information_length) {
        udf_log("read hits padding in inline file\n");
        if (p->pos > information_length) {
            pad_size = bytes;
        } else {
            pad_size = (size_t)(p->pos + bytes - information_length);
        }
        memset((char*)buf + bytes - pad_size, 0, pad_size);
    }

    if (pad_size < bytes) {
        memcpy(buf, &p->fe->u.data.content[p->pos], bytes - pad_size);
    }

    p->pos = p->pos + bytes;
    return (ssize_t)bytes;
}

#define ALIGN(p, align) \
  (uint8_t *)( ((uintptr_t)(p) + ((align)-1)) & ~((uintptr_t)((align)-1)))

ssize_t udfread_file_read(UDFFILE *p, void *buf, size_t bytes)
{
    uint8_t *bufpt = (uint8_t *)buf;

    /* sanity checks */
    if (!p || !buf) {
        return -1;
    }
    if ((ssize_t)bytes < 0) {
        return -1;
    }

    if (p->pos >= p->fe->length) {
        return 0;
    }

    /* limit range to file size */
    if (p->pos + bytes > p->fe->length) {
        bytes = (size_t)(p->fe->length - p->pos);
    }

    /* small files may be stored inline in file entry */
    if (p->fe->content_inline) {
        return _read_inline(p, buf, bytes);
    }

    /* allocate temp storage for input block */
    if (!p->block) {
        p->block_mem = malloc(2 * UDF_BLOCK_SIZE);
        if (!p->block_mem) {
            return -1;
        }
        p->block = ALIGN(p->block_mem, UDF_BLOCK_SIZE);
    }

    /* read chunks */
    while (bytes > 0) {
        ssize_t r = _read(p, bufpt, bytes);
        if (r < 0) {
            if (bufpt != buf) {
                /* got some bytes */
                break;
            }
            /* got nothing */
            return -1;
        }
        bufpt += r;
        bytes -= (size_t)r;
    }

    return (intptr_t)bufpt - (intptr_t)buf;
}

int64_t udfread_file_tell(UDFFILE *p)
{
    if (p) {
        return (int64_t)p->pos;
    }
    return -1;
}

int64_t udfread_file_seek(UDFFILE *p, int64_t pos, int whence)
{
    if (!p) {
        return -1;
    }

    switch (whence) {
        case UDF_SEEK_CUR:
            pos = udfread_file_tell(p) + pos;
            break;
        case UDF_SEEK_END:
            pos = udfread_file_size(p) + pos;
            break;
        case UDF_SEEK_SET:
            break;
        default:
            return -1;
    }

    if (pos >= 0) {
        p->pos = (uint64_t)pos;
        p->block_valid = 0;
        return udfread_file_tell(p);
    }

    return -1;
}

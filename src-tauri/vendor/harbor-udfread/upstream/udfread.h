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

#ifndef UDFREAD_H_
#define UDFREAD_H_

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>    /* *int_t */
#include <sys/types.h> /* *size_t */

#if defined(_MSC_VER) && !defined(ssize_t)
#include <basetsd.h>
typedef SSIZE_T ssize_t;
#endif

/** @cond */
#ifdef UDFREAD_API_EXPORT
#include "attributes.h"
#elif !defined(UDF_PUBLIC)
#define UDF_PUBLIC
#endif
/** @endcond */

/**
 * @file udfread.h
 * @brief external API header
 *
 * @note UDF filesystem file identifiers may contain nul bytes (0x00).
 *       In libudfread API file and directory names are encoded as Modified UTF-8 (MUTF-8).
 *       The null character (U+0000) uses two-byte overlong encoding 11000000 10000000
 *       (hexadecimal C0 80) instead of 00000000 (hexadecimal 00).
 *
 * @note Thread safety: after a volume has been opened (udfread_open or
 *       udfread_open_input) the library is thread-safe — the same udfread
 *       handle may be used concurrently from multiple threads.
 *       udfread_close must not run concurrently with any other call on the
 *       same handle.
 */

/** @name Volume access
 *  @{
 */

/** Opaque handle for UDF volume */
typedef struct udfread udfread;

/** Block input callbacks, see blockinput.h */
struct udfread_block_input;

/**
 *  Initialize UDF reader
 *
 * @return allocated udfread object, NULL if error
 */
UDF_PUBLIC udfread *udfread_init (void);

/**
 *  Select partition to open
 *
 *  Partition should be selected before udfread_open*().
 *  'Success' return does not mean partition was found.
 *  Function returns error if image is already open.
 *
 * @param partition  partition to open (number or UDFREAD_PARTITION_*)
 * @return 0 on success, < 0 on error
 */
UDF_PUBLIC int udfread_select_partition (udfread *, int partition);

/* Special partition numbers for udfread_select_partition() */
#define UDFREAD_PARTITION_FIRST  (-1)  /**< Open first partition */
#define UDFREAD_PARTITION_LAST   (-2)  /**< Open last partition */

/**
 *  Set logging handler
 *
 *  Set the printf-style logging function and the context passed to it.
 *  Does not change log level (see udfread_set_log_level()).
 *  Passing NULL logger resets to the default handler (fprintf to stderr).
 *
 *  @note Must be called before the image is opened.
 *
 *  Example:
 *  @code
 *  udfread *udf = udfread_init();
 *  udfread_set_log(udf, NULL, my_logger);   // my_logger is printf-style
 *  udfread_set_log_level(udf, UDFREAD_LOG_INFO);
 *  udfread_open(udf, "/dev/sr0");
 *  @endcode
 *
 * @param udf  udfread object
 * @param ctx  user context passed to logger
 * @param logger  printf-style logging function, NULL to reset to the default handler
 * @return 0 on success, < 0 on error (image already open)
 * @sa udfread_set_log_level()
 */
UDF_PUBLIC int udfread_set_log (udfread *udf, void *ctx, int (*logger)(void *ctx, const char *fmt, ...) );

/**
 *  Set logging level
 *
 *  Enable or disable logging. With UDFREAD_LOG_NONE logging is disabled;
 *  otherwise the handler set with udfread_set_log() is used.
 *
 *  May also be called after the image is opened.
 *
 * @param udf  udfread object
 * @param level  UDFREAD_LOG_NONE, UDFREAD_LOG_ERROR, UDFREAD_LOG_INFO or UDFREAD_LOG_TRACE
 * @return 0 on success, < 0 on error (invalid level)
 * @sa udfread_set_log()
 */
UDF_PUBLIC int udfread_set_log_level (udfread *udf, int level);

/* Log levels for udfread_set_log_level() (default: UDFREAD_LOG_ERROR) */
#define UDFREAD_LOG_NONE  0  /**< Logging disabled */
#define UDFREAD_LOG_ERROR 1  /**< Errors only (default) */
#define UDFREAD_LOG_INFO  2  /**< Errors and informational messages */
#define UDFREAD_LOG_TRACE 3  /**< Everything, including debug traces */

/**
 *  Open UDF image
 *
 * @param p  udfread object
 * @param input  UDF image access functions
 * @return 0 on success, < 0 on error
 */
UDF_PUBLIC int udfread_open_input (udfread *p, struct udfread_block_input *input);

/**
 *  Open UDF image
 *
 * @param p  udfread object
 * @param path  path to device or image file
 * @return 0 on success, < 0 on error
 */
UDF_PUBLIC int udfread_open (udfread *p, const char *path);

/**
 *  Close UDF image
 *
 * @param p  udfread object
 */
UDF_PUBLIC void udfread_close (udfread *p);

/**
 *  Get UDF Volume Identifier
 *
 * @param p  udfread object
 * @return Volume ID as null-terminated MUTF-8 string, NULL if error
 * @note Returned pointer is valid until udfread_close().
 */
UDF_PUBLIC const char *udfread_get_volume_id (udfread *p);

/**
 *  Get UDF Volume Set Identifier
 *
 *  The Volume Set Identifier is a fixed length field in the Primary
 *  Volume Descriptor.  It is not a string: it may contain arbitrary
 *  bytes and is not NUL terminated.
 *
 *  At most 'size' bytes are written to buffer.
 *
 * @param p  udfread object
 * @param buffer buffer to receive volume set id
 * @param size buffer size
 * @return size of the Volume Set Identifier, 0 if error.
 *         If the returned value is larger than 'size', the value was
 *         truncated to 'size' bytes.
 */
UDF_PUBLIC size_t udfread_get_volume_set_id (udfread *p, void *buffer, size_t size);

/** @} */

/** @name Directory access
 *  @{
 */

/** File types for d_type */
typedef enum {
    UDF_DT_UNKNOWN = 0,  /**< Unknown file type */
    UDF_DT_DIR,          /**< Directory */
    UDF_DT_REG,          /**< Regular file */
} udfread_dirent_type;

/**
 *  Directory stream entry
 */
struct udfread_dirent {
    unsigned int  d_type;    /**< UDF_DT_* file type */
    const char   *d_name;    /**< Entry name (MUTF-8) */
};

/** Opaque handle for directory stream */
typedef struct udfread_dir UDFDIR;

/**
 *  Open directory stream
 *
 * @param p  udfread object
 * @param path  path to the directory (MUTF-8)
 * @return directory stream handle on the directory, or NULL if it could not be opened.
 */
UDF_PUBLIC UDFDIR *udfread_opendir (udfread *p, const char *path);

/**
 *  Open directory stream
 *
 *  Directory name may contain special chars (/, \, ...).
 *
 * @param dir  parent directory stream handle
 * @param name  name of the directory to open from dir (MUTF-8)
 * @return directory stream handle on the directory, or NULL if it could not be opened.
 */
UDF_PUBLIC UDFDIR *udfread_opendir_at(UDFDIR *dir, const char *name);

/**
 *  Read directory stream
 *
 *  Read a directory entry from directory stream. Return a pointer to
 *  udfread_dirent struct describing the entry, or NULL for EOF or error.
 *
 *  Note: an entry can also be a symbolic link (UDF file type 12).
 *  Symbolic links are not resolved here: the Directory characteristic of
 *  a symbolic link FID is always 0 (ECMA-167 4/14.4.3 note 20), so symlink
 *  entries are reported as UDF_DT_REG regardless of their target type.
 *
 * @param p  directory stream
 * @param entry  storage space for directory entry
 * @return next directory stream entry, or NULL if EOF or error.
 * @sa udfread_rewinddir()
 */
UDF_PUBLIC struct udfread_dirent *udfread_readdir (UDFDIR *p, struct udfread_dirent *entry);

/**
 *  Rewind directory stream
 *
 *  Rewind directory stream to the beginning of the directory.
 *
 * @param p  directory stream
 */
UDF_PUBLIC void udfread_rewinddir (UDFDIR *p);

/**
 *  Close directory stream
 *
 * @param p  directory stream
 */
UDF_PUBLIC void udfread_closedir (UDFDIR *p);

/** @} */

/** @name File access
 *  @{
 */

/**
 *  The length of one Logical Block
 */
#ifndef UDF_BLOCK_SIZE
#  define UDF_BLOCK_SIZE  2048
#endif

/** Opaque handle for open file */
typedef struct udfread_file UDFFILE;

/**
 *  Open a file
 *
 *  Allowed separator chars are \ and /.
 *  Path to the file is always absolute (relative to disc image root).
 *  Path may begin with single separator char.
 *  Path may not contain "." or ".." directory components.
 *
 *  The returned file object is not thread-safe; a single UDFFILE handle
 *  must not be used from multiple threads concurrently.
 *
 * @param p  udfread object
 * @param path  path to the file (MUTF-8)
 * @return file object, or NULL if it could not be opened.
 * @sa udfread_file_openat()
 */
UDF_PUBLIC UDFFILE *udfread_file_open (udfread *p, const char *path);

/**
 *  Open a file from directory
 *
 *  File name may contain special chars (/, \, ...).
 *
 * @param dir  parent directory stream handle
 * @param name  name of the file (MUTF-8)
 * @return file object, or NULL if it could not be opened.
 * @sa udfread_file_open()
 */
UDF_PUBLIC UDFFILE *udfread_file_openat (UDFDIR *dir, const char *name);

/**
 *  Close file object
 *
 * @param p  file object
 */
UDF_PUBLIC void udfread_file_close (UDFFILE *p);

/**
 *  Get file size
 *
 * @param p  file object
 * @return file size, -1 on error
 */
UDF_PUBLIC int64_t udfread_file_size (UDFFILE *p);

/** @} */

/** @name Block access
 *  @{
 */

/**
 *  Get file block address
 *
 *  Convert file block number to absolute block address.
 *
 * @param p  file object
 * @param file_block  file block number
 * @return absolute block address, 0 on error
 */
UDF_PUBLIC uint32_t udfread_file_lba (UDFFILE *p, uint32_t file_block);

/**
 *  Read blocks from a file
 *
 * @param p  file object
 * @param buf  buffer for data
 * @param file_block  file block number
 * @param num_blocks  number of blocks to read
 * @param flags  read flags, passed to input->read()
 * @return number of blocks read, 0 on error
 */
UDF_PUBLIC uint32_t udfread_read_blocks (UDFFILE *p, void *buf, uint32_t file_block, uint32_t num_blocks, int flags);

/** @} */

/** @name Byte streams
 *  @{
 */

/** Seek directives for udfread_file_seek() */
typedef enum {
    UDF_SEEK_SET = 0,  /**< The offset is set to offset bytes */
    UDF_SEEK_CUR = 1,  /**< The offset is set to its current location plus offset bytes */
    UDF_SEEK_END = 2,  /**< The offset is set to the size of the file plus offset bytes */
} udfread_seek_type;

/**
 *  Read bytes from a file
 *
 *  Reads the given number of bytes from the file and increment the
 *  current read position by number of bytes read.
 *
 * @param p  file object
 * @param buf  buffer for data
 * @param bytes  number of bytes to read
 * @return number of bytes read, 0 on EOF, -1 on error
 */
UDF_PUBLIC ssize_t udfread_file_read (UDFFILE *p, void *buf, size_t bytes);

/**
 *  Get current read position of a file
 *
 * @param p  file object
 * @return current read position of the file, -1 on error
 */
UDF_PUBLIC int64_t udfread_file_tell (UDFFILE *p);

/**
 *  Set read position of a file
 *
 *  New read position is calculated from offset according to the directive whence as follows:
 *    UDF_SEEK_SET  The offset is set to offset bytes.
 *    UDF_SEEK_CUR  The offset is set to its current location plus offset bytes.
 *    UDF_SEEK_END  The offset is set to the size of the file plus offset bytes.
 *
 * @param p  file object
 * @param pos  byte offset
 * @param whence  directive (UDF_SEEK_*)
 * @return current read position of the file, -1 on error
 * @sa udfread_file_tell()
 */
UDF_PUBLIC int64_t udfread_file_seek (UDFFILE *p, int64_t pos, int whence);

/** @} */

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* UDFREAD_H_ */

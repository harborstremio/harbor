/*
 * This file is part of libudfread
 * Copyright (C) 2026 VLC authors and VideoLAN
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

#ifndef UDFREAD_LOGGER_H_
#define UDFREAD_LOGGER_H_

/* logger function */
typedef int (*udf_logger)(void *ctx, const char *fmt, ...);

typedef struct {
    int          level;   /* current logging level */
    void        *ctx;     /* passed to logger */
    udf_logger   logger;  /* logger function */
} udf_log;

/* logging context */
typedef const udf_log udf_lc;

#define udf_log_msg(lc,lvl,head,...)              \
  do {                                            \
    const udf_lc *_lc = (lc);                     \
    if (_lc && _lc->level >= (lvl))               \
      _lc->logger(_lc->ctx, head __VA_ARGS__);    \
  } while (0)

#endif /* UDFREAD_LOGGER_H_ */

/*
 * This file is part of libudfread
 * Copyright (C) 2014 VLC authors and VideoLAN
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

#include "udfread-version.h"

/*
 * Library version
 */
void udfread_get_version(int *major, int *minor, int *micro)
{
    if (major) {
        *major = UDFREAD_VERSION_MAJOR;
    }
    if (minor) {
        *minor = UDFREAD_VERSION_MINOR;
    }
    if (micro) {
        *micro = UDFREAD_VERSION_MICRO;
    }
}

